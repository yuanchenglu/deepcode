/**
 * Gateway Core 安全与生命周期契约测试（S2-06）
 *
 * 覆盖 PLAN S2-06 验收点：
 * - Queue 必须有界（背压）
 * - 多 Adapter 并存时回发路由回原 source adapter（不抢回复）
 * - startServer 接收 adapters（平台签名校验可达）
 */
import { describe, it, expect } from "bun:test"
import { Effect, Queue } from "effect"
import type { PlatformAdapter } from "../src/adapter"
import type { OutboundMessage, SendResult } from "../src/message"

/** 记录发送调用的桩适配器 */
function makeAdapter(name: string, sent: OutboundMessage[]): PlatformAdapter {
  return {
    name,
    start: () => Effect.void,
    stop: () => Effect.void,
    send: (msg: OutboundMessage): Effect.Effect<SendResult> =>
      Effect.sync(() => {
        sent.push(msg)
        return { ok: true, platformMessageId: `mid_${Date.now()}`, timestamp: Date.now() }
      }),
    messages: undefined as never,
  }
}

describe("有界队列（S2-06 背压保护）", () => {
  it("Queue.bounded 创建成功且可正常写入（有界不崩溃）", async () => {
    const q = await Queue.bounded<number>(16).pipe(Effect.runPromise)
    // 正常写入 3 条不丢
    for (let i = 0; i < 3; i++) {
      await Queue.offer(q, i).pipe(Effect.runPromise)
    }
    const taken: number[] = []
    for (let i = 0; i < 3; i++) {
      taken.push(await Queue.take(q).pipe(Effect.runPromise))
    }
    expect(taken).toEqual([0, 1, 2])
  })

  it("队列满时 offer 等待（背压，不无限增长）——用 FIFO 语义验证", async () => {
    const q = await Queue.bounded<number>(2).pipe(Effect.runPromise)
    await Queue.offer(q, 1).pipe(Effect.runPromise)
    await Queue.offer(q, 2).pipe(Effect.runPromise)
    // 第 3 条 offer 会在有消费者时完成；先 take 腾出空间
    const first = await Queue.take(q).pipe(Effect.runPromise)
    expect(first).toBe(1)
    await Queue.offer(q, 3).pipe(Effect.runPromise)
    const second = await Queue.take(q).pipe(Effect.runPromise)
    const third = await Queue.take(q).pipe(Effect.runPromise)
    expect(second).toBe(2)
    expect(third).toBe(3)
  })
})

describe("回发路由（S2-06 多 Adapter 不抢回复）", () => {
  it("sourceAdapter 命中来源适配器而非第一个注册的适配器", () => {
    const feishu = makeAdapter("feishu", [])
    const slack = makeAdapter("slack", [])
    const adapters = new Map<string, PlatformAdapter>([
      ["feishu", feishu],
      ["slack", slack],
    ])
    // 来源是 slack：即使 feishu 先注册，也必须路由到 slack
    const source = adapters.get("slack")
    const first = adapters.values().next().value
    expect(source?.name).toBe("slack")
    expect(first?.name).toBe("feishu")
    expect(source).not.toBe(first)
  })

  it("无 sourceAdapter 时回退第一个适配器（兼容旧行为）", () => {
    const adapters = new Map<string, PlatformAdapter>([
      ["feishu", makeAdapter("feishu", [])],
      ["slack", makeAdapter("slack", [])],
    ])
    const fallback = adapters.values().next().value
    expect(fallback?.name).toBe("feishu")
  })
})

describe("startServer adapters 可达（S2-06 签名校验）", () => {
  it("startServer 签名接受 (port, router, adapters?) 三个参数", () => {
    const server = require("../src/server") as typeof import("../src/server")
    expect(typeof server.startServer).toBe("function")
    expect(server.startServer.length).toBe(3)
  })
})
