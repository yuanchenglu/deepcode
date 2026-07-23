/**
 * AnthropicCompatibleProvider 单元测试。
 */
import { describe, expect, test } from "bun:test"
import {
  AnthropicCompatibleProvider,
  messagesToAnthropic,
  descriptorsToAnthropic,
  parseAnthropicResponse,
  LLMAuthError,
  LLMError,
} from "../src/llm"
import type { Message, ToolDescriptor } from "../src/types"
import { createMockFetch, jsonResponse } from "./mocks/fetch-mock"

const SAMPLE_TOOLS: ToolDescriptor[] = [
  {
    name: "calculator",
    description: "calc",
    parameters: {
      type: "object",
      properties: { expression: { type: "string" } },
      required: ["expression"],
    },
  },
]

describe("messagesToAnthropic", () => {
  test("system 被分离到顶层", () => {
    const out = messagesToAnthropic([
      { role: "system", content: "you are helpful" },
      { role: "user", content: "hi" },
    ])
    expect(out.system).toBe("you are helpful")
    expect(out.messages).toHaveLength(1)
    expect(out.messages[0]).toEqual({ role: "user", content: [{ type: "text", text: "hi" }] })
  })

  test("assistant + tool_call 映射为 tool_use block（带前置 user 消息）", () => {
    const out = messagesToAnthropic([
      { role: "user", content: "算 1+1" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "tu1", name: "calculator", arguments: { expression: "1+1" } }],
      },
    ])
    expect(out.system).toBeUndefined()
    expect(out.messages).toHaveLength(2)
    // assistant 是第二条
    const asst = out.messages[1]!
    expect(asst.role).toBe("assistant")
    expect(asst.content[0]).toEqual({
      type: "tool_use",
      id: "tu1",
      name: "calculator",
      input: { expression: "1+1" },
    })
  })

  test("首条为 assistant 时插入占位 user（Anthropic 要求）", () => {
    const out = messagesToAnthropic([
      { role: "assistant", content: "hi" },
    ])
    expect(out.messages[0]!.role).toBe("user")
    expect(out.messages[1]!.role).toBe("assistant")
  })

  test("tool 结果映射为 user role + tool_result block", () => {
    const out = messagesToAnthropic([
      { role: "tool", content: "2", toolCallId: "tu1", name: "calculator" },
    ])
    expect(out.messages[0]!.role).toBe("user")
    expect(out.messages[0]!.content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "tu1",
      content: "2",
    })
  })

  test("assistant 文本 + tool_use 同时存在（带前置 user）", () => {
    const out = messagesToAnthropic([
      { role: "user", content: "算 1+1" },
      {
        role: "assistant",
        content: "我来算一下",
        toolCalls: [{ id: "tu1", name: "calculator", arguments: { expression: "1+1" } }],
      },
    ])
    const asst = out.messages[1]!
    expect(asst.content).toHaveLength(2)
    expect(asst.content[0]).toEqual({ type: "text", text: "我来算一下" })
    expect(asst.content[1]).toMatchObject({ type: "tool_use", id: "tu1" })
  })

  test("无 system 时 system 为 undefined", () => {
    const out = messagesToAnthropic([{ role: "user", content: "hi" }])
    expect(out.system).toBeUndefined()
  })
})

describe("descriptorsToAnthropic", () => {
  test("映射为 input_schema 格式", () => {
    const out = descriptorsToAnthropic(SAMPLE_TOOLS)
    expect(out).toEqual([
      { name: "calculator", description: "calc", input_schema: SAMPLE_TOOLS[0]!.parameters as unknown as Record<string, unknown> },
    ])
  })
})

describe("parseAnthropicResponse", () => {
  test("纯文本响应", () => {
    const r = parseAnthropicResponse({
      content: [{ type: "text", text: "hello" }],
      stop_reason: "end_turn",
    })
    expect(r.content).toBe("hello")
    expect(r.toolCalls).toBeUndefined()
  })

  test("含 tool_use 响应", () => {
    const r = parseAnthropicResponse({
      content: [
        { type: "text", text: "算一下" },
        { type: "tool_use", id: "tu1", name: "calculator", input: { expression: "1+2" } },
      ],
      stop_reason: "tool_use",
    })
    expect(r.content).toBe("算一下")
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls![0]).toEqual({
      id: "tu1",
      name: "calculator",
      arguments: { expression: "1+2" },
    })
  })

  test("error 字段抛 LLMError", () => {
    expect(() =>
      parseAnthropicResponse({ error: { type: "invalid", message: "bad" }, content: [], stop_reason: "error" }),
    ).toThrow(LLMError)
  })

  test("多段文本拼接", () => {
    const r = parseAnthropicResponse({
      content: [
        { type: "text", text: "foo " },
        { type: "text", text: "bar" },
      ],
      stop_reason: "end_turn",
    })
    expect(r.content).toBe("foo bar")
  })
})

