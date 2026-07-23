/**
 * 新 7 平台 HTTP 级 E2E 测试
 */
import { describe, it, expect, afterEach, beforeEach } from "bun:test"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { startGateway, stopGateway } from "../src/lifecycle"
import { FeishuAdapter } from "../src/feishu/adapter"
import { WeComAdapter } from "../src/wecom/adapter"
import { QQAdapter } from "../src/qq/adapter"
import { WeChatAdapter } from "../src/wechat/adapter"
import { TelegramAdapter } from "../src/telegram/adapter"
import { SlackAdapter } from "../src/slack/adapter"
import { SignalAdapter } from "../src/signal/adapter"
import { WhatsAppAdapter } from "../src/whatsapp/adapter"
import { DingTalkAdapter } from "../src/dingtalk/adapter"
import { MatrixAdapter } from "../src/matrix/adapter"
import { EmailAdapter } from "../src/email/adapter"
import type { GatewayMessage } from "../src/message"
import { signSlack } from "../src/slack/crypto"
import { sign as waSign } from "../src/whatsapp/crypto"
import { sign as emailSign } from "../src/email/crypto"
import { signHmacSha256 } from "../src/crypto/qq"
import type {
  FeishuConfig, WeComConfig, QQConfig, WeChatMpConfig, TelegramConfig, SlackConfig,
  SignalConfig, WhatsAppConfig, DingTalkConfig, MatrixConfig, EmailConfig,
} from "../src/config"

const AES = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"

let port: number
const seen: GatewayMessage[] = []

function fx<T>(platform: string, name: string): T {
  const raw = readFileSync(resolve(process.cwd(), `test/fixtures/${platform}/${name}`), "utf8")
  return name.endsWith(".json") ? JSON.parse(raw) : (raw as unknown as T)
}

beforeEach(async () => {
  seen.length = 0
  const adapters = [
    new FeishuAdapter({ enabled: true, appId: "x", appSecret: "y", websocket: false } as FeishuConfig),
    new WeComAdapter({ enabled: true, corpId: "ww", agentId: "1", secret: "s", token: "t", encodingAesKey: AES } as WeComConfig),
    new QQAdapter({ enabled: true, appId: "q", token: "t", clientSecret: "qqSecret" } as QQConfig),
    new WeChatAdapter({ enabled: true, appId: "wx", appSecret: "s", token: "wxToken", mode: "plain" } as WeChatMpConfig),
    new TelegramAdapter({ enabled: true, botToken: "botToken", secretToken: "tgSecret" } as TelegramConfig),
    new SlackAdapter({ enabled: true, signingSecret: "slackSecret", botToken: "xoxb-" } as SlackConfig),
    new SignalAdapter({ enabled: true, endpoint: "http://localhost", account: "+1" } as SignalConfig),
    new WhatsAppAdapter({ enabled: true, phoneNumberId: "1", accessToken: "waToken", verifyToken: "waVerify", appSecret: "waSecret" } as WhatsAppConfig),
    new DingTalkAdapter({ enabled: true, appKey: "k", appSecret: "s" } as DingTalkConfig),
    new MatrixAdapter({ enabled: true, homeserverUrl: "https://matrix.org", accessToken: "mxToken", userId: "@u:m.org" } as MatrixConfig),
    new EmailAdapter({ enabled: true, webhookSecret: "emailSecret", fromAddress: "g@x.com" } as EmailConfig),
  ]
  const g = await Effect.runPromise(startGateway({
    port: 0, adapters, installSignalHandlers: false,
    handler: (msg: GatewayMessage) => {
      seen.push(msg)
      return Effect.succeed({ chatId: msg.chat.id, type: "text" as const, content: `[${msg.platform}] ack` })
    },
  }))
  port = g.port
})
afterEach(async () => { await Effect.runPromise(stopGateway()) })

