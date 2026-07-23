/**
 * 端到端测试：Agent 接收消息 → 调用工具 → 返回结果。
 * 覆盖验收点 9。
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  FileMemoryPersistence,
  MockLLMProvider,
  SkillManager,
  Planner,
  PlanExecutor,
  codingAgent,
  calculatorTool,
  stepsFromDescriptions,
  defaultRoles,
  createDefaultRoleRegistry,
  parseSkillMarkdown,
  toSkill,
  type Tool,
  type Plan,
} from "../src/index"

describe("E2E-1: 消息 → 工具 → 结果", () => {
  test("用户让 Agent 算 1+2*3，Agent 调 calculator 并回复结果", async () => {
    const registry = new ToolRegistry()
    registry.register(calculatorTool)
    const memory = new MemoryStore()
    const llm = new MockLLMProvider([
      // 第一轮：请求 calculator
      {
        content: "",
        toolCalls: [{ id: "c1", name: "calculator", arguments: { expression: "1+2*3" } }],
      },
      // 第二轮：根据工具结果回复
      { content: "结果是 7" },
    ])
    const agent = new AgentRuntime({ role: codingAgent, llm, registry, memory })
    const r = await agent.chat("帮我算 1+2*3")

    // 验收点 1：返回结果
    expect(r.text).toBe("结果是 7")
    // 验收点 1：工具被调用一次
    expect(r.toolCalls).toBe(1)
    // 记忆完整（system 在运行时注入，不持久化到 memory）
    const msgs = memory.all("default")
    expect(msgs.some((m) => m.role === "user" && m.content === "帮我算 1+2*3")).toBe(true)
    expect(msgs.some((m) => m.role === "tool")).toBe(true)
    const finalAssistant = [...msgs].reverse().find((m) => m.role === "assistant")
    expect(finalAssistant?.content).toBe("结果是 7")
  })
})

describe("E2E-2: 技能加载/卸载 + Agent 调用技能提供的工具", () => {
  test("加载 test-calculator 技能 -> add 工具可用 -> 卸载后不可用", async () => {
    // 建一个临时技能目录
    const dir = mkdtempSync(join(tmpdir(), "da-e2e-skill-"))
    writeFileSync(join(dir, "SKILL.md"), "---\nname: add-skill\ndescription: adds numbers\n---\n# body")

    const addTool: Tool = {
      name: "add",
      description: "add two numbers",
      parameters: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
      async execute({ a, b }) {
        return { sum: Number(a) + Number(b) }
      },
    }

    const registry = new ToolRegistry()
    const mgr = new SkillManager({ registry })
    expect(registry.has("add")).toBe(false)
    await mgr.loadFromDir(dir, [addTool])
    expect(registry.has("add")).toBe(true)

    // Agent 能调用 add 工具
    const memory = new MemoryStore()
    const llm = new MockLLMProvider([
      { content: "", toolCalls: [{ id: "c1", name: "add", arguments: { a: 2, b: 3 } }] },
      { content: "2+3=5" },
    ])
    const agent = new AgentRuntime({ role: codingAgent, llm, registry, memory, skillManager: mgr })
    const r = await agent.chat("2 加 3 等于几")
    expect(r.text).toBe("2+3=5")
    expect(r.toolCalls).toBe(1)

    // 卸载后工具消失
    await mgr.unload("add-skill")
    expect(registry.has("add")).toBe(false)
  })
})

describe("E2E-3: 规划 + 执行追踪", () => {
  test("Planner 拆解任务 → PlanExecutor 顺序执行完成", async () => {
    // 用 createPlanFromList 避免依赖 LLM
    const planner = new Planner()
    const plan = planner.createPlanFromList("发布一个最小 CLI", ["写代码", "写测试", "打包发布"])

    const results: string[] = []
    const exec = new PlanExecutor({
      plan,
      handler: async (step) => {
        const r = `完成: ${step.description}`
        results.push(r)
        return r
      },
    })
    const final = await exec.runAll()
    expect(final.status).toBe("done")
    expect(final.steps.every((s) => s.status === "done")).toBe(true)
    expect(results).toEqual(["完成: 写代码", "完成: 写测试", "完成: 打包发布"])
    expect(final.steps.map((s) => s.result)).toEqual(results)
  })
})

describe("E2E-4: 会话记忆持久化（重启 MemoryStore 后历史仍在）", () => {
  test("写盘后重新加载，历史消息恢复", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-e2e-mem-"))
    // 第一次会话
    {
      const p = new FileMemoryPersistence({ dir })
      const m = new MemoryStore({ persistence: p })
      const llm = new MockLLMProvider([{ content: "pong" }])
      const registry = new ToolRegistry()
      const agent = new AgentRuntime({ role: codingAgent, llm, registry, memory: m })
      await agent.chat("ping")
      await m.flush("default")
    }
    // 第二次会话：hydrate
    {
      const p = new FileMemoryPersistence({ dir })
      const m = new MemoryStore({ persistence: p })
      await m.hydrate("default")
      const msgs = m.all("default")
      // system 消息不会自动加，因为我们没跑 chat，但 user/assistant 应在
      expect(msgs.some((x) => x.role === "user" && x.content === "ping")).toBe(true)
      expect(msgs.some((x) => x.role === "assistant" && x.content === "pong")).toBe(true)
    }
  })
})

describe("E2E-5: 默认角色全部可注册，角色命名为易懂英文", () => {
  test("createDefaultRoleRegistry 注册 6 个角色，命名符合验收点 6", () => {
    const reg = createDefaultRoleRegistry()
    expect(reg.list().map((r) => r.id).sort()).toEqual(
      ["coding-agent", "coding-agent-mini", "builder-agent", "knowledge-agent", "planner-agent", "system-agent"].sort(),
    )
    // 所有默认角色都能构造 AgentRuntime（不抛错）
    for (const role of Object.values(defaultRoles)) {
      const registry = new ToolRegistry()
      const memory = new MemoryStore()
      const llm = new MockLLMProvider([{ content: "ok" }])
      const agent = new AgentRuntime({ role, llm, registry, memory })
      expect(agent.getRole().id).toBe(role.id)
    }
  })
})
