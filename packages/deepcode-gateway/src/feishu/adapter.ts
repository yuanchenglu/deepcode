/**
 * DeepCode 消息网关 — 飞书平台适配器
 *
 * 使用 @larksuiteoapi/node-sdk 的 WSClient 建立长连接，
 * 通过飞书事件订阅接收 im.message.receive_v1 消息。
 * 发消息走 REST API（getTenantAccessToken + sendMessage）。
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
// 飞书 WebSocket 客户端（基于官方 @larksuiteoapi/node-sdk 的 WSClient）
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
   * 5. 启动 WebSocket 长连接（FeishuWSClient 内部由 SDK 处理认证、心跳、重连）
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

      // 创建飞书长链接客户端（基于官方 Node SDK 的 WSClient）
      const wsClient = new FeishuWSClient(self.cfg)

      // 注册事件回调：SDK 收到 im.message.receive_v1 事件时调用
      // SDK 传入的 data 是事件体的 event 字段内容，即 { sender, message } 结构
      wsClient.setEventHandler((data) => {
        self.handleEvent(data as Record<string, unknown>, mq)
      })

      // 启动长连接（SDK 内部处理认证、心跳、重连、protobuf 编解码）
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
      // FeishuWSClient.stop() 释放 WSClient 引用
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
   * SDK 的 EventDispatcher 传入的 data 结构为 { sender, message }，
   * 即事件体中的 event 字段内容（不含 header，因为 SDK 已按事件类型分发）。
   *
   * @param data   - SDK 传入的事件数据 { sender, message }
   * @param queue  - 共享消息队列
   */
  private async handleEvent(data: Record<string, unknown>, queue: Queue.Queue<GatewayMessage>): Promise<void> {
    try {
      const msg = parseFeishuMessage(data)
      if (!msg) return // 无法解析的消息，忽略

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
 * 解析飞书 SDK 事件数据为统一 GatewayMessage
 *
 * SDK 的 EventDispatcher.register('im.message.receive_v1', handler) 中，
 * handler 接收的 data 是事件体的 event 字段内容，结构为：
 * {
 *   sender: { sender_id: { open_id, user_id, union_id }, sender_type, tenant_key },
 *   message: { message_id, chat_id, chat_type, message_type, content, ... }
 * }
 *
 * 注意：与 router.ts 中的 parseFeishuEvent 不同（后者接收完整 webhook body
 * 含 header + event）。本函数只处理 SDK 传入的 event 字段内容。
 *
 * @param data - SDK 传入的事件数据 { sender, message }
 * @returns 解析后的 GatewayMessage；无法解析返回 undefined
 */
function parseFeishuMessage(data: Record<string, unknown>): GatewayMessage | undefined {
  const sender = data.sender as Record<string, unknown> | undefined
  const message = data.message as Record<string, unknown> | undefined

  // 必须有 message 字段才算有效消息
  if (!message) return undefined

  // 从 message.content JSON 中提取纯文本
  // content 格式如 {"text":"消息内容"}
  let content = ""
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

  // 判断会话类型：p2p=私聊, group=群聊
  const chatType = (message.chat_type as string) === "group" ? "group" : "private"

  // 提取发送者 ID（open_id 优先）
  const senderId = ((sender?.sender_id as Record<string, string>)?.open_id) || ""

  return {
    id: (message.message_id as string) || `feishu_${Date.now()}`,
    platform: "feishu",
    type: "text",
    content,
    sender: {
      id: senderId,
      name: (sender?.sender_type as string) || "unknown",
    },
    chat: {
      id: (message.chat_id as string) || "",
      type: chatType,
    },
    timestamp: Date.now(),
    raw: data,
  }
}
