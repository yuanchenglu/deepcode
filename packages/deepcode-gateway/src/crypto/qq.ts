/**
 * DeepCode 消息网关 — QQ 官方机器人 签名校验
 *
 * QQ 官方机器人 v2 WebHook 模式通过签名头鉴权。不同版本/开放平台环境的签名算法略有差异，
 * 本实现采用最通用的 **HMAC-SHA256(secret, timestamp + rawBody)** 方案，返回 hex digest
 * （与 header 中字符串做常量时间比较）。
 *
 * 如平台使用 ED25519 签名，可在 adapter 层替换 sign/verify 的实现；
 * 本模块只暴露"生成签名"和"校验签名"两个纯函数，便于单测。
 *
 * @module crypto/qq
 */

import { createHmac, timingSafeEqual } from "node:crypto"

/** 允许的时间戳偏差（秒）。超过认为是重放攻击。 */
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/**
 * 生成 HMAC-SHA256 签名
 *
 * @param secret      机器人 client_secret
 * @param timestamp   请求头中的时间戳（毫秒字符串）
 * @param rawBody     原始请求体（必须与收到的 body 字节完全一致）
 */
export function signHmacSha256(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}${rawBody}`)
    .digest("hex")
}

export interface VerifyOptions {
  /** 请求头里的签名值 */
  readonly signature: string
  /** 请求头里的时间戳（毫秒） */
  readonly timestamp: string
  /** 原始请求体 */
  readonly rawBody: string
  /** client_secret */
  readonly secret: string
  /** 现在的毫秒时间戳（可注入，方便测试） */
  readonly nowMs?: number
}

/**
 * 校验 QQ WebHook 请求签名
 *
 * 规则：
 *  1) timestamp 必须在 TIMESTAMP_TOLERANCE_MS 范围内
 *  2) HMAC-SHA256(secret, timestamp + rawBody).hex 等于 signature（常量时间比较）
 */
export function verifySignature(opts: VerifyOptions): boolean {
  const { signature, timestamp, rawBody, secret } = opts
  if (!signature || !timestamp) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const now = opts.nowMs ?? Date.now()
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_MS) return false
  const expected = signHmacSha256(secret, timestamp, rawBody)
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
