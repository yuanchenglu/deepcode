/**
 * oracle 角色单元测试。
 */
import { describe, expect, test } from "bun:test"
import { oracle, RoleRegistry, defineRole } from "../src/role"

describe("oracle role", () => {
  test("角色定义可以被导入", () => {
    expect(oracle).toBeDefined()
    expect(oracle.id).toBe("oracle")
    expect(oracle.displayName).toBe("Oracle")
  })

  test("角色名不含 Agent 后缀", () => {
    expect(oracle.id).not.toMatch(/agent$/i)
    expect(oracle.displayName).not.toMatch(/agent$/i)
  })

  test("systemPrompt 非空", () => {
    expect(oracle.systemPrompt.length).toBeGreaterThan(0)
  })

  test("可以被注册到 RoleRegistry", () => {
    const r = new RoleRegistry()
    r.register(defineRole(oracle))
    expect(r.has("oracle")).toBe(true)
    expect(r.getStrict("oracle").displayName).toBe("Oracle")
  })
})
