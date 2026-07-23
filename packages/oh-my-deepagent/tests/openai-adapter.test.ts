/**
 * OpenAICompatibleProvider 单元测试。
 * 覆盖：正常路径 / 边界 / 异常 / 重试。
 */
import { describe, expect, test } from "bun:test"
import {
  OpenAICompatibleProvider,
  messagesToOpenAI,
  descriptorsToOpenAI,
  parseOpenAIResponse,
  LLMError,
  LLMAuthError,
  LLMRateLimitError,
  LLMTimeoutError,
} from "../src/llm"
import type { Message, ToolDescriptor, LLMResponse } from "../src/types"
import { createMockFetch, jsonResponse } from "./mocks/fetch-mock"

const SAMPLE_TOOLS: ToolDescriptor[] = [
  {
    name: "calculator",
    description: "计算表达式",
    parameters: {
      type: "object",
      properties: { expression: { type: "string" } },
      required: ["expression"],
    },
  },
]

describe("messagesToOpenAI", () => {
  test("system/user/assistant/tool 全角色映射", () => {
    const msgs: Message[] = [
      { role: "system", content: "you are helpful" },
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "calculator", arguments: { expression: "1+1" } }],
      },
      { role: "tool", content: "2", toolCallId: "c1", name: "calculator" },
    ]
    const out = messagesToOpenAI(msgs)
    expect(out).toHaveLength(4)
    expect(out[0]).toEqual({ role: "system", content: "you are helpful" })
    expect(out[1]).toEqual({ role: "user", content: "hi" })
    expect(out[2]!.tool_calls).toEqual([
      {
        id: "c1",
        type: "function",
        function: { name: "calculator", arguments: JSON.stringify({ expression: "1+1" }) },
      },
    ])
    expect(out[2]!.content).toBeNull()
    expect(out[3]).toEqual({ role: "tool", content: "2", tool_call_id: "c1", name: "calculator" })
  })

  test("assistant 纯文本无 tool_calls", () => {
    const out = messagesToOpenAI([{ role: "assistant", content: "hello" }])
    expect(out[0]).toEqual({ role: "assistant", content: "hello" })
    expect(out[0]!.tool_calls).toBeUndefined()
  })
})

describe("descriptorsToOpenAI", () => {
  test("映射为 function tool", () => {
    const out = descriptorsToOpenAI(SAMPLE_TOOLS)
    expect(out).toEqual([
      {
        type: "function",
        function: {
          name: "calculator",
          description: "计算表达式",
          parameters: SAMPLE_TOOLS[0]!.parameters as unknown as Record<string, unknown>,
        },
      },
    ])
  })

  test("空数组返回空", () => {
    expect(descriptorsToOpenAI([])).toEqual([])
  })
})

