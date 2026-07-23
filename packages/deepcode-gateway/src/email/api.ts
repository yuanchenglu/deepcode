/**
 * SendGrid v3 Mail Send 出站
 *
 * POST https://api.sendgrid.com/v3/mail/send
 * Authorization: Bearer <SENDGRID_API_KEY>
 *
 * @module email/api
 */

import { Effect } from "effect"

export function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content: [{ type: "text/plain", value: text }],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
    catch: (cause) => new Error(`Email sendEmail: ${(cause as Error).message}`),
  })
}
