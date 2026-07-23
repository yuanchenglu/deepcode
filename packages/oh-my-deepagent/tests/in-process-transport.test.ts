/**
 * InProcessTransport 单元测试。
 */
import { describe, expect, test } from "bun:test"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  MockLLMProvider,
  codingAgent,
  echoTool,
  InProcessTransport,
} from "../src/index"

function makeTransport(script: ConstructorParameters<typeof MockLLMProvider>[0]) {
  const registry = new ToolRegistry()
  registry.register(echoTool)
  const memory = new MemoryStore()
  const llm = new MockLLMProvider(script)
  const runtime = new AgentRuntime({ role: codingAgent, llm, registry, memory })
  const transport = new InProcessTransport({ runtime })
  return { transport, memory, llm }
}

describe("InProcessTransport", () => {
  test("正常路径：发送消息返回响应信封", async () => {
    const { transport } = makeTransport([{ content: "你好" }])
    const resp = await transport.send({ sessionId: "s1", content: "hi" })
    expect(resp.text).toBe("你好")
    expect(resp.sessionId).toBe("s1")
    expect(resp.toolCalls).toBe(0)
    expect(resp.stoppedReason).toBe("completed")
    expect(resp.durationMs).toBeGreaterThanOrEqual(0)
  })

  test("含工具调用的完整响应", async () => {
    const { transport } = makeTransport([
      { content: "", toolCalls: [{ id: "c1", name: "echo", arguments: { text: "hello" } }] },
      { content: "echoed" },
    ])
    const resp = await transport.send({ sessionId: "s2", content: "echo hello" })
    expect(resp.toolCalls).toBe(1)
    expect(resp.text).toBe("echoed")
  })

  test("不同 sessionId 隔离记忆", async () => {
    const { transport, llm } = makeTransport([
      { content: "r1" },
      { content: "r2" },
    ])
    await transport.send({ sessionId: "a", content: "q1" })
    await transport.send({ sessionId: "b", content: "q2" })
    // 两个 session 的 LLM 调用各自只看到自己的历史
    const callA = llm.calls[0]!
    const callB = llm.calls[1]!
    const userMsgsA = callA.messages.filter((m) => m.role === "user")
    const userMsgsB = callB.messages.filter((m) => m.role === "user")
    expect(userMsgsA).toHaveLength(1)
    expect(userMsgsB).toHaveLength(1)
    expect(userMsgsA[0]!.content).toBe("q1")
    expect(userMsgsB[0]!.content).toBe("q2")
  })

  test("同 sessionId 保持上下文", async () => {
    const { transport, llm } = makeTransport([
      { content: "r1" },
      { content: "r2" },
    ])
    await transport.send({ sessionId: "keep", content: "q1" })
    await transport.send({ sessionId: "keep", content: "q2" })
    // 第二次调用应看到第一次的历史
    const secondCall = llm.calls[1]!
    const userMsgs = secondCall.messages.filter((m) => m.role === "user")
    expect(userMsgs).toHaveLength(2)
  })

  test("getRuntime 返回底层 runtime", () => {
    const { transport } = makeTransport([{ content: "ok" }])
    expect(transport.getRuntime()).toBeDefined()
    expect(transport.getRuntime().getRole().id).toBe("coding-agent")
  })

  test("metadata 被接受但不影响功能", async () => {
    const { transport } = makeTransport([{ content: "ok" }])
    const resp = await transport.send({
      sessionId: "s1",
      content: "hi",
      metadata: { source: "test", userId: "u1" },
    })
    expect(resp.text).toBe("ok")
  })

  test("空 content 仍可执行（LLM 返回响应）", async () => {
    const { transport } = makeTransport([{ content: "?" }])
    const resp = await transport.send({ sessionId: "empty", content: "" })
    expect(resp.text).toBe("?")
  })
})
