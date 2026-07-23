/**
 * 钉钉自定义机器人签名校验
 *
 * 签名算法（官方）：
 *   stringToSign = timestamp + "\n" + secret
 *   sign = base64(HMAC-SHA256(secret, stringToSign))
 *   url encode 后放到 URL ?sign=xxx&timestamp=yyy
 *
 * 企业事件回调签名：
 *   X-DingTalk-Signature: HMAC-SHA256(token, timestamp + "\n" + appSecret + "\n" + body)
 *
 * @module dingtalk/crypto
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export const DINGTALK_TIMESTAMP_TOLERANCE_MS = 3600_000 // 1h

/** 计算群机器人签名（timestamp + "\n" + secret） */
export function signRobot(secret: string, timestamp: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${secret}`)
    .digest("base64")
}

/**
 * 校验群机器人 sign 参数
 *
 * @param sign       URL 上的 sign 参数（URL decoded）
 * @param secret     机器人 secret
 * @param timestamp  URL 上的 timestamp（毫秒字符串）
 */
export function verifyRobotSign(sign: string, secret: string, timestamp: string): boolean {
  const expected = signRobot(secret, timestamp)
  if (expected.length !== sign.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sign))
  } catch {
    return false
  }
}

/** 企业事件回调签名计算 */
export function signEvent(token: string, timestamp: string, appSecret: string, body: string): string {
  const str = `${timestamp}\n${appSecret}\n${body}`
  return createHmac("sha256", token).update(str).digest("base64")
}

export interface VerifyEventOpts {
  readonly signature: string | null
  readonly timestamp: string | null
  readonly rawBody: string
  readonly token: string
  readonly appSecret: string
  readonly nowMs?: number
}

export function verifyEvent(opts: VerifyEventOpts): boolean {
  if (!opts.signature || !opts.timestamp) return false
  const ts = Number(opts.timestamp)
  if (!Number.isFinite(ts)) return false
  const now = opts.nowMs ?? Date.now()
  if (Math.abs(now - ts) > DINGTALK_TIMESTAMP_TOLERANCE_MS) return false
  const expected = signEvent(opts.token, opts.timestamp, opts.appSecret, opts.rawBody)
  if (expected.length !== opts.signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(opts.signature))
  } catch {
    return false
  }
}
