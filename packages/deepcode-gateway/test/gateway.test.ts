import { describe, it, expect } from "bun:test"
import type { GatewayMessage, OutboundMessage } from "../src/message"
import { GatewayError } from "../src/error"
import { getOrCreateSession, clearSessionMap } from "../src/session-bridge"

describe("消息模型", () => {
  it("GatewayMessage 应有全部必要字段", () => {
    const msg: GatewayMessage = {
      id: "t1", platform: "feishu", type: "text", content: "你好",
      sender: { id: "u1", name: "用户" },
      chat: { id: "c1", type: "private" },
      timestamp: Date.now(),
    }
    expect(msg.id).toBe("t1"); expect(msg.platform).toBe("feishu")
  })
  it("OutboundMessage 应有全部必要字段", () => {
    const msg: OutboundMessage = { chatId: "c1", type: "text", content: "回复" }
    expect(msg.chatId).toBe("c1"); expect(msg.content).toBe("回复")
  })
})

describe("错误类型", () => {
  it("GatewayError 应有 _tag, code, message", () => {
    const err = new GatewayError("NETWORK_ERROR", "error")
    expect(err._tag).toBe("GatewayError"); expect(err.code).toBe("NETWORK_ERROR")
  })
})

describe("Session 桥接", () => {
  it("同一 chatId 返回相同 Session", () => {
    clearSessionMap()
    expect(getOrCreateSession("chat_1")).toBe(getOrCreateSession("chat_1"))
  })
  it("不同 chatId 返回不同 Session", () => {
    clearSessionMap()
    expect(getOrCreateSession("chat_a")).not.toBe(getOrCreateSession("chat_b"))
  })
})
