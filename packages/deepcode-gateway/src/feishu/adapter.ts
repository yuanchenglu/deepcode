/**
 * DeepCode 消息网关 — 飞书平台适配器
 *
 * 使用纯 TypeScript WebSocket 客户端（FeishuWSClient）建立长连接，
 * 通过飞书事件订阅接收 im.message.receive_v1 消息。
 * 发消息走 REST API（getTenantAccessToken + sendMessage）。
 *
 * 不再依赖 Node SDK，WS 连接由 ws-client.ts 纯 TS 实现。
 *
 * @module
 */

import { Effect, Queue, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { GatewayMessage, OutboundMessage, SendResult } from "../message"
import { GatewayError } from "../error"
import type { FeishuConfig } from "../config"
import { getTenantAccessToken, sendMessage } from "./api"
import { getMessageQueue } from "../lifecycle"
// 纯 TypeScript 飞书 WebSocket 客户端（替代 Node SDK）
import { FeishuWSClient } from "./ws-client"

export class FeishuAdapter implements PlatformAdapter {
  readonly name = "feishu"
  private cfg: FeishuConfig
  private _queue: Queue.Queue<GatewayMessage> | null = null
  /** tenant_access_token 缓存（用于 REST API 发消息，55 分钟刷新） */
  private tokenCache: { token: string; expiry: number } | null = null
  /** 飞书 WebSocket 客户端实例 */
  private wsClient: FeishuWSClient | null = null

  constructor(config: FeishuConfig) {
    this.cfg = config
  }

  /**
   * 启动飞书长连接
   *
   * 流程：
   * 1. 先获取 tenant_access_token（发消息时还需要）
   * 2. 获取共享消息队列（由 lifecycle.startGateway 创建）
   * 3. 创建 FeishuWSClient 并注册事件回调
   * 4. 回调从 WS 事件中提取消息文本，推入共享消息队列
   * 5. 启动 WebSocket 长连接（FeishuWSClient 内部处理认证、心跳、重连）
   */
  start(): Effect.Effect<void, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      // 预先获取 tenant_access_token（会缓存 55 分钟，发消息时复用）
      yield* self.getToken()

      // 获取共享消息队列（由 lifecycle.startGateway 在启动适配器前创建）
      const mq = getMessageQueue()
      if (!mq) {
        return yield* Effect.fail(new GatewayError("INTERNAL_ERROR", "消息队列未初始化"))
      }

      // 创建纯 TS WebSocket 客户端（替代 Node SDK 的 WSClient）
      const wsClient = new FeishuWSClient(self.cfg)

      // 注册事件回调：收到 EVENT 帧时解析并推入消息队列
      wsClient.setEventHandler((eventBody) => {
        // eventBody 是飞书事件体（包含 header + event）
        self.handleEvent(eventBody as Record<string, unknown>, mq)
      })

      // 启动长连接（FeishuWSClient 内部处理认证、心跳、重连）
      yield* Effect.tryPromise({
        try: () => wsClient.start(),
        catch: (err) => new GatewayError("NETWORK_ERROR", `飞书长连接启动失败: ${(err as Error).message}`),
      })

      self.wsClient = wsClient
      console.log("[FeishuAdapter] 飞书长连接已启动")
    })
  }

  /** 停止飞书长连接 */
  stop(): Effect.Effect<void> {
    const self = this
    return Effect.sync(() => {
      // FeishuWSClient.stop() 关闭连接并清除所有定时器
      self.wsClient?.stop()
      self.wsClient = null
      console.log("[FeishuAdapter] 飞书长连接已停止")
    })
  }

  /** 发送消息到飞书（走 REST API） */
  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      const token = yield* self.getToken()
      yield* sendMessage(token, msg.chatId, msg.content).pipe(
        Effect.mapError(() => new GatewayError("NETWORK_ERROR", "send failed")),
      )
      return { platformMessageId: `feishu_${Date.now()}`, timestamp: Date.now() }
    })
  }

  /** 获取或刷新 tenant_access_token（REST API 用，与 WS 认证的 app_access_token 不同） */
  private getToken(): Effect.Effect<string, GatewayError> {
    if (this.tokenCache && this.tokenCache.expiry > Date.now()) {
      return Effect.succeed(this.tokenCache.token)
    }
    const self = this
    return Effect.gen(function* () {
      const token = yield* getTenantAccessToken(self.cfg.appId, self.cfg.appSecret).pipe(
        Effect.mapError((e) => new GatewayError("AUTH_ERROR", e.message)),
      )
      // 缓存 55 分钟（飞书 token 有效期 2 小时，提前 5 分钟刷新）
      self.tokenCache = { token, expiry: Date.now() + 55 * 60 * 1000 }
      return token
    })
  }

  /**
   * 处理飞书事件：解析为 GatewayMessage 并推入消息队列
   *
   * WS 事件体结构与 webhook body 一致：
   * { header: { event_type }, event: { sender, message, chat_id } }
   *
   * @param data   - 飞书事件体（frame.event）
   * @param queue  - 共享消息队列
   */
  private async handleEvent(data: Record<string, unknown>, queue: Queue.Queue<GatewayMessage>): Promise<void> {
    try {
      const msg = parseFeishuEvent(data)
      if (!msg) return // 非 im.message.receive_v1，忽略

      // 推入共享消息队列（Effect.runFork 在非 Effect 上下文中驱动 Effect）
      Effect.runFork(Queue.offer(queue, msg))
    } catch (err) {
      console.error("[FeishuAdapter] 事件处理失败:", err)
    }
  }

  setQueue(q: Queue.Queue<GatewayMessage>): void {
    this._queue = q
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> {
    if (!this._queue) return Stream.fail(new GatewayError("INTERNAL_ERROR", "Queue not initialized"))
    return Stream.fromQueue(this._queue)
  }
}

/**
 * 解析飞书事件为统一 GatewayMessage
 *
 * 与 router.ts 中的 parseFeishuEvent 逻辑一致，
 * 接收 WS 事件体（包含 header + event 字段）。
 *
 * @param data - 飞书事件体
 * @returns 解析后的 GatewayMessage；非消息事件返回 undefined
 */
function parseFeishuEvent(data: Record<string, unknown>): GatewayMessage | undefined {
  const header = data.header as Record<string, unknown> | undefined
  const eventBody = data.event as Record<string, unknown> | undefined
  // 只处理 im.message.receive_v1 事件
  if (header?.event_type !== "im.message.receive_v1" || !eventBody) return undefined

  const sender = eventBody.sender as Record<string, unknown> | undefined
  const message = eventBody.message as Record<string, unknown> | undefined

  // 从 message.content JSON 中提取纯文本
  let content = ""
  if (message) {
    const rawContent = message.content as string | undefined
    if (rawContent) {
      try {
        const parsed = JSON.parse(rawContent) as Record<string, unknown>
        content = (parsed.text as string) || ""
      } catch {
        // 非 JSON 格式，直接使用原始内容
        content = rawContent
      }
    }
  }

  return {
    id: (message?.message_id as string) || `feishu_${Date.now()}`,
    platform: "feishu",
    type: "text",
    content,
    sender: {
      id: ((sender?.sender_id as Record<string, string>)?.open_id) || "",
      name: (sender?.sender_type as string) || "unknown",
    },
    chat: { id: (eventBody.chat_id as string) || "", type: "private" },
    timestamp: Date.now(),
    raw: data,
  }
}
