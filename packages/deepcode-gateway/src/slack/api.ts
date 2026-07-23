/**
 * Slack Web API 封装
 *
 * - chat.postMessage → 发送消息到 channel
 *
 * @module slack/api
 */

import { Effect } from "effect"

const BASE = "https://slack.com/api"

export function sendMessage(
  botToken: string,
  channel: string,
  text: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE}/chat.postMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify({ channel, text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) throw new Error(`Slack API error: ${data.error}`)
    },
    catch: (cause) => new Error(`Slack sendMessage: ${(cause as Error).message}`),
  })
}
