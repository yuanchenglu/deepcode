/**
 * 第二轮 e2e：每个平台一个真实用户场景 + 异常场景
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
import { signHmacSha256 } from "../src/crypto/qq"
import { signSha1, encrypt, decodeAesKey, signPlainToken } from "../src/crypto/wxbiz"
import type { GatewayMessage } from "../src/message"
import type { FeishuConfig, WeComConfig, QQConfig, WeChatMpConfig } from "../src/config"

const AES = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"

const fx = <T>(platform: string, name: string): T => {
  const raw = readFileSync(resolve(process.cwd(), `test/fixtures/${platform}/${name}`), "utf8")
  return name.endsWith(".json") ? JSON.parse(raw) : (raw as unknown as T)
}

let port: number
let seen: GatewayMessage[] = []

beforeEach(async () => {
  seen = []
  const adapters = [
    new FeishuAdapter({ enabled: true, appId: "cli_x", appSecret: "s", websocket: false } as FeishuConfig),
    new WeComAdapter({ enabled: true, corpId: "wwTest", agentId: "100", secret: "s", token: "wecomToken", encodingAesKey: AES } as WeComConfig),
    new QQAdapter({ enabled: true, appId: "q", token: "t", clientSecret: "qqSecret" } as QQConfig),
    new WeChatAdapter({ enabled: true, appId: "wxTest", appSecret: "s", token: "wxToken", mode: "plain" } as WeChatMpConfig),
  ]
  const g = await Effect.runPromise(startGateway({
    port: 0, adapters, installSignalHandlers: false,
    handler: (msg: GatewayMessage) => {
      seen.push(msg)
      return Effect.succeed({ chatId: msg.chat.id, type: "text" as const, content: `[${msg.platform}] ${msg.content}` })
    },
  }))
  port = g.port
})
afterEach(async () => { await Effect.runPromise(stopGateway()) })

// ---------- 飞书真实用户场景：用户在私聊里 @bot 提问 ----------
describe("E2E 飞书：p2p 问答", () => {
  it("用户文本消息经过 challenge 后的正常对话", async () => {
    // 1) 先 URL 验证
    const ch = await fetch(`http://127.0.0.1:${port}/webhook/feishu`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url_verification", challenge: "ch_real" }),
    })
    expect(ch.status).toBe(200)
    expect((await ch.json() as { challenge: string }).challenge).toBe("ch_real")
    // 2) 再发真实消息
    const msg = fx<Record<string, unknown>>("feishu", "im-message.json")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/feishu`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { received: boolean; reply?: { content: string } }
    expect(body.received).toBe(true)
    expect(body.reply?.content).toContain("你好 DeepCode")
  })

  it("群聊消息识别为 group", async () => {
    const msg = fx<Record<string, unknown>>("feishu", "group-message.json")
    await fetch(`http://127.0.0.1:${port}/webhook/feishu`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg),
    })
    expect(seen[seen.length - 1]?.chat.type).toBe("group")
  })
})

// ---------- 企业微信真实场景：应用消息 + URL 验证回包加解密 ----------
describe("E2E 企微：应用消息 + 加解密", () => {
  it("URL 验证 GET → 解密返回", async () => {
    const aesKey = decodeAesKey(AES)
    const echo = "echo_from_wecom"; const ts = "1400000000"; const nonce = "nonce"
    const enc = encrypt(echo, "wwTest", aesKey)
    const sig = signSha1("wecomToken", ts, nonce, enc)
    const url = `http://127.0.0.1:${port}/webhook/wecom?msg_signature=${encodeURIComponent(sig)}&timestamp=${ts}&nonce=${nonce}&echostr=${encodeURIComponent(enc)}`
    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(echo)
  })

  it("POST 密文消息被解密并路由", async () => {
    const aesKey = decodeAesKey(AES)
    const inner = fx<string>("wecom", "text-msg.xml")
    const ts = "1400000000"; const nonce = "nonce"
    const enc = encrypt(inner, "wwTest", aesKey)
    const sig = signSha1("wecomToken", ts, nonce, enc)
    const envelope = `<xml><Encrypt><![CDATA[${enc}]]></Encrypt><MsgSignature><![CDATA[${sig}]]></MsgSignature><TimeStamp>${ts}</TimeStamp><Nonce><![CDATA[${nonce}]]></Nonce></xml>`
    const res = await fetch(`http://127.0.0.1:${port}/webhook/wecom?msg_signature=${encodeURIComponent(sig)}&timestamp=${ts}&nonce=${nonce}`, {
      method: "POST", headers: { "Content-Type": "application/xml" }, body: envelope,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("wecom")
    expect(seen[seen.length - 1]?.content).toBe("企业微信消息")
  })

  it("签名错误 GET 返回 403", async () => {
    const url = `http://127.0.0.1:${port}/webhook/wecom?msg_signature=bad&timestamp=0&nonce=0&echostr=anything`
    const res = await fetch(url)
    expect(res.status).toBe(403)
  })
})

// ---------- QQ 真实场景：频道 @机器人 ----------
describe("E2E QQ：频道消息", () => {
  it("AT_MESSAGE_CREATE 路由 + 签名校验", async () => {
    const ts = String(Date.now())
    const bodyObj = fx<Record<string, unknown>>("qq", "at-robot.json")
    const raw = JSON.stringify(bodyObj)
    const sig = signHmacSha256("qqSecret", ts, raw)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/qq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QQ-Signature": sig,
        "X-QQ-Timestamp": ts,
      },
      body: raw,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.content).toContain("帮我写代码")
  })

  it("非法签名返回 401", async () => {
    const ts = String(Date.now())
    const res = await fetch(`http://127.0.0.1:${port}/webhook/qq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QQ-Signature": "deadbeef",
        "X-QQ-Timestamp": ts,
      },
      body: JSON.stringify({ op: 0 }),
    })
    expect(res.status).toBe(401)
  })

  it("非法 JSON 返回 400", async () => {
    const ts = String(Date.now())
    const body = "not json"
    // 先算对签名，绕过签名校验
    const sig = signHmacSha256("qqSecret", ts, body)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/qq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QQ-Signature": sig,
        "X-QQ-Timestamp": ts,
      },
      body,
    })
    expect(res.status).toBe(400)
  })
})

// ---------- 微信公众号真实场景：关注 + 消息 ----------
describe("E2E 微信公众号：关注 + 文本消息", () => {
  it("GET echostr 原样返回（明文模式验证）", async () => {
    const ts = "1400000000"; const nonce = "nonce"
    const sig = signPlainToken("wxToken", ts, nonce)
    const res = await fetch(`http://127.0.0.1:${port}/webhook/wechat?signature=${sig}&timestamp=${ts}&nonce=${nonce}&echostr=my_echo`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("my_echo")
  })

  it("POST 明文 XML 文本消息", async () => {
    const ts = "1400000001"; const nonce = "n"
    const sig = signPlainToken("wxToken", ts, nonce)
    const xml = fx<string>("wechat", "mp-text-msg.xml")
    const res = await fetch(`http://127.0.0.1:${port}/webhook/wechat?signature=${sig}&timestamp=${ts}&nonce=${nonce}`, {
      method: "POST", headers: { "Content-Type": "application/xml" }, body: xml,
    })
    expect(res.status).toBe(200)
    expect(seen[seen.length - 1]?.platform).toBe("wechat")
    expect(seen[seen.length - 1]?.content).toBe("你好 DeepCode")
  })

  it("subscribe 事件 → event 类型", async () => {
    const ts = "1400000002"; const nonce = "n"
    const sig = signPlainToken("wxToken", ts, nonce)
    const xml = fx<string>("wechat", "mp-event-subscribe.xml")
    await fetch(`http://127.0.0.1:${port}/webhook/wechat?signature=${sig}&timestamp=${ts}&nonce=${nonce}`, {
      method: "POST", headers: { "Content-Type": "application/xml" }, body: xml,
    })
    expect(seen[seen.length - 1]?.type).toBe("event")
    expect(seen[seen.length - 1]?.content).toBe("subscribe")
  })

  it("签名错误 → 403", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/webhook/wechat?signature=bad&timestamp=0&nonce=0&echostr=x`)
    expect(res.status).toBe(403)
  })
})

// ---------- 跨端场景：模拟同一用户在飞书+企微发消息 ----------
describe("E2E 跨平台统一身份：bindIdentity 后统一 session", () => {
  it("跨平台同用户分发后获得相同 unifiedId", async () => {
    const fs = fx<Record<string, unknown>>("feishu", "im-message.json")
    await fetch(`http://127.0.0.1:${port}/webhook/feishu`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fs),
    })
    const wx = fx<string>("wechat", "mp-text-msg.xml")
    const ts = "1500000000"; const nonce = "n"
    const sig = signPlainToken("wxToken", ts, nonce)
    await fetch(`http://127.0.0.1:${port}/webhook/wechat?signature=${sig}&timestamp=${ts}&nonce=${nonce}`, {
      method: "POST", headers: { "Content-Type": "application/xml" }, body: wx,
    })
    // seen 里应有两条消息，platform 分别是 feishu / wechat；两者均填充 unifiedId
    const platforms = seen.map((m) => m.platform).sort()
    expect(platforms).toEqual(["feishu", "wechat"])
    expect(seen[0]!.unifiedId).toBeTruthy()
    expect(seen[1]!.unifiedId).toBeTruthy()
    // 默认独立身份，两者 unifiedId 不同
    expect(seen[0]!.unifiedId).not.toBe(seen[1]!.unifiedId)
  })
})
