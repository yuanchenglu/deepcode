/**
 * momus 角色单元测试。
 */
import { describe, expect, test } from "bun:test"
import { momus, RoleRegistry, defineRole } from "../src/role"

describe("momus role", () => {
  test("角色定义可以被导入", () => {
    expect(momus).toBeDefined()
    expect(momus.id).toBe("momus")
    expect(momus.displayName).toBe("Momus")
  })

  test("角色名不含 Agent 后缀", () => {
    expect(momus.id).not.toMatch(/agent$/i)
    expect(momus.displayName).not.toMatch(/agent$/i)
  })

  test("systemPrompt 非空", () => {
    expect(momus.systemPrompt.length).toBeGreaterThan(0)
  })

  test("可以被注册到 RoleRegistry", () => {
    const r = new RoleRegistry()
    r.register(defineRole(momus))
    expect(r.has("momus")).toBe(true)
    expect(r.getStrict("momus").displayName).toBe("Momus")
  })
})
