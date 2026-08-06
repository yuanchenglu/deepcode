/**
 * 角色名回归测试：确保新角色名不含 "Agent" 后缀，
 * 并验证所有 13 个角色均在 defaultRoles 中可访问。
 *
 * 已知遗留：coding / codingMini / builder / knowledge / planner / system 的
 * id 仍以 "-agent" 结尾，displayName 含 "Agent"（从上游继承的命名约定），暂不改动。
 * 所有新增角色必须遵守无 "Agent" 后缀规则。
 */
import { describe, expect, test } from "bun:test"
import {
  defaultRoles,
  coding,
  codingMini,
  builder,
  knowledge,
  planner,
  reviewer,
  system,
  coordinator,
  search,
  oracle,
  metis,
  momus,
  multimodal,
  artistry,
} from "../src/role"

/** 遗留角色（允许含 "Agent"） */
const legacyRoleIds = new Set(["coding", "codingMini", "builder", "knowledge", "planner", "system"])

/** 所有 14 个角色 */
const allRoles = [
  { key: "coding", role: coding },
  { key: "codingMini", role: codingMini },
  { key: "builder", role: builder },
  { key: "knowledge", role: knowledge },
  { key: "planner", role: planner },
  { key: "reviewer", role: reviewer },
  { key: "system", role: system },
  { key: "coordinator", role: coordinator },
  { key: "search", role: search },
  { key: "oracle", role: oracle },
  { key: "metis", role: metis },
  { key: "momus", role: momus },
  { key: "multimodal", role: multimodal },
  { key: "artistry", role: artistry },
]

describe("角色名回归测试", () => {
  test("allRoles 包含 14 个角色", () => {
    expect(allRoles).toHaveLength(14)
  })

  test("每个角色 id 使用合法短横线命名法", () => {
    for (const { role } of allRoles) {
      expect(role.id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  test("每个角色 systemPrompt 非空", () => {
    for (const { role } of allRoles) {
      expect(role.systemPrompt.length).toBeGreaterThan(0)
    }
  })

  test("新增角色（非遗留 6 个）名称不含 Agent 后缀", () => {
    for (const { key, role } of allRoles) {
      if (legacyRoleIds.has(key)) continue
      expect(role.id).not.toMatch(/agent$/i)
      expect(role.displayName).not.toMatch(/agent/i)
    }
  })

  test("defaultRoles 包含全部 14 个", () => {
    const keys = Object.keys(defaultRoles)
    expect(keys).toHaveLength(14)
    expect(keys.sort()).toEqual(
      ["artistry", "builder", "coding", "codingMini", "coordinator",
       "knowledge", "metis", "momus", "multimodal", "oracle",
       "planner", "reviewer", "search", "system"].sort(),
    )
  })

  test("每个 defaultRoles 条目可按 key 正确索引", () => {
    for (const { key, role } of allRoles) {
      expect(defaultRoles[key]).toBe(role)
    }
  })
})
