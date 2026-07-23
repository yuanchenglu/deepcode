/**
 * Slack adapter
 *
 * 入站：
 *  - Events API webhook（JSON, X-Slack-Signature 校验）
 *  - Slash Commands（application/x-www-form-urlencoded）
 * 出站：chat.postMessage REST API
 *
 * @module slack/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { SlackConfig } from "../config"
import { sendMessage } from "./api"

export class SlackAdapter implements PlatformAdapter {
  readonly name = "slack" as const
  private cfg: SlackConfig

  constructor(config: SlackConfig) {
    this.cfg = config
  }

  getSigningSecret(): string { return this.cfg.signingSecret }
  getBotToken(): string { return this.cfg.botToken }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { return Effect.void }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      yield* sendMessage(self.cfg.botToken, msg.chatId, msg.content).pipe(
        Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
      )
      return { platformMessageId: `slack_${Date.now()}`, timestamp: Date.now() }
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> { return Stream.empty }
}
