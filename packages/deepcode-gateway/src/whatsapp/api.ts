/**
 * WhatsApp Business Cloud API 出站
 *
 * POST https://graph.facebook.com/v{version}/{phone_number_id}/messages
 * Authorization: Bearer <access_token>
 *
 * @module whatsapp/api
 */

import { Effect } from "effect"

const BASE = "https://graph.facebook.com"

export function sendTextMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  text: string,
  apiVersion = "v18.0",
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE}/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          text: { body: text },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { error?: { message?: string } }
      if (data.error) throw new Error(`WA API error: ${data.error.message}`)
    },
    catch: (cause) => new Error(`WhatsApp send: ${(cause as Error).message}`),
  })
}
