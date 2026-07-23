/**
 * 端到端测试：Anthropic 兼容平台。
 */
import { describe, expect, test } from "bun:test"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  AnthropicCompatibleProvider,
  calculatorTool,
  codingAgent,
} from "../src/index"
import { createMockFetch } from "./mocks/fetch-mock"
import { anthropicScriptCalculator, anthropicTextResponse } from "./mocks/mock-responses"

describe("E2E-Anthropic: 消息 → 工具 → 结果", () => {
  test("完整 calculator 调用链", async () => {
    const { fetch, calls } = createMockFetch(anthropicScriptCalculator())
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://api.anthropic.com",
      apiKey: "sk-ant-test",
      model: "claude-sonnet-4-5-20250929",
      fetch,
    })
    const registry = new ToolRegistry()
    registry.register(calculatorTool)
    const memory = new MemoryStore()
    const agent = new AgentRuntime({ role: codingAgent, llm: provider, registry, memory })

    const result = await agent.chat("帮我算 1+2*3")
    expect(result.text).toBe("结果是 7")
    expect(result.toolCalls).toBe(1)

    // 验证 Anthropic 格式
    expect(calls).toHaveLength(2)
    const firstBody = calls[0]!.bodyJson as Record<string, unknown>
    expect(firstBody.model).toBe("claude-sonnet-4-5-20250929")
    expect(firstBody.max_tokens).toBe(4096)
    // system 不在 messages 数组中（Anthropic 规范）
    expect(firstBody.system).toBeDefined()
    const firstMessages = firstBody.messages as Array<{ role: string }>
    expect(firstMessages.every((m) => m.role !== "system")).toBe(true)

    // headers
    const headers = calls[0]!.options.headers as Record<string, string>
    expect(headers["x-api-key"]).toBe("sk-ant-test")
    expect(headers["anthropic-version"]).toBe("2023-06-01")
  })

  test("纯文本对话", async () => {
    const { fetch } = createMockFetch([anthropicTextResponse("你好，我是 Claude")])
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://api.anthropic.com", apiKey: "k", model: "m", fetch,
    })
    const registry = new ToolRegistry()
    const memory = new MemoryStore()
    const agent = new AgentRuntime({ role: codingAgent, llm: provider, registry, memory })
    const result = await agent.chat("hi")
    expect(result.text).toBe("你好，我是 Claude")
  })

  test("system prompt 通过顶层字段传递", async () => {
    const { fetch, calls } = createMockFetch([anthropicTextResponse("ok")])
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://api.anthropic.com", apiKey: "k", model: "m", fetch,
    })
    const agent = new AgentRuntime({
      role: { ...codingAgent, systemPrompt: "你是一个计算器助手" },
      llm: provider,
      registry: new ToolRegistry(),
      memory: new MemoryStore(),
    })
    await agent.chat("hi")
    const body = calls[0]!.bodyJson as Record<string, unknown>
    expect(body.system).toBe("你是一个计算器助手")
  })

  test("工具调用后 tool_result 归属 user 角色", async () => {
    const { fetch, calls } = createMockFetch(anthropicScriptCalculator())
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://api.anthropic.com", apiKey: "k", model: "m", fetch,
    })
    const registry = new ToolRegistry()
    registry.register(calculatorTool)
    const agent = new AgentRuntime({ role: codingAgent, llm: provider, registry, memory: new MemoryStore() })
    await agent.chat("算 1+2*3")
    // 第二次请求（工具结果后）应包含 tool_result block
    const secondBody = calls[1]!.bodyJson as Record<string, unknown>
    const secondMessages = secondBody.messages as Array<{ role: string; content: unknown[] }>
    const hasToolResult = secondMessages.some(
      (m) => Array.isArray(m.content) && m.content.some((b: { type?: string }) => b.type === "tool_result"),
    )
    expect(hasToolResult).toBe(true)
  })
})

describe("E2E-Anthropic: 错误恢复", () => {
  test("限流重试后成功", async () => {
    let count = 0
    const { fetch } = createMockFetch([
      () => { count++; return new Response("", { status: 429, headers: { "retry-after": "0" } }) },
      () => { count++; return anthropicTextResponse("ok after retry") },
    ])
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://x", apiKey: "k", model: "m", fetch, maxRetries: 2,
    })
    const agent = new AgentRuntime({
      role: codingAgent, llm: provider,
      registry: new ToolRegistry(), memory: new MemoryStore(),
    })
    const result = await agent.chat("hi")
    expect(result.text).toBe("ok after retry")
    expect(count).toBe(2)
  })
})
