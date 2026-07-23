/**
 * Slack Events API & Slash Commands 解析
 *
 * 1) Events API callback:
 *    { type: "url_verification", challenge: "..." } → 原样回 challenge
 *    { type: "event_callback", event: { type: "message"|"app_mention", user, text, channel, ts, ... } }
 *
 * 2) Slash Commands (application/x-www-form-urlencoded):
 *    command=/xxx, text=..., user_id=..., channel_id=..., response_url=...
 *
 * @module slack/parser
 */

import type { GatewayMessage, ChatType, MessageType } from "../message"

/** Slack Events API body */
export interface SlackEventBody {
  readonly type?: string
  readonly challenge?: string
  readonly event?: {
    readonly type?: string
    readonly user?: string
    readonly username?: string
    readonly text?: string
    readonly channel?: string
    readonly ts?: string
    readonly subtype?: string
    readonly bot_id?: string
  }
  readonly team_id?: string
  readonly api_app_id?: string
}

/** Slack Slash Command payload（解析后的 key-value） */
export interface SlackSlashCommand {
  readonly command: string
  readonly text: string
  readonly user_id?: string
  readonly user_name?: string
  readonly channel_id?: string
  readonly channel_name?: string
  readonly response_url?: string
  readonly trigger_id?: string
}

/**
 * 解析 Events API JSON body
 *
 * 返回 GatewayMessage；url_verification 返回特殊对象让 server 层处理 challenge。
 */
export function parseEvent(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const b = body as SlackEventBody
  if (b.type === "url_verification") {
    return {
      id: `slack_url_verify_${Date.now()}`,
      platform: "slack",
      type: "event",
      content: `__url_verification__:${b.challenge ?? ""}`,
      sender: { id: "slack", name: "slack" },
      chat: { id: "slack", type: "private" as ChatType },
      timestamp: Date.now(),
      raw: body,
    }
  }
  if (b.type !== "event_callback") return undefined
  const ev = b.event
  if (!ev) return undefined
  // 过滤 bot 自身消息避免循环
  if (ev.bot_id) return undefined
  let type: MessageType = "event"
  let content = ev.text ?? ""
  let id = `slack_${ev.ts ?? Date.now()}`
  if (ev.type === "message" || ev.type === "app_mention") {
    type = "text"
  } else {
    content = ev.type ?? content
  }
  return {
    id,
    platform: "slack",
    type,
    content,
    sender: { id: ev.user ?? "unknown", name: ev.username ?? ev.user ?? "unknown" },
    chat: { id: ev.channel ?? "unknown", type: (ev.channel?.startsWith("D") ? "private" : "group") as ChatType },
    timestamp: ev.ts ? Number(ev.ts) * 1000 : Date.now(),
    raw: body,
  }
}

/**
 * 判断是否是 url_verification 事件，返回 challenge 字符串或 null
 */
export function extractChallenge(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const b = body as SlackEventBody
  if (b.type === "url_verification" && typeof b.challenge === "string") return b.challenge
  return null
}

/**
 * 解析 Slash Command URL-encoded body
 *
 * 验收点 6：能识别 /command 事件
 */
export function parseSlashCommand(form: Record<string, string>): GatewayMessage | undefined {
  const cmd = form.command
  if (!cmd) return undefined
  return {
    id: `slack_cmd_${Date.now()}`,
    platform: "slack",
    type: "event",
    content: `${cmd} ${form.text ?? ""}`.trim(),
    sender: { id: form.user_id ?? "unknown", name: form.user_name ?? form.user_id ?? "unknown" },
    chat: { id: form.channel_id ?? "unknown", type: (form.channel_name === "directmessage" ? "private" : "group") as ChatType },
    timestamp: Date.now(),
    raw: form,
  }
}

/**
 * 判断是否是 slash command 事件（content 以 / 开头）
 */
export function isSlashCommand(m: GatewayMessage): boolean {
  return m.platform === "slack" && m.content.startsWith("/")
}
