/**
 * MemoryStore + FileMemoryPersistence + SessionMemory 单元测试。
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { MemoryStore, FileMemoryPersistence, InMemoryPersistence, SessionMemory } from "../src/memory"
import type { Message } from "../src/types"

function um(s: string): Message {
  return { role: "user", content: s }
}
function am(s: string): Message {
  return { role: "assistant", content: s }
}

describe("MemoryStore 纯内存", () => {
  test("append / all / lastN / byRole / clear", () => {
    const m = new MemoryStore()
    m.append("s1", um("u1"))
    m.append("s1", am("a1"))
    m.append("s1", um("u2"))
    expect(m.all("s1")).toHaveLength(3)
    expect(m.lastN("s1", 2)).toHaveLength(2)
    expect(m.lastN("s1", 2)[0]!.content).toBe("a1")
    expect(m.byRole("s1", "user")).toHaveLength(2)
    expect(m.byRole("s1", "assistant")).toHaveLength(1)
    m.clear("s1")
    expect(m.all("s1")).toHaveLength(0)
  })

  test("不同 session 隔离", () => {
    const m = new MemoryStore()
    m.append("a", um("x"))
    m.append("b", um("y"))
    expect(m.all("a")).toHaveLength(1)
    expect(m.all("b")).toHaveLength(1)
    expect(m.sessionIds().sort()).toEqual(["a", "b"])
  })

  test("appendMany 批量追加", () => {
    const m = new MemoryStore()
    m.appendMany("s", [um("a"), um("b")])
    expect(m.all("s")).toHaveLength(2)
  })
})

describe("FileMemoryPersistence", () => {
  test("save -> load 往返，原子写", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p = new FileMemoryPersistence({ dir })
    expect(existsSync(dir)).toBe(true)
    await p.save({ sessionId: "s1", messages: [um("hi")], updatedAt: "2026-07-22T00:00:00.000Z" })
    const loaded = await p.load("s1")
    expect(loaded?.messages).toHaveLength(1)
    expect(loaded?.messages[0]!.content).toBe("hi")
    // 文件存在
    expect(existsSync(join(dir, "s1.json"))).toBe(true)
  })

  test("不存在的 session load 返回 null", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p = new FileMemoryPersistence({ dir })
    expect(await p.load("nope")).toBeNull()
  })

  test("非法 JSON 返回 null 而非抛错", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p = new FileMemoryPersistence({ dir })
    // 直接写一个坏文件
    const fs = await import("node:fs")
    fs.writeFileSync(join(dir, "bad.json"), "{not json")
    expect(await p.load("bad")).toBeNull()
  })

  test("sessionId 含路径分隔符被替换", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p = new FileMemoryPersistence({ dir })
    await p.save({ sessionId: "a/b/c", messages: [um("x")], updatedAt: "t" })
    // 文件应该是 a_b_c.json
    const files = require("node:fs").readdirSync(dir)
    expect(files).toContain("a_b_c.json")
  })

  test("文件内容是格式化 JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p = new FileMemoryPersistence({ dir })
    await p.save({ sessionId: "s", messages: [um("hi")], updatedAt: "t" })
    const raw = readFileSync(join(dir, "s.json"), "utf-8")
    // 有缩进
    expect(raw).toContain("\n")
    expect(JSON.parse(raw).messages[0].content).toBe("hi")
  })
})

describe("MemoryStore + persistence 集成", () => {
  test("hydrate 从磁盘恢复历史", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p1 = new FileMemoryPersistence({ dir })
    const m1 = new MemoryStore({ persistence: p1 })
    m1.append("s1", um("u1"))
    m1.append("s1", am("a1"))
    await m1.flush("s1")

    const p2 = new FileMemoryPersistence({ dir })
    const m2 = new MemoryStore({ persistence: p2 })
    const msgs = await m2.hydrate("s1")
    expect(msgs).toHaveLength(2)
    expect(msgs[0]!.content).toBe("u1")
  })

  test("append 触发异步 flush（不阻塞）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-mem-"))
    const p = new FileMemoryPersistence({ dir })
    const m = new MemoryStore({ persistence: p })
    m.append("s1", um("hello"))
    // 等微任务跑完
    await new Promise((r) => setTimeout(r, 50))
    const back = await p.load("s1")
    expect(back?.messages).toHaveLength(1)
  })
})

describe("InMemoryPersistence", () => {
  test("save/load/clear", async () => {
    const p = new InMemoryPersistence()
    await p.save({ sessionId: "s", messages: [um("x")], updatedAt: "t" })
    expect((await p.load("s"))?.messages).toHaveLength(1)
    p.clear()
    expect(await p.load("s")).toBeNull()
  })
})

describe("SessionMemory", () => {
  test("门面方法转发到 MemoryStore", async () => {
    const store = new MemoryStore()
    const sm = new SessionMemory(store, "my-sess")
    sm.append(um("hello"))
    expect(sm.all()).toHaveLength(1)
    expect(sm.lastN(1)[0]!.content).toBe("hello")
    sm.append(am("hi"))
    expect(sm.byRole("assistant")).toHaveLength(1)
    sm.clear()
    expect(sm.all()).toHaveLength(0)
  })
})
