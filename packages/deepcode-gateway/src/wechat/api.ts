/**
 * DeepCode 消息网关 — 企业微信 API 封装
 *
 * @module
 */

import { Effect } from "effect"

const BASE_URL = "https://qyapi.weixin.qq.com/cgi-bin"

export function getAccessToken(corpId: string, corpSecret: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string }
      if (data.errcode !== 0) throw new Error(`API ${data.errcode}: ${data.errmsg}`)
      return data.access_token!
    },
    catch: (cause) => new Error(`WeChat getAccessToken: ${(cause as Error).message}`),
  })
}

export function sendTextMessage(token: string, toUser: string, agentId: string, content: string): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/message/send?access_token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touser: toUser, msgtype: "text", agentid: agentId, text: { content } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { errcode?: number; errmsg?: string }
      if (data.errcode !== 0) throw new Error(`API ${data.errcode}: ${data.errmsg}`)
    },
    catch: (cause) => new Error(`WeChat sendTextMessage: ${(cause as Error).message}`),
  })
}
