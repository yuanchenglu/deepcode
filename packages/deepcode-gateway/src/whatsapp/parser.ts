/**
 * WhatsApp Business Cloud API webhook 事件解析
 *
 * webhook body 结构：
 * {
 *   object: "whatsapp_business_account",
 *   entry: [{
 *     id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
 *     changes: [{
 *       value: {
 *         messaging_product: "whatsapp",
 *         metadata: { display_phone_number, phone_number_id },
 *         messages?: [{ from: "+111", id: "wamid...", timestamp: "...", text?: { body: "..." }, type: "text"|"image"|... }],
 *         statuses?: [{ id, status, ... }]
 *       },
 *       field: "messages"
 *     }]
 *   }]
 * }
 *
 * @module whatsapp/parser
 */

import type { GatewayMessage, ChatType, MessageType } from "../message"

export interface WaWebhookBody {
  readonly object?: string
  readonly entry?: ReadonlyArray<{
    readonly changes?: ReadonlyArray<{
      readonly value?: {
        readonly messaging_product?: string
        readonly metadata?: { readonly display_phone_number?: string; readonly phone_number_id?: string }
        readonly messages?: ReadonlyArray<{
          readonly id?: string
          readonly from?: string
          readonly timestamp?: string
          readonly type?: string
          readonly text?: { readonly body?: string }
          readonly image?: { readonly id?: string; readonly mime_type?: string }
        }>
      }
    }>
  }>
}

/** 校验 webhook URL 验证请求参数 */
export interface WaVerifyQuery {
  readonly "hub.mode"?: string
  readonly "hub.verify_token"?: string
  readonly "hub.challenge"?: string
}
export function extractChallenge(query: WaVerifyQuery, verifyToken: string): string | null {
  if (query["hub.mode"] !== "subscribe") return null
  if (query["hub.verify_token"] !== verifyToken) return null
  return query["hub.challenge"] ?? null
}

export function parseWebhook(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const b = body as WaWebhookBody
  if (b.object !== "whatsapp_business_account") return undefined
  const entry = b.entry?.[0]
  const change = entry?.changes?.[0]
  const value = change?.value
  const msgs = value?.messages
  if (!msgs || msgs.length === 0) return undefined // statuses 类更新忽略
  const msg = msgs[0]!
  let type: MessageType = "text"
  let content = ""
  switch (msg.type) {
    case "text":
      type = "text"
      content = msg.text?.body ?? ""
      break
    case "image":
      type = "image"
      content = msg.image?.id ?? "[image]"
      break
    default:
      type = "event"
      content = `[${msg.type ?? "unknown"}]`
  }
  const phone = msg.from ?? "unknown"
  const chatType: ChatType = "private" // WA Cloud webhook 消息默认私聊
  return {
    id: msg.id ?? `wa_${Date.now()}`,
    platform: "whatsapp",
    type,
    content,
    sender: { id: phone, name: `+${phone}` },
    chat: { id: phone, type: chatType },
    timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
    raw: body,
  }
}
