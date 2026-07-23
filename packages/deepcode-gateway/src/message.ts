/**
 * DeepCode 消息网关 — 统一消息模型
 *
 * @module
 */

export type PlatformType = "feishu" | "wechat" | "terminal" | "wecom" | "qq" | "telegram" | "slack" | "signal" | "whatsapp" | "dingtalk" | "matrix" | "email"
export type MessageType = "text" | "image" | "file" | "event"
export type ChatType = "private" | "group"

export interface GatewayMessage {
  readonly id: string
  readonly platform: PlatformType
  readonly type: MessageType
  readonly content: string
  readonly sender: { readonly id: string; readonly name: string }
  readonly chat: { readonly id: string; readonly type: ChatType }
  readonly timestamp: number
  readonly raw?: unknown
  readonly sourceAdapter?: PlatformType
}

export type OutboundType = "text" | "image" | "card"

export interface OutboundMessage {
  readonly chatId: string
  readonly type: OutboundType
  readonly content: string
  readonly imageUrl?: string
}

export interface SendResult {
  readonly platformMessageId: string
  readonly timestamp: number
}
