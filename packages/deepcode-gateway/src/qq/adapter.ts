/**
 * DeepCode 消息网关 — QQ 官方机器人平台适配器
 *
 * 通过 WebSocket Gateway 接收事件，通过 REST 发送消息。
 *
 * @module qq/adapter
 */

import { Effect, Queue, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { GatewayMessage, OutboundMessage, SendResult } from "../message"
import { GatewayError } from "../error"
import type { QQConfig } from "../config"
import { getGatewayUrl, sendChannelMessage, sendC2CMessage } from "./api"
import { QQWSClient } from "./ws-client"
import { stripAtMentions } from "./crypto"

export class QQAdapter implements PlatformAdapter {
  readonly name = "qq" as const
  private readonly cfg: QQConfig
  private _queue: Queue.Queue<GatewayMessage> | null = null
  private ws: QQWSClient | null = null

  constructor(config: QQConfig) {
    this.cfg = config
  }

  /** 启动：先获取 Gateway URL，再建立 WS 连接 */
  start(): Effect.Effect<void, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      const mq = self._queue ?? (yield* Queue.unbounded<GatewayMessage>())
      self._queue = mq

      const url = yield* Effect.tryPromise({
        try: async () => {
          const effect = getGatewayUrl(self.cfg.token, self.cfg.sandbox)
          return await Effect.runPromise(effect)
        },
        catch: (err) => new GatewayError("NETWORK_ERROR", `QQ getGatewayUrl failed: ${(err as Error).message}`),
      })

      const client = new QQWSClient(self.cfg)
      client.setDispatchHandler((type, data) => self.handleDispatch(type, data, mq))
      yield* Effect.tryPromise({
        try: () => client.start(url),
        catch: (err) => new GatewayError("NETWORK_ERROR", `QQ WS start failed: ${(err as Error).message}`),
      })
      self.ws = client
      console.log("[QQAdapter] QQ 长连接已启动")
    })
  }

  stop(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.ws?.stop()
      this.ws = null
      console.log("[QQAdapter] QQ 长连接已停止")
    })
  }

  setQueue(q: Queue.Queue<GatewayMessage>): void {
    this._queue = q
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> {
    if (!this._queue) return Stream.fail(new GatewayError("INTERNAL_ERROR", "Queue not initialized"))
    return Stream.fromQueue(this._queue)
  }

  /** 发送消息（按 chatId 前缀区分频道/C2C） */
  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      const id = yield* Effect.tryPromise({
        try: async () => {
          // 简化策略：默认按频道消息发送；chatId 以 "c2c:" 开头时走 C2C
          if (msg.chatId.startsWith("c2c:")) {
            const openId = msg.chatId.slice(4)
            const result = await Effect.runPromise(sendC2CMessage(self.cfg.token, openId, msg.content))
            return result.id
          }
          const result = await Effect.runPromise(sendChannelMessage(self.cfg.token, msg.chatId, msg.content))
          return result.id
        },
        catch: (err) => new GatewayError("NETWORK_ERROR", `QQ send failed: ${(err as Error).message}`),
      })
      return { platformMessageId: id, timestamp: Date.now() }
    })
  }

  /**
   * 处理 Dispatch 事件：目前支持 AT_MESSAGE_CREATE（频道 @机器人）
   */
  private handleDispatch(type: string, data: unknown, queue: Queue.Queue<GatewayMessage>): void {
    try {
      if (type === "AT_MESSAGE_CREATE" || type === "MESSAGE_CREATE" || type === "C2C_MESSAGE_CREATE") {
        const msg = parseQQMessage(type, data as Record<string, unknown>, this.cfg.appId)
        if (msg) Effect.runFork(Queue.offer(queue, { ...msg, sourceAdapter: "qq" }))
      }
    } catch (err) {
      console.error("[QQAdapter] dispatch error:", err)
    }
  }
}

/**
 * 解析 QQ 消息事件为 GatewayMessage
 */
export function parseQQMessage(type: string, d: Record<string, unknown>, botId?: string): GatewayMessage | undefined {
  const author = d.author as Record<string, unknown> | undefined
  const channelId = (d.channel_id as string) || (d.guild_id as string) || ""
  const content0 = (d.content as string) ?? ""
  let chatId = channelId
  if (type === "C2C_MESSAGE_CREATE") {
    chatId = `c2c:${(author?.id as string) ?? ""}`
  }
  const content = stripAtMentions(content0, botId)
  const isGroup = type !== "C2C_MESSAGE_CREATE"
  return {
    id: (d.id as string) ?? `qq_${Date.now()}`,
    platform: "qq",
    type: "text",
    content,
    sender: {
      id: (author?.id as string) ?? "",
      name: (author?.username as string) ?? "qq-user",
    },
    chat: { id: chatId, type: isGroup ? "group" : "private" },
    timestamp: Date.parse((d.timestamp as string) ?? "") || Date.now(),
    raw: d,
  }
}
