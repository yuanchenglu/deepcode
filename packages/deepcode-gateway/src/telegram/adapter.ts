/**
 * Telegram Bot adapter
 *
 * 入站：webhook POST /webhook/telegram，body 是 Bot API Update 对象；
 *       通过 X-Telegram-Bot-Api-Secret-Token 头校验。
 * 出站：sendMessage REST API。
 *
 * @module telegram/adapter
 */

import { Effect, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { OutboundMessage, SendResult, GatewayMessage } from "../message"
import { GatewayError } from "../error"
import type { TelegramConfig } from "../config"
import { sendMessage } from "./api"

export class TelegramAdapter implements PlatformAdapter {
  readonly name = "telegram" as const
  private cfg: TelegramConfig

  constructor(config: TelegramConfig) {
    this.cfg = config
  }

  getSecretToken(): string | undefined {
    return this.cfg.secretToken
  }
  getBotToken(): string {
    return this.cfg.botToken
  }

  start(): Effect.Effect<void, GatewayError> {
    // webhook 由 HTTP server 托管，这里不需要启动循环
    return Effect.void
  }
  stop(): Effect.Effect<void> {
    return Effect.void
  }

  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      yield* sendMessage(self.cfg.botToken, msg.chatId, msg.content).pipe(
        Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
      )
      return { platformMessageId: `tg_${Date.now()}`, timestamp: Date.now() }
    })
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> {
    return Stream.empty
  }
}
