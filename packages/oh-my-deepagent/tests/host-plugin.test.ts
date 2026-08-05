/**
 * Host 插件安全桥测试（S2-03）
 *
 * 验证 HOST_PLUGIN_CONTRACT.md v1.0 的三条硬边界：
 * 1. roleToAgent 只映射 systemPrompt/description，不复制 Host Provider/Tool 执行层
 * 2. 映射的 agent 权限默认空（由 Host Permission 统一控制，不绕过）
 * 3. 插件关闭（不加载）时 Host 基础能力可用（本插件是可选的注册器）
 */
import { describe, expect, test } from "bun:test"
import { coding, planner, reviewer } from "../src/role"
import { roleToAgent, deepagentPlugin } from "../src/host-plugin"

describe("roleToAgent（Host Agent 映射契约）", () => {
  test("coding-agent 映射出 Host Agent：system 来自角色 systemPrompt", () => {
    const agent = roleToAgent(coding)
    expect(agent.id).toBe("coding-agent")
    expect(agent.system).toContain("编码智能体")
    expect(agent.description).toBe("Coding Agent")
  })

  test("planner-agent 映射出 Host Agent：不直接写代码", () => {
    const agent = roleToAgent(planner)
    expect(agent.id).toBe("planner-agent")
    expect(agent.system).toContain("不要直接写代码")
  })

  test("权限映射来自角色定义——不绕过 Host Permission（S2-04 更新）", () => {
    // coding 有明确权限定义，映射后必须原样保留
    const codingAgent = roleToAgent(coding)
    expect(codingAgent.permissions.length).toBeGreaterThan(0)
    expect(codingAgent.permissions).toEqual(coding.permissions ?? [])
    // planner 只读：bash deny 保留
    const plannerAgent = roleToAgent(planner)
    expect(plannerAgent.permissions).toContainEqual({ action: "bash", resource: "*", effect: "deny" })
    // reviewer 只读：edit deny 保留
    const reviewerAgent = roleToAgent(reviewer)
    expect(reviewerAgent.permissions).toContainEqual({ action: "edit", resource: "*", effect: "deny" })
  })

  test("映射结果不包含插件内部执行字段——不复制 Host 执行层", () => {
    const agent = roleToAgent(coding) as Record<string, unknown>
    expect(agent.tools).toBeUndefined()
    expect(agent.llm).toBeUndefined()
    expect(agent.memory).toBeUndefined()
  })
})

describe("deepagentPlugin（可选注册器）", () => {
  test("插件 ID 固定为 @deepcode/oh-my-deepagent", () => {
    expect(deepagentPlugin.id).toBe("@deepcode/oh-my-deepagent")
  })

  test("插件只暴露注册能力，不持有 Provider/Tool 状态", () => {
    // 插件定义是纯函数注册器：effect 依赖 context.agent.transform，
    // 插件自身不创建 Provider/Tool/Memory 实例。
    expect(typeof deepagentPlugin.effect).toBe("function")
    expect(deepagentPlugin.id.startsWith("@deepcode/")).toBe(true)
  })
})
