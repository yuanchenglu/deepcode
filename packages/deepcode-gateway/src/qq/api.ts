/**
 * DeepCode 消息网关 — QQ 官方机器人 API 封装
 *
 * 参考：https://bot.q.qq.com/wiki/develop/api/
 *
 * @module qq/api
 */

import { Effect } from "effect"

/** QQ OpenAPI 基础地址 */
const BASE = "https://api.sgroup.qq.com"

/**
 * 获取机器人 Gateway WebSocket 地址
 */
export function getGatewayUrl(token: string, sandbox = false): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      // 沙箱：api.sgroup.qq.com/sandbox
      const url = sandbox ? `${BASE}/gateway` : `${BASE}/gateway`
      const res = await fetch(url, {
        headers: { Authorization: `QQBot ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error("no gateway url in response")
      return data.url
    },
    catch: (cause) => new Error(`QQ getGatewayUrl: ${(cause as Error).message}`),
  })
}

/**
 * 发送消息到频道（channels API）
 */
export function sendChannelMessage(
  token: string,
  channelId: string,
  content: string,
): Effect.Effect<{ id: string }, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `QQBot ${token}`,
        },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { id?: string; code?: number; message?: string }
      if (data.code && data.code !== 0) throw new Error(`API ${data.code}: ${data.message}`)
      return { id: data.id ?? `qq_${Date.now()}` }
    },
    catch: (cause) => new Error(`QQ sendChannelMessage: ${(cause as Error).message}`),
  })
}

/**
 * 发送 C2C 私聊消息（v2 API）
 */
export function sendC2CMessage(
  token: string,
  openId: string,
  content: string,
): Effect.Effect<{ id: string }, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE}/v2/users/${openId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `QQBot ${token}`,
        },
        body: JSON.stringify({ content, msg_type: 0 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { id?: string; code?: number; message?: string }
      if (data.code && data.code !== 0) throw new Error(`API ${data.code}: ${data.message}`)
      return { id: data.id ?? `qq_${Date.now()}` }
    },
    catch: (cause) => new Error(`QQ sendC2CMessage: ${(cause as Error).message}`),
  })
}
