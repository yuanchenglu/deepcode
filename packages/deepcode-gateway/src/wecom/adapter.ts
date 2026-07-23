/**
 * DeepCode 消息网关 — 企业微信平台适配器
 *
 * 企业微信应用消息通过 HTTP Webhook 回调：
 * - GET：URL 验证（echostr 解密返回）
 * - POST：接收 XML 消息（明文或 AES 加密）
 *
 * 发消息使用 REST：/cgi-bin/message/send（access_token 缓存）
 *
 * @module wecom/adapter
 */

import { Effect, Queue, Stream } from "effect"
import type { PlatformAdapter } from "../adapter"
import type { GatewayMessage, OutboundMessage, SendResult } from "../message"
import { GatewayError } from "../error"
import type { WeComConfig } from "../config"
import { getAccessToken, sendTextMessage } from "./api"
import { decrypt, encrypt, getSignature, verifySignature, buildEncryptedReply } from "./crypto"
import { parseXml, buildXml } from "../xml-util"

export class WeComAdapter implements PlatformAdapter {
  readonly name = "wecom" as const
  private readonly cfg: WeComConfig
  private _queue: Queue.Queue<GatewayMessage> | null = null
  private tokenCache: { token: string; expiry: number } | null = null

  constructor(config: WeComConfig) {
    this.cfg = config
  }

  /** 企业微信是纯 HTTP Webhook 模式，不需要维持长连接 */
  start(): Effect.Effect<void, GatewayError> {
    return Effect.void
  }
  stop(): Effect.Effect<void> {
    return Effect.void
  }

  setQueue(q: Queue.Queue<GatewayMessage>): void {
    this._queue = q
  }

  get messages(): Stream.Stream<GatewayMessage, GatewayError> {
    if (!this._queue) return Stream.fail(new GatewayError("INTERNAL_ERROR", "Queue not initialized"))
    return Stream.fromQueue(this._queue)
  }

  /** 平台加解密工具 */
  readonly crypto = {
    verifySignature: (timestamp: string, nonce: string, encrypted: string, expected: string) =>
      verifySignature(this.cfg.token, timestamp, nonce, encrypted, expected),
    decrypt: (ciphertextBase64: string) => decrypt(ciphertextBase64, this.cfg.encodingAESKey, this.cfg.corpId),
    encrypt: (plaintext: string) => encrypt(plaintext, this.cfg.encodingAESKey, this.cfg.corpId),
  } as const

  /** 发送消息到企业微信（REST） */
  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError> {
    const self = this
    return Effect.gen(function* () {
      const token = yield* self.getToken()
      yield* sendTextMessage(token, msg.chatId, self.cfg.agentId, msg.content).pipe(
        Effect.mapError((e) => new GatewayError("NETWORK_ERROR", e.message)),
      )
      return { platformMessageId: `wecom_${Date.now()}`, timestamp: Date.now() }
    })
  }

  private getToken(): Effect.Effect<string, GatewayError> {
    if (this.tokenCache && this.tokenCache.expiry > Date.now()) {
      return Effect.succeed(this.tokenCache.token)
    }
    const self = this
    return Effect.gen(function* () {
      const token = yield* getAccessToken(self.cfg.corpId, self.cfg.secret).pipe(
        Effect.mapError((e) => new GatewayError("AUTH_ERROR", e.message)),
      )
      // 缓存 7200s，提前 300s 刷新
      self.tokenCache = { token, expiry: Date.now() + (7200 - 300) * 1000 }
      return token
    })
  }

  /**
   * 处理企业微信 Webhook 请求
   *
   * - GET  URL 验证：msg_signature/timestamp/nonce/echostr → 校验签名 + 解密 echostr → 返回明文
   * - POST 消息：解析 XML（明文/加密）→ 构造 GatewayMessage → 入队 → 返回空串/加密空串
   */
  async handleWebhook(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (req.method === "GET") {
      return this.handleVerify(url)
    }

    // POST 消息
    const msgSignature = url.searchParams.get("msg_signature") ?? ""
    const timestamp = url.searchParams.get("timestamp") ?? ""
    const nonce = url.searchParams.get("nonce") ?? ""

    const bodyText = await req.text()
    try {
      const parsed = parseXml(bodyText)
      const encrypt = parsed.Encrypt
      let innerXml: string
      if (encrypt) {
        // 加密模式：校验签名 + 解密
        if (!verifySignature(this.cfg.token, timestamp, nonce, encrypt, msgSignature)) {
          return new Response("invalid signature", { status: 403 })
        }
        const dec = decrypt(encrypt, this.cfg.encodingAESKey, this.cfg.corpId)
        innerXml = dec.message
      } else {
        innerXml = bodyText
      }
      const msg = parseWeComMessage(innerXml)
      if (msg && this._queue) {
        Effect.runFork(Queue.offer(this._queue, { ...msg, sourceAdapter: "wecom" }))
      }
      // 被动回复 5 秒内直接返回空串（企业微信要求）；回复由 consumer 走主动 send
      return new Response("success", { status: 200 })
    } catch (err) {
      console.error("[WeComAdapter] handleWebhook error:", err)
      return new Response("internal error", { status: 500 })
    }
  }

  /** 处理回调 URL 验证 GET */
  private handleVerify(url: URL): Response {
    const msgSignature = url.searchParams.get("msg_signature") ?? ""
    const timestamp = url.searchParams.get("timestamp") ?? ""
    const nonce = url.searchParams.get("nonce") ?? ""
    const echostr = url.searchParams.get("echostr") ?? ""
    if (!verifySignature(this.cfg.token, timestamp, nonce, echostr, msgSignature)) {
      return new Response("invalid signature", { status: 403 })
    }
    try {
      const dec = decrypt(echostr, this.cfg.encodingAESKey, this.cfg.corpId)
      return new Response(dec.message, { status: 200 })
    } catch (err) {
      console.error("[WeComAdapter] verify decrypt failed:", err)
      return new Response("decrypt failed", { status: 400 })
    }
  }
}

/**
 * 把企业微信 XML 消息解析为 GatewayMessage
 * 支持：text 消息；其他类型暂作为 event 类型忽略 text 提取
 */
export function parseWeComMessage(xmlText: string): GatewayMessage | undefined {
  const m = parseXml(xmlText)
  const msgType = m.MsgType
  const fromUser = m.FromUserName
  const toUser = m.ToUserName
  const msgId = m.MsgId ?? m.MsgID ?? `wecom_${Date.now()}`
  const agentId = m.AgentID ?? ""
  if (!fromUser) return undefined

  if (msgType === "text") {
    return {
      id: msgId,
      platform: "wecom",
      type: "text",
      content: m.Content ?? "",
      sender: { id: fromUser, name: fromUser },
      chat: { id: fromUser, type: "private" },
      timestamp: Number(m.CreateTime) * 1000 || Date.now(),
      raw: m,
    }
  }
  // event / image / voice 等作为 event 类型透传
  return {
    id: msgId,
    platform: "wecom",
    type: "event",
    content: JSON.stringify(m),
    sender: { id: fromUser, name: fromUser },
    chat: { id: fromUser, type: "private" },
    timestamp: Number(m.CreateTime) * 1000 || Date.now(),
    raw: m,
  }
}
