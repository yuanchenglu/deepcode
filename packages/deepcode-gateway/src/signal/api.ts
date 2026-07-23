/**
 * Signal-cli REST API 出站
 *
 * signal-cli REST API（bbernhard/signal-cli-rest-api 风格）发送消息：
 *   POST /v2/send
 *   { "number": "<本端账号>", "recipients": ["+xxx"], "message": "..." }
 *
 * @module signal/api
 */

import { Effect } from "effect"

export function sendMessage(
  endpoint: string,
  account: string,
  recipient: string,
  message: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/v2/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: account, recipients: [recipient], message }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
    catch: (cause) => new Error(`Signal sendMessage: ${(cause as Error).message}`),
  })
}
