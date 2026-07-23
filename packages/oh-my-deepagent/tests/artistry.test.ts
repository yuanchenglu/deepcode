/**
 * artistry 角色单元测试。
 */
import { describe, expect, test } from "bun:test"
import { artistry, RoleRegistry, defineRole } from "../src/role"

describe("artistry role", () => {
  test("角色定义可以被导入", () => {
    expect(artistry).toBeDefined()
    expect(artistry.id).toBe("artistry")
    expect(artistry.displayName).toBe("Artistry")
  })

  test("角色名不含 Agent 后缀", () => {
    expect(artistry.id).not.toMatch(/agent$/i)
    expect(artistry.displayName).not.toMatch(/agent$/i)
  })

  test("systemPrompt 非空", () => {
    expect(artistry.systemPrompt.length).toBeGreaterThan(0)
  })

  test("可以被注册到 RoleRegistry", () => {
    const r = new RoleRegistry()
    r.register(defineRole(artistry))
    expect(r.has("artistry")).toBe(true)
    expect(r.getStrict("artistry").displayName).toBe("Artistry")
  })
})
