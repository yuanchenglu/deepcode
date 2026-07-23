/**
 * 钉钉消息解析
 *
 * 自定义机器人 outgoing 回调体：
 * { "msgtype": "text", "text": { "content": "..." }, "senderId": "...", "senderNick": "...",
 *   "conversationId": "...", "conversationType": "1"|"2", "msgId": "...", "createAt": 123 }
 *
 * 企业事件回调（stream 模式）body：
 * { "EventType": "chat_message", "msgtype": "text", "text": { "content": "..." },
 *   "senderId": "...", "chatbotCorpId": "...", "conversationId": "...", "msgId": "...", "timestamp": ... }
 *
 * @module dingtalk/parser
 */

import type { GatewayMessage, ChatType, MessageType } from "../message"

export interface DingRobotBody {
  readonly msgtype?: string
  readonly text?: { readonly content?: string }
  readonly content?: string
  readonly senderId?: string
  readonly senderNick?: string
  readonly conversationId?: string
  readonly conversationType?: string // "1"=单聊, "2"=群聊
  readonly msgId?: string
  readonly createAt?: number
  readonly timestamp?: number
  readonly EventType?: string
}

export function parse(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const b = body as DingRobotBody
  const msgType = b.msgtype ?? (b.EventType ? "event" : "text")
  let type: MessageType = "text"
  let content = b.text?.content ?? b.content ?? ""
  if (msgType === "text") {
    type = "text"
  } else if (msgType === "picture" || msgType === "image") {
    type = "image"
  } else if (b.EventType) {
    type = "event"
    content = b.EventType
  } else {
    type = "event"
  }
  const chatType: ChatType = b.conversationType === "2" ? "group" : "private"
  return {
    id: b.msgId ?? `dt_${b.createAt ?? Date.now()}`,
    platform: "dingtalk",
    type,
    content,
    sender: { id: b.senderId ?? "unknown", name: b.senderNick ?? b.senderId ?? "unknown" },
    chat: { id: b.conversationId ?? "unknown", type: chatType },
    timestamp: b.createAt ?? b.timestamp ?? Date.now(),
    raw: body,
  }
}
