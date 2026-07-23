/**
 * 7 个新平台单测：Telegram / Slack / Signal / WhatsApp / DingTalk / Matrix / Email
 * 覆盖 parser / crypto / adapter 接口
 */
import { describe, it, expect } from "bun:test"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { TelegramAdapter } from "../src/telegram/adapter"
import { parseUpdate, isStartCommand } from "../src/telegram/parser"
import { verifySecretToken } from "../src/telegram/crypto"

import { SlackAdapter } from "../src/slack/adapter"
import { parseEvent, parseSlashCommand, extractChallenge as slackExtractChallenge, isSlashCommand } from "../src/slack/parser"
import { signSlack, verifySignature } from "../src/slack/crypto"

import { SignalAdapter } from "../src/signal/adapter"
import { parseEnvelope } from "../src/signal/parser"

import { WhatsAppAdapter } from "../src/whatsapp/adapter"
import { parseWebhook, extractChallenge as waExtractChallenge } from "../src/whatsapp/parser"
import { sign as waSign, verify as waVerify } from "../src/whatsapp/crypto"

import { DingTalkAdapter } from "../src/dingtalk/adapter"
import { parse as dtParse } from "../src/dingtalk/parser"
import { signRobot, verifyRobotSign, signEvent, verifyEvent } from "../src/dingtalk/crypto"

import { MatrixAdapter } from "../src/matrix/adapter"
import { parseTransaction, verifyBearer } from "../src/matrix/parser"
import { sendMessage as mxSend } from "../src/matrix/api"

import { EmailAdapter } from "../src/email/adapter"
import { parseInbound, extractEmail } from "../src/email/parser"
import { sign as emailSign, verify as emailVerify } from "../src/email/crypto"

function fx<T>(platform: string, name: string): T {
  const raw = readFileSync(resolve(process.cwd(), `test/fixtures/${platform}/${name}`), "utf8")
  return name.endsWith(".json") ? JSON.parse(raw) : (raw as unknown as T)
}

// ==================== Telegram ====================
describe("Telegram", () => {
  it("parseUpdate 文本消息", () => {
    const m = parseUpdate(fx("telegram", "text-message.json"))
    expect(m?.platform).toBe("telegram")
    expect(m?.content).toBe("hello bot")
    expect(m?.sender.id).toBe("12345")
    expect(m?.chat.type).toBe("private")
  })
  it("/start 命令识别（验收点 5）", () => {
    const m = parseUpdate(fx("telegram", "start-command.json"))
    expect(m?.content).toContain("/start")
    expect(isStartCommand(m!)).toBe(true)
  })
  it("群消息归类为 group", () => {
    const m = parseUpdate(fx("telegram", "group-mention.json"))
    expect(m?.chat.type).toBe("group")
  })
  it("非消息 Update（callback_query 等）", () => {
    const m = parseUpdate({ update_id: 1, callback_query: { id: "q1", from: { id: 1 }, data: "cb" } })
    expect(m?.type).toBe("event")
  })
  it("空/无效 body 返回 undefined", () => {
    expect(parseUpdate(null)).toBeUndefined()
    expect(parseUpdate({})).toBeUndefined()
  })
  it("secret token 常量时间校验", () => {
    expect(verifySecretToken("secret", "secret")).toBe(true)
    expect(verifySecretToken("secret", "wrong")).toBe(false)
    expect(verifySecretToken(undefined, null)).toBe(true) // 未配置跳过
    expect(verifySecretToken("s", null)).toBe(false)
  })
  it("adapter 接口", async () => {
    const a = new TelegramAdapter({ enabled: true, botToken: "t", secretToken: "s" })
    expect(a.name).toBe("telegram")
    expect(a.getSecretToken()).toBe("s")
    await Effect.runPromise(a.start())
    await Effect.runPromise(a.stop())
  })
})

