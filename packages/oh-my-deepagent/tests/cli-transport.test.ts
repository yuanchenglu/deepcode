/**
 * CLITransport 单元测试。
 * 覆盖：普通消息、斜杠命令（/help,/reset,/history,/quit）、输出捕获。
 */
import { describe, expect, test } from "bun:test"
import { Readable } from "node:stream"
import {
  AgentRuntime,
  ToolRegistry,
  MemoryStore,
  MockLLMProvider,
  coding,
  echoTool,
  CLITransport,
} from "../src/index"

function makeCLI(script: ConstructorParameters<typeof MockLLMProvider>[0]) {
  const registry = new ToolRegistry()
  registry.register(echoTool)
  const memory = new MemoryStore()
  const llm = new MockLLMProvider(script)
  const runtime = new AgentRuntime({ role: coding, llm, registry, memory })
  return { runtime, memory, llm }
}

/** 创建一个可向其 push 行的可读流。 */
function makeInput(lines: string[]): Readable {
  const r = new Readable({ read() {} })
  for (const l of lines) r.push(l + "\n")
  r.push(null)
  return r
}

/** 收集写入的 Writable。 */
function makeOutput(): { stream: NodeJS.WritableStream; chunks: string[] } {
  const chunks: string[] = []
  const stream = new (require("node:stream").Writable)({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      chunks.push(chunk.toString("utf-8"))
      cb()
    },
  }) as NodeJS.WritableStream
  return { stream, chunks }
}

describe("CLITransport.handleLine", () => {
  test("普通消息发送给 Agent", async () => {
    const { runtime } = makeCLI([{ content: "你好！" }])
    const cli = new CLITransport({ runtime, sessionId: "test" })
    const res = await cli.handleLine("hi")
    expect(res.exit).toBeFalsy()
    expect(res.output).toContain("assistant: 你好！")
  })

  test("/help 显示帮助", async () => {
    const { runtime } = makeCLI([])
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("/help")
    expect(res.output).toContain("/quit")
    expect(res.output).toContain("/reset")
    expect(res.output).toContain("/history")
  })

  test("/quit 返回 exit", async () => {
    const { runtime } = makeCLI([])
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("/quit")
    expect(res.exit).toBe(true)
    expect(res.output).toContain("再见")
  })

  test("/exit 同 /quit", async () => {
    const { runtime } = makeCLI([])
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("/exit")
    expect(res.exit).toBe(true)
  })

  test("/reset 清空会话", async () => {
    const { runtime, memory } = makeCLI([{ content: "r1" }, { content: "r2" }])
    const cli = new CLITransport({ runtime, memory, sessionId: "r" })
    await cli.handleLine("q1") // 写入历史
    expect(memory.all("r").filter((m) => m.role === "user")).toHaveLength(1)
    const res = await cli.handleLine("/reset")
    expect(res.output).toContain("已重置")
    expect(memory.all("r")).toHaveLength(0)
  })

  test("/history 显示历史", async () => {
    const { runtime, memory } = makeCLI([{ content: "回答" }])
    const cli = new CLITransport({ runtime, memory, sessionId: "h" })
    await cli.handleLine("问题")
    const res = await cli.handleLine("/history")
    expect(res.output).toContain("[user]")
    expect(res.output).toContain("问题")
    expect(res.output).toContain("[assistant]")
    expect(res.output).toContain("回答")
  })

  test("/history 空时显示(空)", async () => {
    const { runtime } = makeCLI([])
    const cli = new CLITransport({ runtime, sessionId: "empty" })
    // 不传 memory，history 返回空
    const res = await cli.handleLine("/history")
    expect(res.output).toBe("(空)")
  })

  test("未知命令提示", async () => {
    const { runtime } = makeCLI([])
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("/foobar")
    expect(res.output).toContain("未知命令")
  })

  test("空行返回空", async () => {
    const { runtime } = makeCLI([])
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("   ")
    expect(res.output).toBeUndefined()
    expect(res.exit).toBeFalsy()
  })

  test("Agent 异常被捕获", async () => {
    // 用一个会抛错的 LLM
    const registry = new ToolRegistry()
    const memory = new MemoryStore()
    const llm = new MockLLMProvider([])
    llm.chat = async () => { throw new Error("LLM exploded") }
    const runtime = new AgentRuntime({ role: coding, llm, registry, memory })
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("hi")
    expect(res.output).toContain("[error]")
    expect(res.output).toContain("LLM exploded")
  })

  test("含工具调用的回复", async () => {
    const { runtime } = makeCLI([
      { content: "", toolCalls: [{ id: "c1", name: "echo", arguments: { text: "hello" } }] },
      { content: "echoed" },
    ])
    // 需要注册 echo 工具
    const registry = new ToolRegistry()
    // 但我们直接复用 runtime 的 llm 而不需要 echo 注册（因为工具不在 registry 会返回 tool error）
    // 这里直接测输出
    const cli = new CLITransport({ runtime })
    const res = await cli.handleLine("echo hello")
    expect(res.output).toContain("assistant:")
  })
})

describe("CLITransport.start (REPL)", () => {
  test("读取两行后 /quit 退出", async () => {
    const { runtime } = makeCLI([{ content: "r1" }, { content: "r2" }])
    const input = makeInput(["hello", "/quit"])
    const { stream: output, chunks } = makeOutput()
    const cli = new CLITransport({ runtime, input, output, sessionId: "repl" })
    await cli.start()
    const all = chunks.join("")
    expect(all).toContain("DeepAgent CLI")
    expect(all).toContain("再见")
  })
})
