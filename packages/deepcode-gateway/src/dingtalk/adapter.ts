/**
 * 钉钉 adapter
 *
 * 入站：自定义机器人 outgoing webhook POST /webhook/dingtalk
 *       （可选 ?sign=...&timestamp=... 校验）
 * 出站：POST 机器人 webhook URL（自动加签）
 *
 * @module dingtalk/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { DingTalkConfig } from "../config"
import { sendRobotMessage, getAccessToken } from "./api"

export class DingTalkAdapter implements PlatformAdapter {
  readonly name = "dingtalk" as const
  private cfg: DingTalkConfig
  private tokenCache: { token: string; expiry: number } | null = null
  constructor(config: DingTalkConfig) { this.cfg = config }

  getSignSecret(): string | undefined { return this.cfg.signSecret }
  getToken(): string | undefined { return this.cfg.token }
  getAppKey(): string { return this.cfg.appKey }
  getAppSecret(): string { return this.cfg.appSecret }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { this.tokenCache = null; return Effect.void }

  /**
   * send 逻辑：
   * - 如果 OutboundMessage.chatId 是一个 webhook URL，直接用机器人 webhook 发送
   * - 否则使用 access_token 走工作通知接口（此处未完整实现，预留）
   */
  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      if (msg.chatId.startsWith("http")) {
        yield* sendRobotMessage(msg.chatId, self.cfg.signSecret, msg.content).pipe(
          Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
        )
        return { platformMessageId: `dt_${Date.now()}`, timestamp: Date.now() }
      }
      // 工作通知模式（占位：需要 access_token）
      yield* self.obtainToken()
      // 仅做占位返回；真实调用 topapi/message/corpconversation/asyncsend_v2 略
      return { platformMessageId: `dt_${Date.now()}`, timestamp: Date.now() }
    })
  }

  private obtainToken(): Effect.Effect<string, GatewayError> {
    if (this.tokenCache && this.tokenCache.expiry > Date.now()) {
      return Effect.succeed(this.tokenCache.token)
    }
    const self = this
    return Effect.gen(function* () {
      const token = yield* getAccessToken(self.cfg.appKey, self.cfg.appSecret).pipe(
        Effect.mapError((e) => new GatewayError("AUTH_ERROR", e.message)),
      )
      self.tokenCache = { token, expiry: Date.now() + 7000 * 1000 }
      return token
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> { return Stream.empty }
}
