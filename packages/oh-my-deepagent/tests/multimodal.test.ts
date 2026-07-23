/**
 * multimodal 角色单元测试。
 */
import { describe, expect, test } from "bun:test"
import { multimodal, RoleRegistry, defineRole } from "../src/role"

describe("multimodal role", () => {
  test("角色定义可以被导入", () => {
    expect(multimodal).toBeDefined()
    expect(multimodal.id).toBe("multimodal")
    expect(multimodal.displayName).toBe("Multimodal")
  })

  test("角色名不含 Agent 后缀", () => {
    expect(multimodal.id).not.toMatch(/agent$/i)
    expect(multimodal.displayName).not.toMatch(/agent$/i)
  })

  test("systemPrompt 非空", () => {
    expect(multimodal.systemPrompt.length).toBeGreaterThan(0)
  })

  test("可以被注册到 RoleRegistry", () => {
    const r = new RoleRegistry()
    r.register(defineRole(multimodal))
    expect(r.has("multimodal")).toBe(true)
    expect(r.getStrict("multimodal").displayName).toBe("Multimodal")
  })
})