// ==================== Slack ====================
describe("Slack", () => {
  it("url_verification challenge 提取", () => {
    const body = fx("slack", "url-verification.json")
    expect(slackExtractChallenge(body)).toBe("slack_challenge_value")
    expect(slackExtractChallenge({})).toBeNull()
  })
  it("app_mention 事件解析", () => {
    const m = parseEvent(fx("slack", "app-mention.json"))
    expect(m?.platform).toBe("slack")
    expect(m?.type).toBe("text")
    expect(m?.content).toBe("<@U123> 你好")
    expect(m?.sender.id).toBe("U789")
    expect(m?.chat.id).toBe("CCHANNEL")
  })
  it("bot_message 被过滤（防循环）", () => {
    const m = parseEvent(fx("slack", "bot-message.json"))
    expect(m).toBeUndefined()
  })
  it("slash command 解析（验收点 6）", () => {
    const form = { command: "/deepcode", text: "run tests", user_id: "U1", channel_id: "C1" }
    const m = parseSlashCommand(form)
    expect(m?.type).toBe("event")
    expect(m?.content).toBe("/deepcode run tests")
    expect(isSlashCommand(m!)).toBe(true)
  })
  it("slash command 缺少 command 返回 undefined", () => {
    expect(parseSlashCommand({ text: "x" })).toBeUndefined()
  })
  it("签名 v0= 校验", () => {
    const secret = "secret"
    const ts = "1700000000"
    const body = "{}"
    const sig = signSlack(secret, ts, body)
    expect(verifySignature({ signature: sig, timestamp: ts, rawBody: body, signingSecret: secret, nowMs: 1700000000 * 1000 })).toBe(true)
    expect(verifySignature({ signature: sig, timestamp: ts, rawBody: "other", signingSecret: secret })).toBe(false)
    expect(verifySignature({ signature: "invalid", timestamp: ts, rawBody: body, signingSecret: secret })).toBe(false)
  })
  it("过期 timestamp 被拒", () => {
    const sig = signSlack("s", "1000000000", "{}")
    expect(verifySignature({ signature: sig, timestamp: "1000000000", rawBody: "{}", signingSecret: "s", nowMs: 2000000000_000 })).toBe(false)
  })
  it("adapter 接口", async () => {
    const a = new SlackAdapter({ enabled: true, signingSecret: "s", botToken: "xoxb-" })
    expect(a.getSigningSecret()).toBe("s")
    await Effect.runPromise(a.start())
  })
})

// ==================== Signal ====================
describe("Signal", () => {
  it("DM 消息解析", () => {
    const m = parseEnvelope(fx("signal", "dm.json"))
    expect(m?.platform).toBe("signal")
    expect(m?.chat.type).toBe("private")
    expect(m?.sender.id).toBe("+15551234567")
    expect(m?.content).toBe("hello signal")
    expect(m?.chat.id).toBe("signal:dm:+15551234567")
  })
  it("群消息带 groupInfo", () => {
    const m = parseEnvelope(fx("signal", "group.json"))
    expect(m?.chat.type).toBe("group")
    expect(m?.chat.id).toContain("signal:group:")
  })
  it("typing 类 envelope 忽略", () => {
    const m = parseEnvelope(fx("signal", "typing.json"))
    expect(m).toBeUndefined()
  })
  it("无效 body 返回 undefined", () => {
    expect(parseEnvelope(null)).toBeUndefined()
    expect(parseEnvelope({})).toBeUndefined()
  })
  it("adapter 接口", async () => {
    const a = new SignalAdapter({ enabled: true, endpoint: "http://localhost", account: "+1" })
    expect(a.name).toBe("signal")
    await Effect.runPromise(a.start())
  })
})

// ==================== WhatsApp ====================
describe("WhatsApp", () => {
  it("text 消息解析", () => {
    const m = parseWebhook(fx("whatsapp", "text.json"))
    expect(m?.platform).toBe("whatsapp")
    expect(m?.content).toBe("whatsapp hi")
    expect(m?.sender.id).toBe("15559999999")
  })
  it("status 更新忽略（无 messages）", () => {
    const m = parseWebhook(fx("whatsapp", "status.json"))
    expect(m).toBeUndefined()
  })
  it("无效 object 返回 undefined", () => {
    expect(parseWebhook({})).toBeUndefined()
    expect(parseWebhook(null)).toBeUndefined()
  })
  it("URL 验证 challenge", () => {
    expect(waExtractChallenge({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "CHAL" }, "tok")).toBe("CHAL")
    expect(waExtractChallenge({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "CHAL" }, "tok")).toBeNull()
    expect(waExtractChallenge({ "hub.mode": "publish" }, "tok")).toBeNull()
  })
  it("HMAC 签名校验", () => {
    const secret = "app_secret"
    const raw = JSON.stringify(fx("whatsapp", "text.json"))
    const sig = waSign(secret, raw)
    expect(waVerify(secret, sig, raw)).toBe(true)
    expect(waVerify(secret, "sha256=bad", raw)).toBe(false)
    expect(waVerify(undefined, "", raw)).toBe(true) // 未配置跳过
  })
  it("adapter 接口", async () => {
    const a = new WhatsAppAdapter({ enabled: true, phoneNumberId: "1", accessToken: "t", verifyToken: "v", appSecret: "s" })
    expect(a.name).toBe("whatsapp")
    await Effect.runPromise(a.start())
  })
})

