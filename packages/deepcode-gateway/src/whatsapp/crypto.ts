/**
 * WhatsApp Business Cloud API 签名校验
 *
 * X-Hub-Signature-256: sha256=HEX
 * basestring = rawBody
 * HMAC-SHA256(appSecret, rawBody)
 *
 * @module whatsapp/crypto
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
