/**
 * Slack Events/Slash Command 签名校验
 *
 * Slack 用 X-Slack-Signature 头，值为 "v0=HEX"，
 * 计算 basestring = "v0:" + timestamp + ":" + rawBody，
 * 签名 = "v0=" + HMAC-SHA256(signingSecret, basestring).hex
 *
 * 5 分钟 timestamp 重放保护。
 *
 * @module slack/crypto
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export const SLACK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

export function signSlack(
  signingSecret: string,
  timestamp: string,
  body: string,
): string {
  const base = `v0:${timestamp}:${body}`
  return `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`
}

export interface VerifyOpts {
  readonly signature: string | null | undefined
  readonly timestamp: string | null | undefined
  readonly rawBody: string
  readonly signingSecret: string
  readonly nowMs?: number
}

export function verifySignature(opts: VerifyOpts): boolean {
  if (!opts.signature || !opts.timestamp) return false
  if (!opts.signature.startsWith("v0=")) return false
  const ts = Number(opts.timestamp)
  if (!Number.isFinite(ts)) return false
  const now = opts.nowMs ?? Date.now()
  // Slack timestamp 是秒
  if (Math.abs(now - ts * 1000) > SLACK_TIMESTAMP_TOLERANCE_MS) return false
  const expected = signSlack(opts.signingSecret, opts.timestamp, opts.rawBody)
  if (expected.length !== opts.signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(opts.signature))
  } catch {
    return false
  }
}