describe("parseOpenAIResponse", () => {
  test("纯文本响应", () => {
    const r = parseOpenAIResponse({
      choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
    })
    expect(r).toEqual({ content: "hello", toolCalls: undefined })
  })

  test("含 tool_calls 的响应", () => {
    const r = parseOpenAIResponse({
      choices: [
        {
          message: {
            content: "",
            tool_calls: [
              {
                id: "c1",
                type: "function",
                function: { name: "calculator", arguments: '{"expression":"1+2"}' },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    })
    expect(r.content).toBe("")
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls![0]).toEqual({
      id: "c1",
      name: "calculator",
      arguments: { expression: "1+2" },
    })
  })

  test("tool_calls 中非法 JSON 保留 _raw", () => {
    const r = parseOpenAIResponse({
      choices: [
        {
          message: {
            content: "",
            tool_calls: [
              { id: "c1", type: "function", function: { name: "x", arguments: "not json" } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    })
    expect(r.toolCalls![0]!.arguments).toEqual({ _raw: "not json" })
  })

  test("空 choices 返回空内容", () => {
    expect(parseOpenAIResponse({ choices: [] })).toEqual({ content: "" })
  })

  test("响应含 error 字段抛 LLMError", () => {
    expect(() =>
      parseOpenAIResponse({ error: { message: "bad request", code: "invalid" }, choices: [] }),
    ).toThrow(LLMError)
  })
})

describe("OpenAICompatibleProvider.chat 正常路径", () => {
  test("纯文本对话", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({
        choices: [{ message: { content: "Hello from OpenAI" }, finish_reason: "stop" }],
      }),
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
      fetch,
    })
    const resp = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(resp.content).toBe("Hello from OpenAI")
    expect(resp.toolCalls).toBeUndefined()
    // 验证请求体
    const body = calls[0]!.bodyJson as Record<string, unknown>
    expect(body.model).toBe("gpt-4o")
    expect(body.messages).toBeArray()
    expect((body.messages as unknown[]).length).toBe(1)
    // 验证 Authorization 头
    const headers = calls[0]!.options.headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer sk-test")
    expect(headers["Content-Type"]).toBe("application/json")
  })

  test("含 tool_calls 对话", async () => {
    const { fetch } = createMockFetch([
      jsonResponse({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                { id: "tc1", type: "function", function: { name: "calculator", arguments: '{"expression":"2+3"}' } },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
      fetch,
    })
    const resp = await provider.chat([{ role: "user", content: "算 2+3" }], SAMPLE_TOOLS)
    expect(resp.toolCalls).toHaveLength(1)
    expect(resp.toolCalls![0]!.name).toBe("calculator")
    expect(resp.toolCalls![0]!.arguments).toEqual({ expression: "2+3" })
  })

  test("URL 末尾斜杠被规范化", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.com/v1///",
      apiKey: "k",
      model: "m",
      fetch,
    })
    await provider.chat([{ role: "user", content: "hi" }], [])
    expect(calls[0]!.url).toBe("https://example.com/v1/chat/completions")
  })

  test("传入 tools 时请求体含 tools 字段", async () => {
    const { fetch, calls } = createMockFetch([
      jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.com/v1",
      apiKey: "k",
      model: "m",
      fetch,
    })
    await provider.chat([{ role: "user", content: "hi" }], SAMPLE_TOOLS)
    const body = calls[0]!.bodyJson as Record<string, unknown>
    expect(body.tools).toBeArray()
    expect((body.tools as unknown[]).length).toBe(1)
    expect(body.tool_choice).toBe("auto")
  })
})

describe("OpenAICompatibleProvider.chat 异常路径", () => {
  test("401 抛 LLMAuthError 不重试", async () => {
    let callCount = 0
    const { fetch } = createMockFetch([
      () => {
        callCount++
        return jsonResponse({ error: { message: "unauthorized" } }, 401)
      },
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.com/v1",
      apiKey: "bad",
      model: "m",
      fetch,
      maxRetries: 3,
    })
    await expect(provider.chat([{ role: "user", content: "hi" }], [])).rejects.toBeInstanceOf(LLMAuthError)
    expect(callCount).toBe(1) // 不重试
  })

  test("403 抛 LLMAuthError", async () => {
    const { fetch } = createMockFetch([jsonResponse({ error: { message: "forbidden" } }, 403)])
    const provider = new OpenAICompatibleProvider({ baseUrl: "https://x/v1", apiKey: "k", model: "m", fetch })
    await expect(provider.chat([{ role: "user", content: "hi" }], [])).rejects.toBeInstanceOf(LLMAuthError)
  })

  test("429 限流触发重试", async () => {
    let callCount = 0
    const { fetch } = createMockFetch([
      () => {
        callCount++
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0", "Content-Type": "text/plain" },
        })
      },
      () => {
        callCount++
        return jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] })
      },
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m",
      fetch,
      maxRetries: 2,
    })
    const resp = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(resp.content).toBe("ok")
    expect(callCount).toBe(2)
  })

  test("500 服务器错误重试", async () => {
    let callCount = 0
    const { fetch } = createMockFetch([
      () => {
        callCount++
        return new Response("internal error", { status: 500 })
      },
      () => {
        callCount++
        return jsonResponse({ choices: [{ message: { content: "recovered" }, finish_reason: "stop" }] })
      },
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://x/v1", apiKey: "k", model: "m", fetch, maxRetries: 2,
    })
    const resp = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(resp.content).toBe("recovered")
    expect(callCount).toBe(2)
  })

  test("超过重试次数抛 LLMError", async () => {
    const { fetch } = createMockFetch([
      new Response("err", { status: 500 }),
      new Response("err", { status: 500 }),
      new Response("err", { status: 500 }),
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://x/v1", apiKey: "k", model: "m", fetch, maxRetries: 2,
    })
    await expect(provider.chat([{ role: "user", content: "hi" }], [])).rejects.toBeInstanceOf(LLMError)
  })

  test("超时抛 LLMTimeoutError", async () => {
    // 模拟一个会被 AbortSignal 取消的慢请求
    const slowFetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined
        if (signal) {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }
        // 永不主动 resolve
      })
    }) as unknown as typeof fetch
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://x/v1", apiKey: "k", model: "m", fetch: slowFetch,
      timeoutMs: 30, maxRetries: 0,
    })
    await expect(provider.chat([{ role: "user", content: "hi" }], [])).rejects.toBeInstanceOf(LLMTimeoutError)
  }, 5000)

  test("网络错误重试", async () => {
    let callCount = 0
    const { fetch } = createMockFetch([
      () => { callCount++; throw new Error("network down") },
      () => { callCount++; return jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }) },
    ])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://x/v1", apiKey: "k", model: "m", fetch, maxRetries: 2,
    })
    const resp = await provider.chat([{ role: "user", content: "hi" }], [])
    expect(resp.content).toBe("ok")
    expect(callCount).toBe(2)
  })

  test("非 2xx 且非 4xx/5xx 特殊状态码抛错", async () => {
    const { fetch } = createMockFetch([new Response("bad", { status: 400 })])
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://x/v1", apiKey: "k", model: "m", fetch, maxRetries: 0,
    })
    await expect(provider.chat([{ role: "user", content: "hi" }], [])).rejects.toThrow(/HTTP 400/)
  })
})
