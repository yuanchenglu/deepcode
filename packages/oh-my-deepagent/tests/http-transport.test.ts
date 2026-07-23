/**
 * HTTPTransport 单元测试。
 *
 * 覆盖：handleChat 正常/边界/异常、handleHealth、路由、真实 HTTP 请求。
 */
import { describe, expect, test } from "bun:test"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  MockLLMProvider,
  codingAgent,
  echoTool,
  HTTPTransport,
  ErrorCodes,
} from "../src/index"
import type { ChatRequestEnvelope } from "../src/transport/envelope"

function makeTransport(script: ConstructorParameters<typeof MockLLMProvider>[0]) {
  const registry = new ToolRegistry()
  registry.register(echoTool)
  const memory = new MemoryStore()
  const llm = new MockLLMProvider(script)
  const runtime = new AgentRuntime({ role: codingAgent, llm, registry, memory })
  const transport = new HTTPTransport({ runtime, port: 0 }) // port=0 让系统分配
  return { transport, runtime, memory }
}

describe("HTTPTransport.handleHealth", () => {
  test("返回健康状态", () => {
    const { transport } = makeTransport([{ content: "ok" }])
    expect(transport.handleHealth()).toEqual({ status: "ok", version: "0.1.0" })
  })
})

describe("HTTPTransport.handleChat", () => {
  test("正常路径返回响应信封", async () => {
    const { transport } = makeTransport([{ content: "hello" }])
    const result = await transport.handleChat({ sessionId: "s1", content: "hi" })
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.text).toBe("hello")
      expect(result.sessionId).toBe("s1")
      expect(result.toolCalls).toBe(0)
      expect(result.stoppedReason).toBe("completed")
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  test("含工具调用的响应", async () => {
    const { transport } = makeTransport([
      { content: "", toolCalls: [{ id: "c1", name: "echo", arguments: { text: "hi" } }] },
      { content: "echoed" },
    ])
    const result = await transport.handleChat({ sessionId: "s2", content: "echo hi" })
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.toolCalls).toBe(1)
      expect(result.text).toBe("echoed")
    }
  })

  test("缺少 sessionId 返回错误", async () => {
    const { transport } = makeTransport([{ content: "ok" }])
    const result = await transport.handleChat({ content: "hi" } as ChatRequestEnvelope)
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error.code).toBe(ErrorCodes.INVALID_REQUEST)
    }
  })

  test("content 非字符串返回错误", async () => {
    const { transport } = makeTransport([{ content: "ok" }])
    const result = await transport.handleChat({ sessionId: "s1", content: 123 as unknown as string })
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error.code).toBe(ErrorCodes.INVALID_REQUEST)
    }
  })

  test("空 content 不校验失败（允许空消息）", async () => {
    const { transport } = makeTransport([{ content: "?" }])
    const result = await transport.handleChat({ sessionId: "s1", content: "" })
    expect("error" in result).toBe(false)
  })

  test("runtime 异常被捕获", async () => {
    // LLM 抛错
    const registry = new ToolRegistry()
    const memory = new MemoryStore()
    const llm = new MockLLMProvider([])
    llm.chat = async () => { throw new Error("LLM exploded") }
    const runtime = new AgentRuntime({ role: codingAgent, llm, registry, memory })
    const transport = new HTTPTransport({ runtime })
    const result = await transport.handleChat({ sessionId: "s1", content: "hi" })
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error.code).toBe(ErrorCodes.INTERNAL_ERROR)
      expect(result.error.message).toContain("LLM exploded")
    }
  })
})

describe("HTTPTransport 启动/停止 + 真实请求", () => {
  test("GET /health 返回 200", async () => {
    const { transport } = makeTransport([{ content: "ok" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/health`)
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.status).toBe("ok")
    } finally {
      await transport.stop()
    }
  })

  test("POST /chat 正常对话", async () => {
    const { transport } = makeTransport([{ content: "Hello HTTP" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "http1", content: "hi" }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.text).toBe("Hello HTTP")
      expect(body.sessionId).toBe("http1")
    } finally {
      await transport.stop()
    }
  })

  test("POST /chat 非 JSON 返回 400", async () => {
    const { transport } = makeTransport([{ content: "ok" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
      expect(resp.status).toBe(400)
      const body = await resp.json()
      expect(body.error.code).toBe(ErrorCodes.INVALID_REQUEST)
    } finally {
      await transport.stop()
    }
  })

  test("未知路径返回 404", async () => {
    const { transport } = makeTransport([{ content: "ok" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/nonexistent`)
      expect(resp.status).toBe(404)
    } finally {
      await transport.stop()
    }
  })

  test("同 session 跨请求保持上下文", async () => {
    const { transport } = makeTransport([{ content: "r1" }, { content: "r2" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "ctx", content: "q1" }),
      })
      const resp2 = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "ctx", content: "q2" }),
      })
      const body = await resp2.json()
      expect(body.text).toBe("r2")
    } finally {
      await transport.stop()
    }
  })
})
