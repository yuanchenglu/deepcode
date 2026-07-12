/**
 * DeepCode 消息网关 — 飞书平台适配器
 *
 * 使用 @larksuiteoapi/node-sdk 的 WSClient 建立 WebSocket 长连接，
 * 通过飞书事件订阅接收 im.message.receive_v1 消息。
 * 发消息走 REST API（getTenantAccessToken + sendMessage）。
 *
 * @module
 */

import { Effect, Queue, Stream } from "effect"
import * as Lark from "@larksuiteoapi/node-sdk"
import type { PlatformAdapter } from "../adapter"
import type { GatewayMessage, OutboundMessage, SendResult } from "../message"
import { GatewayError } from "../error"
import type { FeishuConfig } from "../config"
import { getTenantAccessToken, sendMessage } from "./api"
import { getMessageQueue } from "../lifecycle"

export class FeishuAdapter implements PlatformAdapter {
  readonly name = "feishu"
  private cfg: FeishuConfig
  private _queue: Queue.Queue<GatewayMessage> | null = null
  private tokenCache: { token: string; expiry: number } | null = null
  private wsClient: Lark.WSClient | null = null

  constructor(config: FeishuConfig) {
    this.cfg = config
  }

  /**
   * 启动飞书长连接
   *
   * 流程：
   * 1. 先获取 tenant_access_token（发消息时还需要）
   * 2. 创建 Lark WSClient 并注册 im.message.receive_v1 处理器
   * 3. 处理器从事件中提取消息文本，推入共享消息队列
   */
  start(): Effect.Effect<void, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      // 预先获取 token（会缓存 55 分钟，发消息和长连接共用）
      yield* self.getToken()

      // 获取共享消息队列（由 lifecycle.startGateway 在启动适配器前创建）
      const mq = getMessageQueue()
      if (!mq) {
        return yield* Effect.fail(new GatewayError("INTERNAL_ERROR", "消息队列未初始化"))
      }

      // 创建飞书 SDK WSClient（SDK 内部处理认证、心跳、重连）
      const wsClient = new Lark.WSClient({
        appId: self.cfg.appId,
        appSecret: self.cfg.appSecret,
        loggerLevel: Lark.LoggerLevel.info,
        // 连接成功回调
        onReady: () => console.log("[FeishuAdapter] 飞书长连接已就绪"),
        // 重连回调
        onReconnecting: () => console.log("[FeishuAdapter] 飞书长连接重连中..."),
        onReconnected: () => console.log("[FeishuAdapter] 飞书长连接重连成功"),
      })

      // 注册事件处理器
      const dispatcher = new Lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data: unknown) => {
          const eventData = data as Record<string, unknown>
          await self.handleEvent(eventData, mq)
        },
      })

      // 启动长连接（阻塞直到连接就绪）
      yield* Effect.tryPromise({
        try: () => wsClient.start({ eventDispatcher: dispatcher }),
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
      self.wsClient?.close()
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

  /** 获取或刷新 tenant_access_token */
  private getToken(): Effect.Effect<string, GatewayError> {
    if (this.tokenCache && this.tokenCache.expiry > Date.now()) {
      return Effect.succeed(this.tokenCache.token)
    }
    const self = this
    return Effect.gen(function* () {
      const token = yield* getTenantAccessToken(self.cfg.appId, self.cfg.appSecret).pipe(
        Effect.mapError((e) => new GatewayError("AUTH_ERROR", e.message)),
      )
      self.tokenCache = { token, expiry: Date.now() + 55 * 60 * 1000 }
      return token
    })
  }

  /**
   * 处理飞书事件：解析为 GatewayMessage 并推入消息队列
   *
   * SDK 回调中的 data 结构与 webhook body 一致：
   * { header: { event_type }, event: { sender, message, chat_id } }
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
 * 但接收的是 SDK 回调中的 data 对象而非原始 HTTP body。
 */
function parseFeishuEvent(data: Record<string, unknown>): GatewayMessage | undefined {
  const header = data.header as Record<string, unknown> | undefined
  const eventBody = data.event as Record<string, unknown> | undefined
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