describe("E2E Telegram", () => {
  it("POST Update 分发到 handler", async () => {
    const body = fx("telegram", "text-message.json")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "tgSecret",
      },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("telegram")
    expect(seen[seen.length - 1]?.content).toBe("hello bot")
  })
  it("secret 头不匹配返回 401", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webhook/telegram`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "wrong" },
      body: JSON.stringify(fx("telegram", "text-message.json")),
    })
    expect(res.status).toBe(401)
  })
  it("/start 命令被识别（验收点 5）", async () => {
    const body = fx("telegram", "start-command.json")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "tgSecret" },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.content).toContain("/start")
  })
})

describe("E2E Slack", () => {
  it("url_verification 返回 challenge", async () => {
    const body = fx("slack", "url-verification.json")
    const raw = JSON.stringify(body)
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = signSlack("slackSecret", ts, raw)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/slack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Slack-Request-Timestamp": ts, "X-Slack-Signature": sig },
      body: raw,
    })
    expect(res.status).toBe(200)
    const j = await res.json() as { challenge?: string }
    expect(j.challenge).toBe("slack_challenge_value")
  })
  it("app_mention 事件路由", async () => {
    const body = fx("slack", "app-mention.json")
    const raw = JSON.stringify(body)
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = signSlack("slackSecret", ts, raw)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/slack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Slack-Request-Timestamp": ts, "X-Slack-Signature": sig },
      body: raw,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("slack")
  })
  it("slash command（form-urlencoded）", async () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const form = "command=%2Fdeepcode&text=run&user_id=U1&channel_id=C1"
    const sig = signSlack("slackSecret", ts, form)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/slack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Slack-Request-Timestamp": ts,
        "X-Slack-Signature": sig,
      },
      body: form,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.content).toContain("/deepcode")
  })
})

describe("E2E Signal", () => {
  it("DM 消息分发", async () => {
    const body = fx("signal", "dm.json")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/signal`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("signal")
    expect(seen[seen.length - 1]?.chat.type).toBe("private")
  })
  it("群消息路由", async () => {
    const body = fx("signal", "group.json")
    await fetch(`http://127.0.0.1:${port}/webhook/signal`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    expect(seen[seen.length - 1]?.chat.type).toBe("group")
  })
})

describe("E2E WhatsApp", () => {
  it("GET hub.mode=subscribe 返回 challenge", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=waVerify&hub.challenge=WA_CHAL`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("WA_CHAL")
  })
  it("POST webhook 消息（签名校验）", async () => {
    const body = fx("whatsapp", "text.json")
    const raw = JSON.stringify(body)
    const sig = waSign("waSecret", raw)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig },
      body: raw,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.content).toBe("whatsapp hi")
  })
  it("签名错误返回 401", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=bad" },
      body: JSON.stringify(fx("whatsapp", "text.json")),
    })
    expect(res.status).toBe(401)
  })
})

describe("E2E DingTalk", () => {
  it("自定义机器人回调消息分发", async () => {
    const body = fx("dingtalk", "robot-text.json")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/dingtalk`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("dingtalk")
    expect(seen[seen.length - 1]?.content).toBe("钉钉你好")
    expect(seen[seen.length - 1]?.chat.type).toBe("group")
  })
})

describe("E2E Matrix", () => {
  it("transaction POST 分发多条事件", async () => {
    const body = fx("matrix", "m.room.message.json")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/matrix/transactions/txn_1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer mxToken" },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    expect(seen.filter((m) => m.platform === "matrix")).toHaveLength(2)
  })
  it("Bearer token 错误返回 401", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webhook/matrix/transactions/txn_2`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
      body: JSON.stringify(fx("matrix", "m.room.message.json")),
    })
    expect(res.status).toBe(401)
  })
})

describe("E2E Email", () => {
  it("SendGrid Inbound Parse（JSON）分发", async () => {
    const body = fx("email", "sendgrid-text.json")
    const raw = JSON.stringify(body)
    const sig = emailSign("emailSecret", raw)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Email-Webhook-Signature": sig },
      body: raw,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("email")
    expect(seen[seen.length - 1]?.sender.id).toBe("alice@example.com")
  })
  it("签名错误返回 401", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webhook/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Email-Webhook-Signature": "bad" },
      body: JSON.stringify(fx("email", "sendgrid-text.json")),
    })
    expect(res.status).toBe(401)
  })
})

describe("E2E 全平台 /health", () => {
  it("/health 返回 11 个平台", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`)
    expect(res.status).toBe(200)
    const json = await res.json() as { adapters: string[] }
    expect(json.adapters.sort()).toEqual([
      "dingtalk", "email", "feishu", "matrix", "qq", "signal",
      "slack", "telegram", "wechat", "wecom", "whatsapp",
    ].sort())
  })
})

// Avoid unused import warning for qq sign helper
void signHmacSha256
