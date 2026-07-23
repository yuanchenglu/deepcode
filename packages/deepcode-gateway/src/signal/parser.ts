/**
 * Signal (via signal-cli REST API) 消息解析
 *
 * signal-cli 运行 REST mode（signald / signal-cli-rest-api）时，收到的 envelope 结构：
 * {
 *   "envelope": {
 *     "source": "+15551234567",
 *     "sourceName": "Alice",
 *     "sourceNumber": "+15551234567",
 *     "dataMessage": { "message": "hi", "timestamp": 1700000000000, "groupInfo": { "groupId": "base64group" } }
 *   }
 * }
 *
 * @module signal/parser
 */

import type { GatewayMessage, ChatType } from "../message"

export interface SignalEnvelope {
  readonly envelope?: {
    readonly source?: string
    readonly sourceName?: string
    readonly sourceNumber?: string
    readonly dataMessage?: {
      readonly message?: string
      readonly timestamp?: number
      readonly groupInfo?: { readonly groupId?: string }
      readonly attachments?: ReadonlyArray<unknown>
    }
    readonly syncMessage?: unknown
    readonly receiptMessage?: unknown
    readonly typingMessage?: unknown
  }
}

export function parseEnvelope(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const b = body as SignalEnvelope
  const env = b.envelope
  if (!env) return undefined
  const dm = env.dataMessage
  // 过滤非消息类 envelope（typing / receipt / sync）
  if (!dm) return undefined
  const text = dm.message ?? ""
  const senderId = env.sourceNumber ?? env.source ?? "unknown"
  const senderName = env.sourceName ?? senderId
  const isGroup = !!dm.groupInfo?.groupId
  const chatType: ChatType = isGroup ? "group" : "private"
  const chatId = isGroup ? `signal:group:${dm.groupInfo!.groupId}` : `signal:dm:${senderId}`
  return {
    id: `signal_${dm.timestamp ?? Date.now()}`,
    platform: "signal",
    type: "text",
    content: text,
    sender: { id: senderId, name: senderName },
    chat: { id: chatId, type: chatType },
    timestamp: dm.timestamp ?? Date.now(),
    raw: body,
  }
}
