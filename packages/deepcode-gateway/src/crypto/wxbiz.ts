/**
 * DeepCode 消息网关 — 企业微信 / 微信公众号 加解密通用模块
 *
 * 两个平台都使用 WXBizMsgCrypt 协议：
 *  - AES-256-CBC，PKCS#7 padding
 *  - key = base64decode(EncodingAESKey + "=")
 *  - IV = key.slice(0, 16)
 *  - sha1 签名：对 [token, timestamp, nonce, encrypt] 字典序排序后 join，计算 SHA1 hex
 *
 * 参考：
 *  - 企业微信 https://developer.work.weixin.qq.com/document/path/90968
 *  - 微信公众号 https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Message_Encryption_and_Decryption.html
 *
 * @module crypto/wxbiz
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { createHash } from "node:crypto"

// ---------------------------------------------------------------------------
// 签名
// ---------------------------------------------------------------------------

/**
 * SHA1 签名
 *
 * 把 token/timestamp/nonce/encrypt 四元组按字典序排序后拼接再 SHA1。
 */
export function signSha1(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
): string {
  const arr = [token, timestamp, nonce, encrypt].sort()
  const shasum = createHash("sha1")
  shasum.update(arr.join(""))
  return shasum.digest("hex")
}

/**
 * 校验签名：返回 true 表示签名匹配
 */
export function verifySignature(
  token: string,
  signature: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
): boolean {
  const expected = signSha1(token, timestamp, nonce, encrypt)
  // 避免时序侧信道，使用长度常量比较
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

// ---------------------------------------------------------------------------
// AES-CBC 加解密
// ---------------------------------------------------------------------------

/** EncodingAESKey(43字符) + "=" → 32 字节 AES key */
export function decodeAesKey(encodingAesKey: string): Buffer {
  return Buffer.from(encodingAesKey + "=", "base64")
}

/** PKCS#7 padding（block=32，微信系协议约定 padding block size = 32） */
function pkcs7Pad(data: Buffer, blockSize = 32): Buffer {
  const pad = blockSize - (data.length % blockSize)
  const padding = Buffer.alloc(pad, pad)
  return Buffer.concat([data, padding])
}
function pkcs7Unpad(data: Buffer): Buffer {
  const pad = data[data.length - 1]!
  if (pad < 1 || pad > 32) return data
  return data.subarray(0, data.length - pad)
}

/**
 * 加密
 *
 * 密文结构：random16Bytes(16) + msgLen(4, BE) + msg + receiveId
 *
 * @param plain      明文 XML / echostr 字符串
 * @param receiveId  企业微信填 corpId，公众号填 appId
 * @returns          Base64 密文
 */
export function encrypt(
  plain: string,
  receiveId: string,
  aesKey: Buffer,
): string {
  const random16 = randomBytes(16)
  const msg = Buffer.from(plain, "utf8")
  const len = Buffer.alloc(4)
  len.writeUInt32BE(msg.length, 0)
  const recv = Buffer.from(receiveId, "utf8")
  const plainBuf = Buffer.concat([random16, len, msg, recv])
  const padded = pkcs7Pad(plainBuf)
  const iv = aesKey.subarray(0, 16)
  const cipher = createCipheriv("aes-256-cbc", aesKey, iv)
  cipher.setAutoPadding(false)
  const enc = Buffer.concat([cipher.update(padded), cipher.final()])
  return enc.toString("base64")
}

/**
 * 解密结果
 */
export interface DecryptResult {
  /** 解密后的明文（XML 或 echostr） */
  readonly plain: string
  /** 密文中绑定的 receiveId（corpId / appId），用于校验 */
  readonly receiveId: string
}

/**
 * 解密
 *
 * @returns  明文 + 绑定的 receiveId；失败返回 null
 */
export function decrypt(
  cipherB64: string,
  aesKey: Buffer,
): DecryptResult | null {
  try {
    const iv = aesKey.subarray(0, 16)
    const decipher = createDecipheriv("aes-256-cbc", aesKey, iv)
    decipher.setAutoPadding(false)
    const dec = Buffer.concat([decipher.update(Buffer.from(cipherB64, "base64")), decipher.final()])
    const unpadded = pkcs7Unpad(dec)
    // random(16) + len(4) + msg(len) + receiveId(剩余)
    const msgLen = unpadded.readUInt32BE(16)
    const plain = unpadded.subarray(20, 20 + msgLen).toString("utf8")
    const receiveId = unpadded.subarray(20 + msgLen).toString("utf8")
    return { plain, receiveId }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// URL 验证（GET echostr）
// ---------------------------------------------------------------------------

export interface VerifyQuery {
  readonly msg_signature: string
  readonly timestamp: string
  readonly nonce: string
  readonly echostr: string
}

/**
 * 处理 GET 验证请求：验签 + 解密 echostr → 返回明文 echostr；失败返回 null。
 */
export function verifyUrl(
  q: VerifyQuery,
  token: string,
  aesKey: Buffer,
): string | null {
  if (!verifySignature(token, q.msg_signature, q.timestamp, q.nonce, q.echostr)) return null
  const d = decrypt(q.echostr, aesKey)
  if (!d) return null
  return d.plain
}

/**
 * 明文模式 signature 校验（公众号 plain 模式只验 [token, timestamp, nonce]）
 */
export function signPlainToken(token: string, timestamp: string, nonce: string): string {
  const arr = [token, timestamp, nonce].sort()
  return createHash("sha1").update(arr.join("")).digest("hex")
}