// ==================== DingTalk ====================
describe("DingTalk", () => {
  it("群机器人消息（conversationType=2）解析", () => {
    const m = dtParse(fx("dingtalk", "robot-text.json"))
    expect(m?.platform).toBe("dingtalk")
    expect(m?.chat.type).toBe("group")
    expect(m?.content).toBe("钉钉你好")
  })
  it("单聊（conversationType=1）", () => {
    const m = dtParse(fx("dingtalk", "robot-private.json"))
    expect(m?.chat.type).toBe("private")
  })
  it("未知 body 返回 undefined", () => {
    expect(dtParse(null)).toBeUndefined()
  })
  it("群机器人签名验证", () => {
    const secret = "SECxxx"
    const ts = "1700000000000"
    const sig = signRobot(secret, ts)
    expect(verifyRobotSign(sig, secret, ts)).toBe(true)
    expect(verifyRobotSign(sig, "wrong", ts)).toBe(false)
  })
  it("事件回调签名验证", () => {
    const token = "T"; const secret = "S"; const ts = "1700000000000"; const body = "{}"
    const sig = signEvent(token, ts, secret, body)
    expect(verifyEvent({ signature: sig, timestamp: ts, rawBody: body, token, appSecret: secret, nowMs: 1700000000000 })).toBe(true)
    expect(verifyEvent({ signature: "bad", timestamp: ts, rawBody: body, token, appSecret: secret })).toBe(false)
  })
  it("adapter 接口", async () => {
    const a = new DingTalkAdapter({ enabled: true, appKey: "k", appSecret: "s", signSecret: "sec" })
    expect(a.name).toBe("dingtalk")
    await Effect.runPromise(a.start())
  })
})

// ==================== Matrix ====================
describe("Matrix", () => {
  it("transaction 解析（多事件）", () => {
    const ms = parseTransaction(fx("matrix", "m.room.message.json"))
    expect(ms).toHaveLength(2)
    expect(ms[0]!.platform).toBe("matrix")
    expect(ms[0]!.content).toBe("matrix hello")
    expect(ms[1]!.content).toBe("second")
    expect(ms[0]!.chat.type).toBe("group")
  })
  it("非 m.room.message 过滤", () => {
    const ms = parseTransaction({ events: [{ type: "m.room.member" }] })
    expect(ms).toHaveLength(0)
  })
  it("Bearer token 校验", () => {
    expect(verifyBearer("tok", "Bearer tok")).toBe(true)
    expect(verifyBearer("tok", "Bearer wrong")).toBe(false)
    expect(verifyBearer(undefined, null)).toBe(true)
    expect(verifyBearer("tok", null)).toBe(false)
  })
  it("adapter 接口", async () => {
    const a = new MatrixAdapter({ enabled: true, homeserverUrl: "https://matrix.org", accessToken: "t", userId: "@u:m.org" })
    expect(a.name).toBe("matrix")
    await Effect.runPromise(a.start())
  })
  it("mxSend 在非 200 返回错误（mock）", async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (() => Promise.resolve(new Response("err", { status: 500 }))) as typeof fetch
    try {
      let failed = false
      try { await Effect.runPromise(mxSend("https://example.com", "tok", "!a", "hi")) } catch { failed = true }
      expect(failed).toBe(true)
    } finally { globalThis.fetch = orig }
  })
})

// ==================== Email ====================
describe("Email", () => {
  it("解析 SendGrid Inbound 字段", () => {
    const m = parseInbound(fx("email", "sendgrid-text.json"))
    expect(m?.platform).toBe("email")
    expect(m?.content).toContain("email subject")
    expect(m?.content).toContain("email body")
    expect(m?.sender.id).toBe("alice@example.com")
  })
  it("缺少 from 返回 undefined", () => {
    expect(parseInbound({ to: "a@b" })).toBeUndefined()
  })
  it("extractEmail 处理 Name <addr> 格式", () => {
    expect(extractEmail("Bob <bob@x.com>")).toBe("bob@x.com")
    expect(extractEmail("plain@x.com")).toBe("plain@x.com")
  })
  it("签名校验", () => {
    const secret = "key"
    const raw = JSON.stringify(fx("email", "sendgrid-text.json"))
    const sig = emailSign(secret, raw)
    expect(emailVerify(secret, sig, raw)).toBe(true)
    expect(emailVerify(secret, "bad", raw)).toBe(false)
  })
  it("adapter 无 sendgrid key 时 dry-run 返回", async () => {
    const a = new EmailAdapter({ enabled: true, fromAddress: "g@x.com" })
    const r = await Effect.runPromise(a.send({ chatId: "alice@x.com", type: "text", content: "hi" }))
    expect(r.platformMessageId).toContain("dryrun")
  })
  it("adapter 接口", async () => {
    const a = new EmailAdapter({ enabled: true, webhookSecret: "s", sendgridApiKey: "SG.", fromAddress: "g@x.com" })
    expect(a.name).toBe("email")
    await Effect.runPromise(a.start())
  })
})
