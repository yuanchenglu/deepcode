/**
 * RoleRegistry + 默认角色 单元测试。
 */
import { describe, expect, test } from "bun:test"
import {
  RoleRegistry,
  defineRole,
  renderSystemPrompt,
  createDefaultRoleRegistry,
  defaultRoles,
  codingAgent,
  builderAgent,
  knowledgeAgent,
  plannerAgent,
  systemAgent,
  codingAgentMini,
} from "../src/role"
import { AlreadyRegisteredError, RoleNotFoundError } from "../src/errors"

describe("RoleRegistry", () => {
  test("register / get / getStrict / has / list / unregister", () => {
    const r = new RoleRegistry()
    const role = defineRole({
      id: "my-role",
      displayName: "My Role",
      systemPrompt: "you are {role}",
      tools: [],
      skills: [],
    })
    r.register(role)
    expect(r.has("my-role")).toBe(true)
    expect(r.get("my-role")?.displayName).toBe("My Role")
    expect(r.getStrict("my-role").id).toBe("my-role")
    expect(r.list()).toHaveLength(1)
    expect(r.unregister("my-role")).toBe(true)
    expect(r.has("my-role")).toBe(false)
  })

  test("重复注册抛 AlreadyRegisteredError", () => {
    const r = new RoleRegistry()
    const role = defineRole({ id: "x", displayName: "X", systemPrompt: "x", tools: [], skills: [] })
    r.register(role)
    expect(() => r.register(role)).toThrow(AlreadyRegisteredError)
  })

  test("getStrict 对未知角色抛 RoleNotFoundError", () => {
    const r = new RoleRegistry()
    expect(() => r.getStrict("nope")).toThrow(RoleNotFoundError)
  })
})

describe("renderSystemPrompt", () => {
  test("替换 {role} 占位符", () => {
    const role = defineRole({ id: "x", displayName: "MyBot", systemPrompt: "你是 {role}.", tools: [], skills: [] })
    expect(renderSystemPrompt(role)).toBe("你是 MyBot.")
  })
})

describe("默认角色", () => {
  test("createDefaultRoleRegistry 含 6 个角色", () => {
    const r = createDefaultRoleRegistry()
    expect(r.list().map((x) => x.id).sort()).toEqual(
      ["coding-agent", "coding-agent-mini", "builder-agent", "knowledge-agent", "planner-agent", "system-agent"].sort(),
    )
  })

  test("每个默认角色 id 与 displayName 都符合命名规范", () => {
    for (const role of [codingAgent, codingAgentMini, builderAgent, knowledgeAgent, plannerAgent, systemAgent]) {
      expect(role.id).toMatch(/^[a-z][a-z0-9-]+$/)
      expect(role.displayName.length).toBeGreaterThan(0)
      expect(role.systemPrompt.length).toBeGreaterThan(10)
    }
  })

  test("defaultRoles 包含全部 6 个", () => {
    expect(Object.keys(defaultRoles).sort()).toEqual(
      ["codingAgent", "codingAgentMini", "builderAgent", "knowledgeAgent", "plannerAgent", "systemAgent"].sort(),
    )
  })

  test("所有角色名不含旧的 sisyphus/hephaestus/atlas/prometheus/oracle", () => {
    const all = Object.values(defaultRoles)
      .map((r) => `${r.id} ${r.displayName} ${r.systemPrompt}`)
      .join("\n")
    for (const old of ["sisyphus", "hephaestus", "atlas", "prometheus", "oracle"]) {
      expect(all.toLowerCase()).not.toContain(old)
    }
  })

  test("角色 tools 字段指向已定义的内置工具", () => {
    const knownTools = ["echo", "calculator", "now", "plan_reader"]
    for (const role of Object.values(defaultRoles)) {
      for (const t of role.tools) {
        expect(knownTools).toContain(t)
      }
    }
  })
})
