/**
 * Matrix Client-Server API 事件解析
 *
 * Application Service 模式下，homeserver 把事件 POST 到 gateway：
 * POST /transactions/{txnId}
 * { "events": [
 *     {
 *       "type": "m.room.message",
 *       "sender": "@alice:matrix.org",
 *       "room_id": "!abc:matrix.org",
 *       "content": { "msgtype": "m.text", "body": "hi" },
 *       "event_id": "$ev1",
 *       "origin_server_ts": 1700000000000
 *     }
 *   ]
 * }
 *
 * @module matrix/parser
 */

import type { GatewayMessage, ChatType, MessageType } from "../message"

export interface MatrixEvent {
  readonly type?: string
  readonly sender?: string
  readonly room_id?: string
  readonly event_id?: string
  readonly origin_server_ts?: number
  readonly content?: {
    readonly msgtype?: string
    readonly body?: string
    readonly url?: string
  }
}
export interface MatrixTransaction {
  readonly events?: ReadonlyArray<MatrixEvent>
}

/**
 * 解析 Matrix transaction body → GatewayMessage 数组（一条 transaction 可能含多事件）
 */
export function parseTransaction(body: unknown): GatewayMessage[] {
  if (!body || typeof body !== "object") return []
  const b = body as MatrixTransaction
  if (!Array.isArray(b.events)) return []
  const out: GatewayMessage[] = []
  for (const ev of b.events) {
    if (!ev) continue
    if (ev.type !== "m.room.message") continue
    const msg = toGatewayMessage(ev)
    if (msg) out.push(msg)
  }
  return out
}

function toGatewayMessage(ev: MatrixEvent): GatewayMessage | undefined {
  const content = ev.content
  if (!content) return undefined
  let type: MessageType = "text"
  let text = content.body ?? ""
  if (content.msgtype === "m.text" || content.msgtype === "m.notice") {
    type = "text"
  } else if (content.msgtype === "m.image") {
    type = "image"
    text = content.url ?? "[image]"
  } else {
    type = "event"
  }
  const chatType: ChatType = ev.room_id ? "group" : "private"
  return {
    id: ev.event_id ?? `mx_${Date.now()}`,
    platform: "matrix",
    type,
    content: text,
    sender: { id: ev.sender ?? "unknown", name: ev.sender ?? "unknown" },
    chat: { id: ev.room_id ?? ev.sender ?? "unknown", type: chatType },
    timestamp: ev.origin_server_ts ?? Date.now(),
    raw: ev,
  }
}

/**
 * Matrix access token 校验（Bearer Token）
 */
export function verifyBearer(expected: string | undefined, actual: string | null): boolean {
  if (!expected) return true
  if (!actual) return false
  if (!actual.startsWith("Bearer ")) return false
  const token = actual.slice(7)
  if (token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
