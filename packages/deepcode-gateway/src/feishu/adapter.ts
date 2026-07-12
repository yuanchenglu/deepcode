import { Effect, Stream, Queue } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { GatewayMessage, OutboundMessage, SendResult } from "../message"
import { GatewayError } from "../error"
import type { FeishuConfig } from "../config"
import { getTenantAccessToken, sendMessage } from "./api"

export class FeishuAdapter implements PlatformAdapter {
  readonly name = "feishu"
  private cfg: FeishuConfig
  private _queue: Queue.Queue<GatewayMessage> | null = null
  private tokenCache: { token: string; expiry: number } | null = null
  constructor(config: FeishuConfig) { this.cfg = config }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { return Effect.void }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      const token = yield* self.getToken()
      yield* sendMessage(token, msg.chatId, msg.content).pipe(Effect.mapError(() => new GatewayError("NETWORK_ERROR", "send failed")))
      return { platformMessageId: `feishu_${Date.now()}`, timestamp: Date.now() }
    })
  }

  private getToken(): Effect.Effect<string, GatewayError> {
    if (this.tokenCache && this.tokenCache.expiry > Date.now()) return Effect.succeed(this.tokenCache.token)
    const self = this
    return Effect.gen(function* () {
      const token = yield* getTenantAccessToken(self.cfg.appId, self.cfg.appSecret).pipe(Effect.mapError((e) => new GatewayError("AUTH_ERROR", e.message)))
      self.tokenCache = { token, expiry: Date.now() + 55 * 60 * 1000 }
      return token
    })
  }

  setQueue(q: Queue.Queue<GatewayMessage>): void { this._queue = q }
  get messages(): Stream.Stream<GatewayMessage, GatewayError> {
    if (!this._queue) return Stream.fail(new GatewayError("INTERNAL_ERROR", "Queue not initialized"))
    return Stream.fromQueue(this._queue)
  }
}
