/**
 * AgentRuntime 单元测试。
 */
import { describe, expect, test } from "bun:test"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  MockLLMProvider,
  codingAgent,
  echoTool,
  calculatorTool,
  createNowTool,
  type Tool,
} from "../src/index"

function makeRuntime(opts: {
  script?: ConstructorParameters<typeof MockLLMProvider>[0]
  tools?: Tool[]
  maxSteps?: number
  fallback?: ConstructorParameters<typeof MockLLMProvider>[1] extends infer O ? (O extends { fallback?: infer F } ? F : never) : never
}) {
  const registry = new ToolRegistry()
  for (const t of opts.tools ?? [echoTool]) registry.register(t)
  const memory = new MemoryStore()
  const llm = new MockLLMProvider(opts.script ?? [], { fallback: opts.fallback })
  const agent = new AgentRuntime({
    role: codingAgent,
    llm,
    registry,
    memory,
    maxSteps: opts.maxSteps ?? 8,
  })
  return { agent, registry, memory, llm }
}

describe("AgentRuntime.chat", () => {
  test("无工具调用时直接返回文本", async () => {
    const { agent, memory } = makeRuntime({ script: [{ content: "Hello" }] })
    const r = await agent.chat("hi")
    expect(r.text).toBe("Hello")
    expect(r.toolCalls).toBe(0)
    expect(r.stoppedReason).toBe("completed")
    // memory 中包含 user 和 assistant（system 提示词在循环时临时注入，不持久化）
    const msgs = memory.all("default")
    expect(msgs.some((m) => m.role === "user" && m.content === "hi")).toBe(true)
    expect(msgs.some((m) => m.role === "assistant" && m.content === "Hello")).toBe(true)
    // 但 LLM 确实收到了 system 消息（见 system prompt 注入测试）
  })

  test("单工具调用：LLM 第 1 轮请求工具，第 2 轮返回文本", async () => {
    const { agent, memory } = makeRuntime({
      tools: [calculatorTool],
      script: [
        { content: "", toolCalls: [{ id: "c1", name: "calculator", arguments: { expression: "1+2" } }] },
        { content: "结果是 3" },
      ],
    })
    const r = await agent.chat("算 1+2")
    expect(r.toolCalls).toBe(1)
    expect(r.text).toBe("结果是 3")
    // 检查 memory 中有 tool 消息
    const toolMsgs = memory.all("default").filter((m) => m.role === "tool")
    expect(toolMsgs).toHaveLength(1)
    expect(toolMsgs[0]!.content).toContain("3")
  })

  test("一轮内多个工具调用全部执行", async () => {
    const { agent, memory } = makeRuntime({
      tools: [echoTool],
      script: [
        {
          content: "",
          toolCalls: [
            { id: "c1", name: "echo", arguments: { text: "a" } },
            { id: "c2", name: "echo", arguments: { text: "b" } },
          ],
        },
        { content: "done" },
      ],
    })
    const r = await agent.chat("x")
    expect(r.toolCalls).toBe(2)
    expect(memory.all("default").filter((m) => m.role === "tool")).toHaveLength(2)
  })

  test("maxSteps=1 限制循环", async () => {
    const { agent } = makeRuntime({
      tools: [echoTool],
      maxSteps: 1,
      script: [
        { content: "", toolCalls: [{ id: "c1", name: "echo", arguments: { text: "a" } }] },
        // 第二轮永远返回工具调用以触发超限（实际会被 maxSteps 截断）
      ],
      fallback: { content: "", toolCalls: [{ id: "cx", name: "echo", arguments: { text: "x" } }] },
    })
    const r = await agent.chat("x")
    // 至少执行了一次工具
    expect(r.toolCalls).toBeGreaterThan(0)
  })

  test("工具异常不中断 runtime，错误回传 LLM", async () => {
    const boomTool: Tool = {
      name: "boom",
      description: "always throws",
      parameters: { type: "object", properties: {} },
      async execute() {
        throw new Error("boom!")
      },
    }
    const { agent } = makeRuntime({
      tools: [boomTool],
      script: [
        { content: "", toolCalls: [{ id: "c1", name: "boom", arguments: {} }] },
        { content: "got error" },
      ],
    })
    const r = await agent.chat("x")
    expect(r.text).toBe("got error")
    expect(r.toolCalls).toBe(1)
  })

  test("system prompt 自动注入，包含角色 displayName", async () => {
    const { agent, llm } = makeRuntime({ script: [{ content: "hi" }] })
    await agent.chat("hello")
    expect(llm.calls.length).toBeGreaterThan(0)
    const first = llm.calls[0]!.messages[0]!
    expect(first.role).toBe("system")
    expect(first.content).toContain("Coding Agent")
  })

  test("跨轮 chat 历史被保留", async () => {
    const { agent, llm } = makeRuntime({
      script: [{ content: "r1" }, { content: "r2" }],
    })
    await agent.chat("q1")
    await agent.chat("q2")
    const secondCall = llm.calls[1]!
    const userMsgs = secondCall.messages.filter((m) => m.role === "user")
    expect(userMsgs).toHaveLength(2)
  })

  test("resetSession 清空历史", async () => {
    const { agent, llm } = makeRuntime({
      script: [{ content: "r1" }, { content: "r2" }],
    })
    await agent.chat("q1")
    agent.resetSession()
    await agent.chat("q2")
    const secondCall = llm.calls[1]!
    // reset 后第二条 chat 的 user 消息只有 q2
    const userMsgs = secondCall.messages.filter((m) => m.role === "user")
    expect(userMsgs).toHaveLength(1)
    expect(userMsgs[0]!.content).toBe("q2")
  })
})
