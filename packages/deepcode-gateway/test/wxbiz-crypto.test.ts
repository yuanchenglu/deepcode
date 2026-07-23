import { describe, it, expect } from "bun:test"
import {
  decodeAesKey, encrypt, decrypt, signSha1, verifySignature, verifyUrl, signPlainToken,
} from "../src/crypto/wxbiz"

const AES_KEY = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" // 43 chars

describe("wxbiz crypto (企业微信/微信公众号 共用)", () => {
  it("AES key 解码后长度 32 字节", () => {
    expect(decodeAesKey(AES_KEY).length).toBe(32)
  })

  it("encrypt → decrypt 回环正确", () => {
    const aesKey = decodeAesKey(AES_KEY)
    const plain = "<xml><Content>hi</Content></xml>"
    const enc = encrypt(plain, "wx1234", aesKey)
    expect(typeof enc).toBe("string")
    expect(enc.length).toBeGreaterThan(20)
    const dec = decrypt(enc, aesKey)
    expect(dec).not.toBeNull()
    expect(dec!.plain).toBe(plain)
    expect(dec!.receiveId).toBe("wx1234")
  })

  it("PKCS7 padding 边界：32 字节明文", () => {
    const aesKey = decodeAesKey(AES_KEY)
    const plain = "a".repeat(32)
    const enc = encrypt(plain, "id", aesKey)
    const dec = decrypt(enc, aesKey)
    expect(dec!.plain).toBe(plain)
  })

  it("SHA1 签名四元组稳定", () => {
    const sig = signSha1("token", "1400000000", "nonce", "enc")
    expect(sig).toMatch(/^[0-9a-f]{40}$/)
    // 字典序排序后应该等于：sha1(["enc","nonce","token","1400000000"].join())
    expect(verifySignature("token", sig, "1400000000", "nonce", "enc")).toBe(true)
  })

  it("verifySignature 错误 token 返回 false", () => {
    const sig = signSha1("token", "ts", "n", "enc")
    expect(verifySignature("wrong", sig, "ts", "n", "enc")).toBe(false)
    expect(verifySignature("token", "badbad", "ts", "n", "enc")).toBe(false)
  })

  it("verifyUrl：正确签名+密文 → 解密出 echostr", () => {
    const aesKey = decodeAesKey(AES_KEY)
    const token = "testToken"
    const ts = "1400000000"
    const nonce = "nonce"
    const echo = "hello_echo_str"
    const enc = encrypt(echo, "wwCorpId", aesKey)
    const sig = signSha1(token, ts, nonce, enc)
    const plain = verifyUrl({ msg_signature: sig, timestamp: ts, nonce, echostr: enc }, token, aesKey)
    expect(plain).toBe(echo)
  })

  it("verifyUrl 签名错误 → null", () => {
    const aesKey = decodeAesKey(AES_KEY)
    const enc = encrypt("anything", "id", aesKey)
    expect(verifyUrl({ msg_signature: "deadbeef", timestamp: "0", nonce: "0", echostr: enc }, "tok", aesKey)).toBeNull()
  })

  it("signPlainToken：明文模式三元组签名", () => {
    const sig = signPlainToken("tok", "1", "2")
    expect(sig).toMatch(/^[0-9a-f]{40}$/)
  })
})
