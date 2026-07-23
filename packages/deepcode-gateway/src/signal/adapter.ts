/**
 * Signal adapter (via signal-cli REST API)
 *
 * 入站：本地 signal-cli 转发 envelope JSON 到 /webhook/signal
 * 出站：REST API v2/send
 *
 * @module signal/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { SignalConfig } from "../config"
import { sendMessage } from "./api"

export class SignalAdapter implements PlatformAdapter {
  readonly name = "signal" as const
  private cfg: SignalConfig
  constructor(config: SignalConfig) { this.cfg = config }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { return Effect.void }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      // chatId 格式是 "signal:dm:<number>" 或 "signal:group:<id>"
      const recipient = msg.chatId.startsWith("signal:dm:") ? msg.chatId.slice(10) : msg.chatId
      yield* sendMessage(self.cfg.apiBase, self.cfg.phoneNumber, recipient, msg.content).pipe(
        Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
      )
      return { platformMessageId: `sig_${Date.now()}`, timestamp: Date.now() }
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> { return Stream.empty }
}
