/**
 * DeepCode 消息网关 — 企业微信 API 封装
 *
 * @module wecom/api
 */

import { Effect } from "effect"

const BASE_URL = "https://qyapi.weixin.qq.com/cgi-bin"

/**
 * 获取 access_token（缓存 7200s，调用方负责缓存）
 */
export function getAccessToken(corpId: string, corpSecret: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string }
      if (data.errcode !== 0) throw new Error(`API ${data.errcode}: ${data.errmsg}`)
      return data.access_token!
    },
    catch: (cause) => new Error(`WeCom getAccessToken: ${(cause as Error).message}`),
  })
}

/**
 * 发送文本消息
 */
export function sendTextMessage(
  token: string,
  toUser: string,
  agentId: string,
  content: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/message/send?access_token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touser: toUser,
          msgtype: "text",
          agentid: agentId,
          text: { content },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { errcode?: number; errmsg?: string }
      if (data.errcode !== 0) throw new Error(`API ${data.errcode}: ${data.errmsg}`)
    },
    catch: (cause) => new Error(`WeCom sendTextMessage: ${(cause as Error).message}`),
  })
}
