/**
 * ToolRunner + validateArgs 单元测试。
 */
import { describe, expect, test } from "bun:test"
import { ToolRegistry, ToolRunner, validateArgs } from "../src/tool"
import type { Tool, ToolCall } from "../src/types"
import { ToolArgumentError, ToolNotFoundError } from "../src/errors"

function makeCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "call-1",
    name: "echo",
    arguments: { text: "hi" },
    ...overrides,
  }
}

describe("validateArgs", () => {
  test("合法 object 参数通过", () => {
    const schema = {
      type: "object" as const,
      properties: { a: { type: "string" as const }, b: { type: "number" as const } },
      required: ["a"],
    }
    expect(validateArgs(schema, { a: "x", b: 1 })).toEqual({ a: "x", b: 1 })
  })

  test("必填字段缺失抛 ToolArgumentError", () => {
    const schema = { type: "object" as const, properties: { a: { type: "string" as const } }, required: ["a"] }
    expect(() => validateArgs(schema, {})).toThrow(ToolArgumentError)
  })

  test("类型不符抛 ToolArgumentError", () => {
    const schema = { type: "object" as const, properties: { n: { type: "number" as const } } }
    expect(() => validateArgs(schema, { n: "abc" })).toThrow()
  })

  test("array items 递归校验", () => {
    const schema = {
      type: "object" as const,
      properties: {
        xs: { type: "array" as const, items: { type: "number" as const } },
      },
    }
    expect(validateArgs(schema, { xs: [1, 2, 3] })).toEqual({ xs: [1, 2, 3] })
    expect(() => validateArgs(schema, { xs: [1, "x"] })).toThrow()
  })
})

describe("ToolRunner", () => {
  test("参数合法 → isError=false", async () => {
    const r = new ToolRegistry()
    r.register({
      name: "echo",
      description: "",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      async execute(args) {
        return { echoed: args.text }
      },
    })
    const runner = new ToolRunner({ registry: r, sessionId: "s1", roleId: "coding-agent" })
    const res = await runner.execute(makeCall())
    expect(res.isError).toBe(false)
    expect(res.content).toContain("hi")
    expect(res.toolCallId).toBe("call-1")
    expect(res.name).toBe("echo")
  })

  test("必填缺失 → isError=true", async () => {
    const r = new ToolRegistry()
    r.register({
      name: "echo",
      description: "",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      async execute() {
        return "x"
      },
    })
    const runner = new ToolRunner({ registry: r })
    const res = await runner.execute(makeCall({ arguments: {} }))
    expect(res.isError).toBe(true)
    expect(res.content).toContain("text")
  })

  test("工具不存在 → isError=true 且包含 ToolNotFoundError", async () => {
    const r = new ToolRegistry()
    const runner = new ToolRunner({ registry: r })
    const res = await runner.execute(makeCall({ name: "nope" }))
    expect(res.isError).toBe(true)
    expect(res.content).toContain("nope")
    expect(res.content).toContain(ToolNotFoundError.name.replace("Error", ""))
  })

  test("工具抛异常 → isError=true 不抛出", async () => {
    const r = new ToolRegistry()
    r.register({
      name: "boom",
      description: "",
      parameters: { type: "object", properties: {} },
      async execute() {
        throw new Error("爆炸了")
      },
    })
    const warnings: string[] = []
    const runner = new ToolRunner({ registry: r, logger: { info() {}, warn: (m) => warnings.push(m) } })
    const res = await runner.execute(makeCall({ name: "boom", arguments: {} }))
    expect(res.isError).toBe(true)
    expect(res.content).toContain("爆炸了")
    expect(warnings.length).toBeGreaterThan(0)
  })

  test("返回对象被 JSON.stringify", async () => {
    const r = new ToolRegistry()
    r.register({
      name: "obj",
      description: "",
      parameters: { type: "object", properties: {} },
      async execute() {
        return { a: 1, b: [1, 2] }
      },
    })
    const runner = new ToolRunner({ registry: r })
    const res = await runner.execute(makeCall({ name: "obj", arguments: {} }))
    expect(res.isError).toBe(false)
    expect(JSON.parse(res.content)).toEqual({ a: 1, b: [1, 2] })
  })
})
