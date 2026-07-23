/**
 * Matrix adapter
 *
 * 入站：Application Service transaction POST /webhook/matrix/transactions/{txnId}
 *       Authorization: Bearer <hsToken>
 * 出站：PUT /rooms/{roomId}/send/m.room.message/{txnId} Bearer access_token
 *
 * @module matrix/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { MatrixConfig } from "../config"
import { sendMessage } from "./api"

export class MatrixAdapter implements PlatformAdapter {
  readonly name = "matrix" as const
  private cfg: MatrixConfig
  constructor(config: MatrixConfig) { this.cfg = config }

  getHomeserverUrl(): string { return this.cfg.homeserver }
  getAccessToken(): string { return this.cfg.accessToken }
  getUserId(): string { return this.cfg.userId }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { return Effect.void }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      yield* sendMessage(self.cfg.homeserver, self.cfg.accessToken, msg.chatId, msg.content).pipe(
        Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
      )
      return { platformMessageId: `mx_${Date.now()}`, timestamp: Date.now() }
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> { return Stream.empty }
}
