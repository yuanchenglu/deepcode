/**
 * 端到端测试：HTTP 传输平台。
 *
 * 真实启动 HTTP 服务器，通过 fetch 发送请求验证完整链路。
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
  calculatorTool,
} from "../src/index"

function startHTTPServer(script: ConstructorParameters<typeof MockLLMProvider>[0]) {
  const registry = new ToolRegistry()
  registry.register(echoTool)
  registry.register(calculatorTool)
  const memory = new MemoryStore()
  const llm = new MockLLMProvider(script)
  const runtime = new AgentRuntime({ role: codingAgent, llm, registry, memory })
  const transport = new HTTPTransport({ runtime, port: 0, host: "127.0.0.1" })
  return transport
}

describe("E2E-HTTP: POST /chat 完整链路", () => {
  test("用户消息 → LLM → 响应", async () => {
    const transport = startHTTPServer([{ content: "Hello from HTTP" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "e2e-http-1", content: "你好" }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.text).toBe("Hello from HTTP")
      expect(body.sessionId).toBe("e2e-http-1")
      expect(body.toolCalls).toBe(0)
    } finally {
      await transport.stop()
    }
  })

  test("含工具调用的请求", async () => {
    const transport = startHTTPServer([
      { content: "", toolCalls: [{ id: "c1", name: "calculator", arguments: { expression: "1+2*3" } }] },
      { content: "结果是 7" },
    ])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "e2e-http-2", content: "算 1+2*3" }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.text).toBe("结果是 7")
      expect(body.toolCalls).toBe(1)
    } finally {
      await transport.stop()
    }
  })

  test("同 session 保持上下文", async () => {
    const transport = startHTTPServer([{ content: "r1" }, { content: "r2" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const url = `http://${addr.host}:${addr.port}/chat`
      await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "ctx", content: "q1" }),
      })
      const resp2 = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "ctx", content: "q2" }),
      })
      const body = await resp2.json()
      expect(body.text).toBe("r2")
    } finally {
      await transport.stop()
    }
  })
})

describe("E2E-HTTP: 健康检查", () => {
  test("GET /health", async () => {
    const transport = startHTTPServer([{ content: "ok" }])
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
})

describe("E2E-HTTP: 错误请求", () => {
  test("非 JSON body 返回 400", async () => {
    const transport = startHTTPServer([{ content: "ok" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: "not json",
      })
      expect(resp.status).toBe(400)
      const body = await resp.json()
      expect(body.error.code).toBe("INVALID_REQUEST")
    } finally {
      await transport.stop()
    }
  })

  test("缺少 sessionId 返回 400", async () => {
    const transport = startHTTPServer([{ content: "ok" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hi" }),
      })
      expect(resp.status).toBe(400)
      const body = await resp.json()
      expect(body.error.code).toBe("INVALID_REQUEST")
    } finally {
      await transport.stop()
    }
  })

  test("未知路径 404", async () => {
    const transport = startHTTPServer([{ content: "ok" }])
    await transport.start()
    const addr = transport.getAddress()!
    try {
      const resp = await fetch(`http://${addr.host}:${addr.port}/unknown`)
      expect(resp.status).toBe(404)
    } finally {
      await transport.stop()
    }
  })
})
