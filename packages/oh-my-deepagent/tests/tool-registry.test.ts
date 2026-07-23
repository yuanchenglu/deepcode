/**
 * ToolRegistry 单元测试。
 */
import { describe, expect, test } from "bun:test"
import { ToolRegistry } from "../src/tool"
import type { Tool } from "../src/types"
import { AlreadyRegisteredError } from "../src/errors"

function makeTool(name: string): Tool {
  return {
    name,
    description: `${name} desc`,
    parameters: { type: "object", properties: {} },
    async execute() {
      return { ok: true }
    },
  }
}

describe("ToolRegistry", () => {
  test("register 后 get/list/has/descriptors 正确", () => {
    const r = new ToolRegistry()
    const t = makeTool("foo")
    r.register(t)
    expect(r.has("foo")).toBe(true)
    expect(r.get("foo")).toBe(t)
    expect(r.list()).toHaveLength(1)
    const descs = r.descriptors()
    expect(descs[0]!.name).toBe("foo")
    expect(descs[0]!.description).toBe("foo desc")
  })

  test("重复注册抛 AlreadyRegisteredError", () => {
    const r = new ToolRegistry()
    r.register(makeTool("foo"))
    expect(() => r.register(makeTool("foo"))).toThrow(AlreadyRegisteredError)
  })

  test("unregister 不存在返回 false", () => {
    const r = new ToolRegistry()
    expect(r.unregister("nope")).toBe(false)
    r.register(makeTool("foo"))
    expect(r.unregister("foo")).toBe(true)
    expect(r.has("foo")).toBe(false)
  })

  test("descriptors 返回 ToolDescriptor 结构", () => {
    const r = new ToolRegistry()
    r.register(makeTool("alpha"))
    r.register(makeTool("beta"))
    expect(r.descriptors()).toEqual([
      { name: "alpha", description: "alpha desc", parameters: { type: "object", properties: {} } },
      { name: "beta", description: "beta desc", parameters: { type: "object", properties: {} } },
    ])
  })

  test("clear 清空所有工具", () => {
    const r = new ToolRegistry()
    r.register(makeTool("a"))
    r.register(makeTool("b"))
    r.clear()
    expect(r.list()).toHaveLength(0)
  })

  test("list 顺序与注册顺序一致", () => {
    const r = new ToolRegistry()
    for (const n of ["z", "a", "m"]) r.register(makeTool(n))
    expect(r.list().map((t) => t.name)).toEqual(["z", "a", "m"])
  })
})
