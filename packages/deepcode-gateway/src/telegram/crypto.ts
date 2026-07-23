/**
 * Telegram webhook 校验
 *
 * Telegram Bot API 通过 `X-Telegram-Bot-Api-Secret-Token` 头校验请求来源：
 * 在 setWebhook 时指定 secret_token，Telegram 会在每次 webhook POST 里带这个头。
 * 比较使用常量时间。
 *
 * @module telegram/crypto
 */

import { timingSafeEqual } from "node:crypto"

/**
 * 校验 secret token 头
 *
 * @param expected  配置的 secret token（可能为空）
 * @param actual    请求头里的 token（可能为空）
 */
export function verifySecretToken(expected: string | undefined, actual: string | null | undefined): boolean {
  if (!expected) return true // 未配置 secret 时跳过校验
  if (!actual) return false
  if (expected.length !== actual.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  } catch {
    return false
  }
}
