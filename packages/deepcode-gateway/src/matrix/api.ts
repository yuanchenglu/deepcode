/**
 * Matrix Client-Server API 出站
 *
 * PUT {homeserver}/_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}
 * Authorization: Bearer {accessToken}
 * Body: { msgtype: "m.text", body: "..." }
 *
 * @module matrix/api
 */

import { Effect } from "effect"

export function sendMessage(
  homeserverUrl: string,
  accessToken: string,
  roomId: string,
  text: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const txnId = `deepcode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const url = `${homeserverUrl.replace(/\/$/, "")}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ msgtype: "m.text", body: text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
    catch: (cause) => new Error(`Matrix sendMessage: ${(cause as Error).message}`),
  })
}
