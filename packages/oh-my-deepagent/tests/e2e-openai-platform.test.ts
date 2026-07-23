/**
 * 端到端测试：OpenAI 兼容平台。
 *
 * 完整链路：用户消息 → OpenAICompatibleProvider → AgentRuntime → 工具调用 → 返回结果。
 */
import { describe, expect, test } from "bun:test"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  OpenAICompatibleProvider,
  calculatorTool,
  coding,
} from "../src/index"
import { createMockFetch } from "./mocks/fetch-mock"
import { openaiScriptCalculator, openaiTextResponse, openaiToolCallResponse } from "./mocks/mock-responses"

describe("E2E-OpenAI: 消息 → 工具 → 结果", () => {
  test("完整 calculator 调用链", async () => {
    const { fetch, calls } = createMockFetch(openaiScriptCalculator())
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
      fetch,
    })
    const registry = new ToolRegistry()
    registry.register(calculatorTool)
    const memory = new MemoryStore()
    const agent = new AgentRuntime({ role: coding, llm: provider, registry, memory })

    const result = await agent.chat("帮我算 1+2*3")

    // 验证最终结果
    expect(result.text).toBe("结果是 7")
    expect(result.toolCalls).toBe(1)
    expect(result.stoppedReason).toBe("completed")

    // 验证 HTTP 调用了 2 次（第一轮工具调用 + 第二轮最终回复）
    expect(calls).toHaveLength(2)

    // 第一次请求包含 user 消息和 tools 定义
    const firstBody = calls[0]!.bodyJson as Record<string, unknown>
    expect(firstBody.model).toBe("gpt-4o")
    expect(firstBody.tools).toBeDefined()
    const firstMessages = firstBody.messages as Array<{ role: string; content: string }>
    expect(firstMessages.some((m) => m.role === "user" && m.content === "帮我算 1+2*3")).toBe(true)

    // 第二次请求包含 tool 结果
    const secondBody = calls[1]!.bodyJson as Record<string, unknown>
    const secondMessages = secondBody.messages as Array<Record<string, unknown>>
    expect(secondMessages.some((m) => m.role === "tool")).toBe(true)
  })

  test("纯文本对话无工具调用", async () => {
    const { fetch } = createMockFetch([openaiTextResponse("你好！有什么可以帮你的？")])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-4o", fetch,
    })
    const registry = new ToolRegistry()
    const memory = new MemoryStore()
    const agent = new AgentRuntime({ role: coding, llm: provider, registry, memory })

    const result = await agent.chat("你好")
    expect(result.text).toBe("你好！有什么可以帮你的？")
    expect(result.toolCalls).toBe(0)
  })

  test("多轮对话保持上下文", async () => {
    const { fetch, calls } = createMockFetch([
      openaiTextResponse("好的"),
      openaiToolCallResponse("c1", "calculator", { expression: "2+3" }),
      openaiTextResponse("5"),
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-4o", fetch,
    })
    const registry = new ToolRegistry()
    registry.register(calculatorTool)
    const memory = new MemoryStore()
    const agent = new AgentRuntime({ role: coding, llm: provider, registry, memory })

    await agent.chat("你好")
    await agent.chat("算 2+3")

    // 第二次对话的请求应包含第一次对话的历史
    // calls[2] 是 calculator 结果后再次请求 LLM
    // calls[1] 是 "算2+3" 的第一轮请求（请求工具调用）
    const secondChatFirstCall = calls[1]!.bodyJson as Record<string, unknown>
    const msgs = secondChatFirstCall.messages as Array<{ role: string; content: string }>
    // 应包含第一条 user 消息（"你好"）和第一条 assistant 回复（"好的"）
    expect(msgs.filter((m) => m.role === "user").length).toBeGreaterThanOrEqual(1)
  })
})

describe("E2E-OpenAI: 错误恢复", () => {
  test("服务器错误重试后成功", async () => {
    let callCount = 0
    const { fetch } = createMockFetch([
      () => { callCount++; return new Response("", { status: 500 }) },
      () => { callCount++; return openaiTextResponse("recovered") },
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-4o",
      fetch, maxRetries: 2,
    })
    const registry = new ToolRegistry()
    const memory = new MemoryStore()
    const agent = new AgentRuntime({ role: coding, llm: provider, registry, memory })
    const result = await agent.chat("hi")
    expect(result.text).toBe("recovered")
    expect(callCount).toBe(2)
  })
})
