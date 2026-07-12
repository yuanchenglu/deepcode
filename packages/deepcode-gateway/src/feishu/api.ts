/**
 * DeepCode 消息网关 — 飞书 Open API 封装
 *
 * @module
 */

import { Effect } from "effect"

const BASE_URL = "https://open.feishu.cn/open-apis"

export function getTenantAccessToken(appId: string, appSecret: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/auth/v3/tenant_access_token/internal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { tenant_access_token?: string; code?: number; msg?: string }
      if (data.code !== 0) throw new Error(`API ${data.code}: ${data.msg}`)
      return data.tenant_access_token!
    },
    catch: (cause) => new Error(`Feishu getTenantAccessToken: ${(cause as Error).message}`),
  })
}

export function sendMessage(token: string, receiveId: string, content: string): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/im/v1/messages?receive_id_type=open_id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receive_id: receiveId, msg_type: "text", content: JSON.stringify({ text: content }) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { code?: number; msg?: string }
      if (data.code !== 0) throw new Error(`API ${data.code}: ${data.msg}`)
    },
    catch: (cause) => new Error(`Feishu sendMessage: ${(cause as Error).message}`),
  })
}