describe("AnthropicCompatibleProvider.chat 正常路径", () => {
  test("纯文本对话", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({ content: [{ type: "text", text: "Hello from Claude" }], stop_reason: "end_turn" }),
    ])
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://api.anthropic.com", apiKey: "sk-ant", model: "claude-sonnet-4-5", fetch,
    })
    const resp = await provider.chat([
      { role: "system", content: "you are good" },
      { role: "user", content: "hi" },
    ], [])
    expect(resp.content).toBe("Hello from Claude")
    const body = calls[0]!.bodyJson as Record<string, unknown>
    expect(body.model).toBe("claude-sonnet-4-5")
    expect(body.system).toBe("you are good")
    expect(body.max_tokens).toBe(4096)
    const headers = calls[0]!.options.headers as Record<string, string>
    expect(headers["x-api-key"]).toBe("sk-ant")
    expect(headers["anthropic-version"]).toBe("2023-06-01")
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/messages")
  })

  test("含 tool_use 对话", async () => {
    const { fetch } = createMockFetch([
      jsonResponse({
        content: [
          { type: "text", text: "" },
          { type: "tool_use", id: "tu1", name: "calculator", input: { expression: "1+2" } },
        ],
        stop_reason: "tool_use",
      }),
    ])
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://api.anthropic.com", apiKey: "k", model: "m", fetch,
    })
    const resp = await provider.chat([{ role: "user", content: "算 1+2" }], SAMPLE_TOOLS)
    expect(resp.toolCalls).toHaveLength(1)
    expect(resp.toolCalls![0]!.name).toBe("calculator")
  })

  test("自定义 apiVersion/maxTokens 生效", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }),
    ])
    const provider = new AnthropicCompatibleProvider({
      baseUrl: "https://x", apiKey: "k", model: "m", fetch,
      apiVersion: "2024-01-01", maxTokens: 1024,
    })
    await provider.chat([{ role: "user", content: "hi" }], [])
    const headers = calls[0]!.options.headers as Record<string, string>
    expect(headers["anthropic-version"]).toBe("2024-01-01")
    expect((calls[0]!.bodyJson as Record<string, unknown>).max_tokens).toBe(1024)
  })

  test("无工具时请求体不含 tools", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }),
    ])
    const provider = new AnthropicCompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetch })
    await provider.chat([{ role: "user", content: "hi" }], [])
    const body = calls[0]!.bodyJson as Record<string, unknown>
    expect(body.tools).toBeUndefined()
  })
})

describe("AnthropicCompatibleProvider.chat 异常路径", () => {
  test("401 抛 LLMAuthError 不重试", async () => {
    let count = 0
    const { fetch } = createMockFetch([() => { count++; return jsonResponse({ error: { type: "auth", message: "bad key" } }, 401) }])
    const provider = new AnthropicCompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetch, maxRetries: 3 })
    await expect(provider.chat([{ role: "user", content: "hi" }], [])).rejects.toBeInstanceOf(LLMAuthError)
    expect(count).toBe(1)
  })

  test("429 重试", async () => {
    let count = 0
    const { fetch } = createMockFetch([
      () => { count++; return new Response("", { status: 429, headers: { "retry-after": "0" } }) },
      () => { count++; return jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }) },
    ])
    const provider = new AnthropicCompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetch, maxRetries: 2 })
    const r = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(r.content).toBe("ok")
    expect(count).toBe(2)
  })

  test("500 重试后恢复", async () => {
    let count = 0
    const { fetch } = createMockFetch([
      () => { count++; return new Response("", { status: 500 }) },
      () => { count++; return jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }) },
    ])
    const provider = new AnthropicCompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetch, maxRetries: 2 })
    const r = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(r.content).toBe("ok")
  })

  test("网络错误重试", async () => {
    let count = 0
    const { fetch } = createMockFetch([
      () => { count++; throw new Error("network") },
      () => { count++; return jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }) },
    ])
    const provider = new AnthropicCompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetch, maxRetries: 2 })
    const r = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(r.content).toBe("ok")
  })

  test("URL 末尾斜杠被规范化", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }),
    ])
    const provider = new AnthropicCompatibleProvider({ baseUrl: "https://x///", apiKey: "k", model: "m", fetch })
    await provider.chat([{ role: "user", content: "hi" }], [])
    expect(calls[0]!.url).toBe("https://x/v1/messages")
  })
})
