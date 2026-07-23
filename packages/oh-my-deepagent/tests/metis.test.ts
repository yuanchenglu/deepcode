/**
 * metis 角色单元测试。
 */
import { describe, expect, test } from "bun:test"
import { metis, RoleRegistry, defineRole } from "../src/role"

describe("metis role", () => {
  test("角色定义可以被导入", () => {
    expect(metis).toBeDefined()
    expect(metis.id).toBe("metis")
    expect(metis.displayName).toBe("Metis")
  })

  test("角色名不含 Agent 后缀", () => {
    expect(metis.id).not.toMatch(/agent$/i)
    expect(metis.displayName).not.toMatch(/agent$/i)
  })

  test("systemPrompt 非空", () => {
    expect(metis.systemPrompt.length).toBeGreaterThan(0)
  })

  test("可以被注册到 RoleRegistry", () => {
    const r = new RoleRegistry()
    r.register(defineRole(metis))
    expect(r.has("metis")).toBe(true)
    expect(r.getStrict("metis").displayName).toBe("Metis")
  })
})
