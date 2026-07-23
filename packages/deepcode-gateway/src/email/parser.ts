/**
 * Email webhook 解析（SendGrid Inbound Parse 格式）
 *
 * SendGrid inbound Parse POST multipart/form-data 或 URL-encoded，包含字段：
 *   from, to, subject, text, html, envelope (JSON), sender, charsets, attachments (N), ...
 *
 * Mailgun 类似：from, to, subject, body-plain, body-html...
 *
 * 本 parser 兼容 SendGrid 为主的字段名。
 *
 * @module email/parser
 */

import type { GatewayMessage, ChatType } from "../message"

export interface InboundFields {
  readonly from?: string
  readonly to?: string
  readonly subject?: string
  readonly text?: string
  readonly html?: string
  readonly envelope?: string
}

export function parseInbound(fields: InboundFields): GatewayMessage | undefined {
  const from = fields.from
  if (!from) return undefined
  // 提取 from 中 email: "Name <a@b.com>" → a@b.com
  const email = extractEmail(from)
  const to = fields.to ? extractEmail(fields.to) : "gateway"
  const subject = fields.subject ?? ""
  const text = fields.text ?? ""
  const content = subject ? `[${subject}] ${text}`.trim() : text
  return {
    id: `email_${Date.now()}`,
    platform: "email",
    type: "text",
    content,
    sender: { id: email, name: email },
    chat: { id: to, type: "private" as ChatType },
    timestamp: Date.now(),
    raw: fields,
  }
}

export function extractEmail(s: string): string {
  const m = s.match(/<([^>]+)>/)
  if (m) return m[1]!
  return s.trim()
}
