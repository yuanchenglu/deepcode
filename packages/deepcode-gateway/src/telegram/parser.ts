/**
 * Telegram Bot API webhook 事件解析
 *
 * Telegram webhook body 是 Bot API 的 Update 对象：
 * {
 *   update_id: 123,
 *   message?: { message_id, from: {id, first_name, username}, chat: {id, type: 'private'|'group'|'supergroup'}, text, date },
 *   edited_message?: ...,
 *   callback_query?: ...,
 *   ...
 * }
 *
 * @module telegram/parser
 */

import type { GatewayMessage, MessageType, ChatType } from "../message"

/** Telegram Update 结构（节选） */
export interface TgUpdate {
  readonly update_id: number
  readonly message?: TgMessage
  readonly edited_message?: TgMessage
  readonly channel_post?: TgMessage
  readonly callback_query?: TgCallbackQuery
}
export interface TgUser {
  readonly id: number
  readonly first_name?: string
  readonly username?: string
  readonly last_name?: string
}
export interface TgChat {
  readonly id: number
  readonly type: "private" | "group" | "supergroup" | "channel"
  readonly title?: string
}
export interface TgMessage {
  readonly message_id: number
  readonly from?: TgUser
  readonly chat: TgChat
  readonly date: number
  readonly text?: string
  readonly caption?: string
  readonly photo?: unknown
  readonly document?: unknown
}
export interface TgCallbackQuery {
  readonly id: string
  readonly from: TgUser
  readonly message?: TgMessage
  readonly data?: string
}

/**
 * 把 Telegram Update 解析为 GatewayMessage
 *
 * - message/edited_message/channel_post → text/image/file/event
 * - callback_query → event 类型，内容为 data
 * - 其他 Update 返回 undefined
 */
export function parseUpdate(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const u = body as TgUpdate
  let msg: TgMessage | undefined
  let type: MessageType = "text"
  let content = ""
  let id = `tg_${u.update_id ?? Date.now()}`

  if (u.message) {
    msg = u.message
  } else if (u.edited_message) {
    msg = u.edited_message
  } else if (u.channel_post) {
    msg = u.channel_post
  } else if (u.callback_query) {
    const cq = u.callback_query
    return {
      id: `tg_cb_${cq.id}`,
      platform: "telegram",
      type: "event",
      content: cq.data ?? "",
      sender: { id: String(cq.from.id), name: displayName(cq.from) },
      chat: { id: String(cq.message?.chat.id ?? cq.from.id), type: "private" },
      timestamp: Math.floor(Date.now() / 1000) * 1000,
      raw: u,
    }
  } else {
    return undefined
  }

  if (!msg) return undefined
  id = `tg_${msg.message_id}`
  if (msg.text) {
    type = "text"
    content = msg.text
  } else if (msg.caption) {
    type = "text"
    content = msg.caption
  } else if (msg.photo) {
    type = "image"
    content = "[photo]"
  } else if (msg.document) {
    type = "file"
    content = "[document]"
  } else {
    type = "event"
    content = "[unknown message type]"
  }

  const chatType: ChatType = msg.chat.type === "private" ? "private" : "group"
  return {
    id,
    platform: "telegram",
    type,
    content,
    sender: { id: String(msg.from?.id ?? 0), name: msg.from ? displayName(msg.from) : "unknown" },
    chat: { id: String(msg.chat.id), type: chatType },
    timestamp: msg.date * 1000,
    raw: u,
  }
}

function displayName(u: TgUser): string {
  if (u.username) return u.username
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ")
  return name || String(u.id)
}

/**
 * 检查是否是 `/start` 命令消息（验收点 5）
 */
export function isStartCommand(m: GatewayMessage): boolean {
  return m.platform === "telegram" && m.type === "text" && m.content.trim().startsWith("/start")
}
