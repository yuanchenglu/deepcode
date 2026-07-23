/**
 * CLITransport — 基于 stdin/stdout 的命令行交互传输。
 *
 * 读取 stdin 一行 → 发送给 AgentRuntime → 将回复写入 stdout。
 * 支持斜杠命令：
 *   /quit     退出 REPL
 *   /reset    清空当前会话
 *   /history  打印当前会话历史
 *   /help     显示帮助
 *
 * 主要用于本地调试与脚本化使用，可注入 input/output 流便于测试。
 */

import type { AgentRuntime } from "../runtime/agent-runtime"
import type { MemoryStoreLike, Message } from "../types"
import { createInterface } from "node:readline"
import type { Interface as ReadLineInterface } from "node:readline"

/** CLITransport 构造参数。 */
export interface CLITransportOptions {
  /** AgentRuntime 实例。 */
  runtime: AgentRuntime
  /**
   * 记忆存储（用于 /history 命令读取历史）。
   * 可选；不传时 /history 返回"无历史"。
   */
  memory?: MemoryStoreLike
  /** 可读流，默认 process.stdin。 */
  input?: NodeJS.ReadableStream
  /** 可写流，默认 process.stdout。 */
  output?: NodeJS.WritableStream
  /** 会话 ID，默认 "cli"。 */
  sessionId?: string
  /** 提示符，默认 "deep-agent> "。 */
  prompt?: string
}

/** 斜杠命令返回结果。 */
export interface CommandResult {
  /** 是否退出 REPL。 */
  exit?: boolean
  /** 输出到 stdout 的文本。 */
  output?: string
}

export class CLITransport {
  private readonly runtime: AgentRuntime
  private readonly memory: MemoryStoreLike | undefined
  private readonly input: NodeJS.ReadableStream
  private readonly output: NodeJS.WritableStream
  private readonly sessionId: string
  private readonly prompt: string
  private rl: ReadLineInterface | null = null
  /** 处理器可被测试覆写。 */
  onLine: (line: string) => Promise<CommandResult>

  constructor(opts: CLITransportOptions) {
    this.runtime = opts.runtime
    this.memory = opts.memory
    this.input = opts.input ?? process.stdin
    this.output = opts.output ?? process.stdout
    this.sessionId = opts.sessionId ?? "cli"
    this.prompt = opts.prompt ?? "deep-agent> "
    // 默认处理逻辑绑定到实例方法（可在测试中替换）
    this.onLine = (line: string) => this.handleLine(line)
  }

  /** 写入一行到输出流。 */
  private write(text: string): void {
    this.output.write(text.endsWith("\n") ? text : text + "\n")
  }

  /**
   * 处理一条用户输入。公开以便单元测试不启动 readline。
   */
  async handleLine(rawLine: string): Promise<CommandResult> {
    const line = rawLine.trim()
    if (!line) return {}

    // 斜杠命令
    if (line.startsWith("/")) {
      const [cmd, ...args] = line.slice(1).split(/\s+/)
      switch (cmd) {
        case "quit":
        case "exit":
          return { exit: true, output: "再见！" }
        case "reset":
          this.runtime.resetSession(this.sessionId)
          return { output: "[system] 会话已重置" }
        case "history": {
          // 利用注入的 memory 接口列出最近历史
          const messages: Message[] = this.memory?.all(this.sessionId) ?? []
          if (messages.length === 0) return { output: "(空)" }
          const lines = messages
            .filter((m) => m.role !== "system")
            .map((m) => {
              if (m.role === "tool") return `  [tool] ${m.name ?? ""}: ${truncate(m.content, 80)}`
              return `  [${m.role}] ${truncate(m.content, 200)}`
            })
          return { output: lines.join("\n") }
        }
        case "help":
          return {
            output: [
              "可用命令:",
              "  /quit     退出",
              "  /reset    重置当前会话",
              "  /history  查看对话历史",
              "  /help     显示本帮助",
              "直接输入文字发送给 agent。",
            ].join("\n"),
          }
        default:
          return { output: `未知命令: /${cmd}（输入 /help 查看帮助）` }
      }
    }

    // 普通消息 → 发给 Agent
    try {
      const sessionRuntime = this.runtime.withSession(this.sessionId)
      const result = await sessionRuntime.chat(line)
      return { output: `assistant: ${result.text}` }
    } catch (err) {
      return { output: `[error] ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  /**
   * 启动 REPL 循环。
   * @returns Promise 在收到 /quit 或流结束时 resolve。
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.rl = createInterface({ input: this.input, output: this.output, terminal: false })
      this.write(`DeepAgent CLI (session=${this.sessionId})，输入 /help 查看帮助。`)
      this.rl.setPrompt(this.prompt)
      this.rl.prompt()
      this.rl.on("line", async (line) => {
        this.rl?.pause()
        const res = await this.onLine(line)
        if (res.output) this.write(res.output)
        if (res.exit) {
          this.rl?.close()
          return
        }
        this.rl?.prompt()
        this.rl?.resume()
      })
      this.rl.on("close", () => resolve())
    })
  }

  /** 停止 REPL。 */
  stop(): void {
    this.rl?.close()
    this.rl = null
  }
}

/** 截断长文本用于显示。 */
function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}
