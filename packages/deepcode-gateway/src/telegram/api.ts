/**
 * Telegram Bot REST API 封装
 *
 * - sendMessage：POST https://api.telegram.org/bot<token>/sendMessage
 *
 * @module telegram/api
 */

import { Effect } from "effect"

const BASE = "https://api.telegram.org"

export interface TgSendResult {
  readonly ok: boolean
  readonly result?: { message_id: number }
  readonly description?: string
}

/** 发送文本消息 */
export function sendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as TgSendResult
      if (!data.ok) throw new Error(`API error: ${data.description ?? "unknown"}`)
    },
    catch: (cause) => new Error(`Telegram sendMessage: ${(cause as Error).message}`),
  })
}
