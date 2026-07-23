/**
 * 钉钉 REST API
 *
 * - getAccessToken：https://oapi.dingtalk.com/gettoken?appkey=...&appsecret=...
 * - sendMessage（群机器人 webhook 模式）：POST 到机器人 webhook URL（含 sign）
 * - 工作通知消息：/topapi/message/corpconversation/asyncsend_v2
 *
 * 这里只实现机器人 webhook 发送，最常用。
 *
 * @module dingtalk/api
 */

import { Effect } from "effect"
import { signRobot } from "./crypto"

const BASE = "https://oapi.dingtalk.com"

export function getAccessToken(appKey: string, appSecret: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE}/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string }
      if (data.errcode !== 0) throw new Error(`API ${data.errcode}: ${data.errmsg}`)
      return data.access_token!
    },
    catch: (cause) => new Error(`DingTalk getAccessToken: ${(cause as Error).message}`),
  })
}

/**
 * 发送群机器人消息（自定义机器人 webhook）
 * @param webhookUrl  机器人 webhook URL（不含 sign 参数）
 * @param secret      机器人签名密钥（可选）
 * @param content     文本内容
 */
export function sendRobotMessage(
  webhookUrl: string,
  secret: string | undefined,
  content: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      let url = webhookUrl
      if (secret) {
        const ts = String(Date.now())
        const sig = encodeURIComponent(signRobot(secret, ts))
        url += `${url.includes("?") ? "&" : "?"}timestamp=${ts}&sign=${sig}`
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msgtype: "text", text: { content } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
    catch: (cause) => new Error(`DingTalk sendRobotMessage: ${(cause as Error).message}`),
  })
}
