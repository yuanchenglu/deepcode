/**
 * 端到端测试：CLI 传输平台。
 *
 * 通过注入 input/output 流模拟真实 CLI 交互。
 */
import { describe, expect, test } from "bun:test"
import { Readable, Writable } from "node:stream"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  MockLLMProvider,
  coding,
  echoTool,
  CLITransport,
} from "../src/index"

function makeRuntime(script: ConstructorParameters<typeof MockLLMProvider>[0]) {
  const registry = new ToolRegistry()
  registry.register(echoTool)
  const memory = new MemoryStore()
  const llm = new MockLLMProvider(script)
  return new AgentRuntime({ role: coding, llm, registry, memory })
}

function makeInput(lines: string[]): Readable {
  const r = new Readable({ read() {} })
  for (const l of lines) r.push(l + "\n")
  r.push(null)
  return r
}

function collectOutput(): { stream: Writable; text: () => string } {
  let buf = ""
  const stream = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      buf += chunk.toString("utf-8")
      cb()
    },
  })
  return { stream, text: () => buf }
}

describe("E2E-CLI: 完整 REPL 交互", () => {
  test("发送消息 → 收到回复 → /quit 退出", async () => {
    const runtime = makeRuntime([{ content: "你好！我是 Coding Agent" }])
    const input = makeInput(["你好", "/quit"])
    const { stream, text } = collectOutput()
    const cli = new CLITransport({ runtime, input, output: stream, sessionId: "cli-e2e-1" })
    await cli.start()
    const output = text()
    expect(output).toContain("DeepAgent CLI")
    expect(output).toContain("assistant: 你好！我是 Coding Agent")
    expect(output).toContain("再见")
  })

  test("工具调用链完整", async () => {
    const runtime = makeRuntime([
      { content: "", toolCalls: [{ id: "c1", name: "echo", arguments: { text: "hello" } }] },
      { content: "echoed hello" },
    ])
    const { stream, text } = collectOutput()
    const cli = new CLITransport({ runtime, input: makeInput(["echo hello", "/quit"]), output: stream })
    await cli.start()
    expect(text()).toContain("assistant: echoed hello")
  })

  test("/help 显示所有命令", async () => {
    const runtime = makeRuntime([])
    const { stream, text } = collectOutput()
    const cli = new CLITransport({ runtime, input: makeInput(["/help", "/quit"]), output: stream })
    await cli.start()
    const out = text()
    expect(out).toContain("/quit")
    expect(out).toContain("/reset")
    expect(out).toContain("/history")
  })

  test("/reset 后 /history 显示空", async () => {
    const runtime = makeRuntime([{ content: "r1" }, { content: "r2" }])
    const { stream, text } = collectOutput()
    const cli = new CLITransport({
      runtime, input: makeInput(["hello", "/reset", "/history", "/quit"]),
      output: stream, sessionId: "reset-e2e",
    })
    await cli.start()
    const out = text()
    expect(out).toContain("已重置")
    // /history 在 reset 后应显示(空)
    expect(out).toContain("(空)")
  })
})

describe("E2E-InProcess: 直接函数调用", () => {
  test("完整请求-响应", async () => {
    const runtime = makeRuntime([
      { content: "", toolCalls: [{ id: "c1", name: "echo", arguments: { text: "ping" } }] },
      { content: "pong" },
    ])
    const { InProcessTransport } = await import("../src/transport/in-process")
    const transport = new InProcessTransport({ runtime })
    const resp = await transport.send({ sessionId: "ip1", content: "ping" })
    expect(resp.text).toBe("pong")
    expect(resp.toolCalls).toBe(1)
    expect(resp.stoppedReason).toBe("completed")
    expect(resp.durationMs).toBeGreaterThanOrEqual(0)
  })
})
