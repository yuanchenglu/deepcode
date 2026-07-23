/**
 * WhatsApp Business Cloud API adapter
 *
 * 入站：webhook POST /webhook/whatsapp（X-Hub-Signature-256 校验）
 *       GET  /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * 出站：REST /v18.0/{phone_number_id}/messages
 *
 * @module whatsapp/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { WhatsAppConfig } from "../config"
import { sendTextMessage } from "./api"

export class WhatsAppAdapter implements PlatformAdapter {
  readonly name = "whatsapp" as const
  private cfg: WhatsAppConfig
  constructor(config: WhatsAppConfig) { this.cfg = config }

  getAppSecret(): string | undefined { return this.cfg.appSecret }
  getVerifyToken(): string { return this.cfg.verifyToken ?? "" }
  getPhoneNumberId(): string { return this.cfg.phoneNumberId }
  getAccessToken(): string { return this.cfg.apiKey }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { return Effect.void }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      yield* sendTextMessage(
        self.cfg.apiKey,
        self.cfg.phoneNumberId,
        msg.chatId,
        msg.content,
      ).pipe(Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)))
      return { platformMessageId: `wa_${Date.now()}`, timestamp: Date.now() }
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> { return Stream.empty }
}
