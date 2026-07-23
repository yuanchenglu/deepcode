/**
 * Email webhook 签名校验
 *
 * SendGrid/Mailgun 都支持 webhook 签名。为保持零依赖与简单，这里使用通用
 * HMAC-SHA256(secret, rawBody) 约定：
 *  - Header: X-Email-Webhook-Signature: sha256=HEX
 *
 * @module email/crypto
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export function sign(secret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
}

export function verify(
  secret: string | undefined,
  signature: string | null | undefined,
  rawBody: string,
): boolean {
  if (!secret) return true
  if (!signature || !signature.startsWith("sha256=")) return false
  const expected = sign(secret, rawBody)
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
