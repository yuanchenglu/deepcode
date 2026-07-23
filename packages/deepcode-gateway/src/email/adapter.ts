/**
 * Email adapter (SendGrid Inbound Parse + Send API)
 *
 * 入站：SendGrid Inbound Parse POST /webhook/email（URL-encoded/multipart）
 *       可选 X-Email-Webhook-Signature 校验
 * 出站：SendGrid v3 /mail/send
 *
 * @module email/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { EmailConfig } from "../config"
import { sendEmail } from "./api"

export class EmailAdapter implements PlatformAdapter {
  readonly name = "email" as const
  private cfg: EmailConfig
  constructor(config: EmailConfig) { this.cfg = config }

  getWebhookSecret(): string | undefined { return this.cfg.webhookSecret }
  getSendgridApiKey(): string | undefined { return this.cfg.sendgridApiKey }
  getFromAddress(): string { return this.cfg.fromAddress ?? "gateway@deepcode.local" }

  start(): Effect.Effect<void, GatewayError> { return Effect.void }
  stop(): Effect.Effect<void> { return Effect.void }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      const apiKey = self.cfg.sendgridApiKey
      if (!apiKey) return { platformMessageId: `email_${Date.now()}_dryrun`, timestamp: Date.now() }
      // OutboundMessage.chatId 作为收件人；content 作为正文；subject 固定前缀
      yield* sendEmail(apiKey, self.getFromAddress(), msg.chatId, "DeepCode Gateway Reply", msg.content).pipe(
        Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
      )
      return { platformMessageId: `email_${Date.now()}`, timestamp: Date.now() }
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> { return Stream.empty }
}
