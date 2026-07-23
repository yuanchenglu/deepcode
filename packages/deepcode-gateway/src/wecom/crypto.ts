/**
 * DeepCode 消息网关 — 企业微信消息加解密
 *
 * 企业微信回调使用 AES-256-CBC 加密，Base64 编码的 EncodingAESKey 作为 key 源。
 *
 * 加密消息体格式：
 *   random(16B) + msg_len(4B, network order) + msg + receiveId
 *
 * 签名 msg_signature = SHA1(sort([token, timestamp, nonce, encrypt])).hexdigest
 *
 * 参考：https://developer.work.weixin.qq.com/document/path/90968
 *
 * @module wecom/crypto
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto"
import { GatewayError } from "../error"

/** 把 EncodingAESKey（43 字符 base64）解码为 32 字节 AES key */
function decodeAesKey(encodingAESKey: string): Buffer {
  // 官方要求 43 字符 base64，末尾补 '=' 得 32 字节
  const padded = encodingAESKey + "="
  try {
    const buf = Buffer.from(padded, "base64")
    if (buf.length !== 32) {
      throw new Error(`AES key length must be 32, got ${buf.length}`)
    }
    return buf
  } catch (err) {
    throw new GatewayError("CONFIG_ERROR", `Invalid EncodingAESKey: ${(err as Error).message}`)
  }
}

/**
 * 计算签名：SHA1(sort([token, timestamp, nonce, echostr/encrypt]))
 */
export function getSignature(token: string, timestamp: string, nonce: string, encrypt: string): string {
  const arr = [token, timestamp, nonce, encrypt].sort()
  const sha1 = createHash("sha1")
  sha1.update(arr.join(""))
  return sha1.digest("hex")
}

/**
 * 校验签名
 */
export function verifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
  expected: string,
): boolean {
  return getSignature(token, timestamp, nonce, encrypt) === expected
}

/**
 * PKCS7 去填充
 */
function pkcs7Decode(buf: Buffer): Buffer {
  const pad = buf[buf.length - 1] as number
  if (pad < 1 || pad > 32) throw new Error("invalid PKCS7 padding")
  return buf.subarray(0, buf.length - pad)
}

/**
 * PKCS7 填充到 32 字节块
 */
function pkcs7Encode(buf: Buffer): Buffer {
  const blockSize = 32
  const pad = blockSize - (buf.length % blockSize)
  const padding = Buffer.alloc(pad, pad)
  return Buffer.concat([buf, padding])
}

/**
 * AES-256-CBC 解密
 * - key: 32 字节（由 EncodingAESKey 解码）
 * - iv: key 前 16 字节
 * - ciphertext: base64 解码后的数据
 * - 明文结构: random16 + len(4B BE) + msg + receiveId
 */
export function decrypt(
  ciphertextBase64: string,
  encodingAESKey: string,
  expectedReceiveId?: string,
): { message: string; receiveId: string } {
  const key = decodeAesKey(encodingAESKey)
  const iv = key.subarray(0, 16)
  try {
    const ciphertext = Buffer.from(ciphertextBase64, "base64")
    const decipher = createDecipheriv("aes-256-cbc", key, iv)
    decipher.setAutoPadding(false)
    const plain = pkcs7Decode(Buffer.concat([decipher.update(ciphertext), decipher.final()]))
    // random 16B
    const msgLen = plain.readUInt32BE(16)
    const msg = plain.subarray(20, 20 + msgLen).toString("utf-8")
    const receiveId = plain.subarray(20 + msgLen).toString("utf-8")
    if (expectedReceiveId && receiveId !== expectedReceiveId) {
      throw new Error(`receiveId mismatch: expected ${expectedReceiveId}, got ${receiveId}`)
    }
    return { message: msg, receiveId }
  } catch (err) {
    throw new GatewayError("INVALID_MESSAGE", `WeCom decrypt failed: ${(err as Error).message}`)
  }
}

/**
 * AES-256-CBC 加密
 * 输入明文和 receiveId，输出 base64 密文
 */
export function encrypt(plaintext: string, encodingAESKey: string, receiveId: string): string {
  const key = decodeAesKey(encodingAESKey)
  const iv = key.subarray(0, 16)
  const random16 = randomBytes(16)
  const msgBuf = Buffer.from(plaintext, "utf-8")
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(msgBuf.length, 0)
  const recvBuf = Buffer.from(receiveId, "utf-8")
  const plain = Buffer.concat([random16, lenBuf, msgBuf, recvBuf])
  const padded = pkcs7Encode(plain)
  const cipher = createCipheriv("aes-256-cbc", key, iv)
  cipher.setAutoPadding(false)
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
  return encrypted.toString("base64")
}

/**
 * 构造加密 XML 响应（企业微信被动回复用）
 */
export function buildEncryptedReply(
  encrypted: string,
  signature: string,
  timestamp: string,
  nonce: string,
): string {
  return `<xml>
<Encrypt><![CDATA[${encrypted}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<Timestamp>${timestamp}</Timestamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`
}
