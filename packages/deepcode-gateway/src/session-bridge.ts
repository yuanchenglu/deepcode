/**
 * DeepCode 消息网关 — 会话桥接
 *
 * 将平台消息转发到 OpenCode 执行，并回发结果。
 * 每个平台聊天会话（chatId）映射到一个 OpenCode 会话。
 *
 * @module
 */

import { Effect, Queue, Stream } from "effect"
import type { PlatformAdapter } from "./adapter"
import type { GatewayMessage, OutboundMessage } from "./message"

/** 会话映射：平台 chatId → OpenCode sessionId */
const sessionMap = new Map<string, string>()

/**
 * 获取或创建 OpenCode 会话 ID
 */
export function getOrCreateSession(chatId: string): string {
  let sid = sessionMap.get(chatId)
  if (!sid) {
    sid = `gateway_${chatId}_${Date.now()}`
    sessionMap.set(chatId, sid)
  }
  return sid
}

/**
 * 执行一条消息并回发结果
 *
 * 流程：
 * 1. 从平台消息中提取文本
 * 2. 获取对应的 OpenCode 会话 ID
 * 3. 通过 opencode run CLI 执行消息（子进程）
 * 4. 将执行结果通过适配器回发
 */
export function processMessage(
  msg: GatewayMessage,
  adapter: PlatformAdapter,
  workdir: string,
): Effect.Effect<void> {
  // 用 Effect.ignoreLogged 兜底错误，不中断消费循环
  // ignoreLogged 会记录错误但不传播（等效于 catchAll + 日志）
  return Effect.gen(function* () {
    const sessionId = getOrCreateSession(msg.chat.id)
    const text = msg.content

    console.log(`[SessionBridge] 处理消息: chat=${msg.chat.id} session=${sessionId} text="${text.slice(0, 80)}..."`)

    // 通过 opencode run CLI 执行（子进程方式）
    const output = yield* Effect.tryPromise({
      try: () => executeCli(text, sessionId, workdir),
      catch: (err) => new Error(`opencode run 失败: ${(err as Error).message}`),
    })

    // 截断过长输出（飞书消息有长度限制）
    const replyText = output.length > 3000
      ? output.slice(0, 3000) + "\n\n…（输出过长已截断）"
      : output

    // 回发结果
    const reply: OutboundMessage = { chatId: msg.chat.id, type: "text", content: replyText }
    yield* adapter.send(reply).pipe(Effect.ignore)
    console.log(`[SessionBridge] 已回发结果给 chat=${msg.chat.id}`)
  }).pipe(
    // 任何错误都记日志但不中断消费循环
    Effect.ignore({ log: true }),
  )
}

/**
 * 通过 opencode run CLI 执行消息（子进程）
 *
 * 在工作目录下执行 `opencode run -c "消息内容"`。
 * 超时 120 秒，超时则强制终止。
 *
 * 注：Bun 1.3+ 的 Subprocess.stdout 是 Web ReadableStream，
 * 使用 getReader() 读取而非 Node.js stream 的 .on("data")。
 */
async function executeCli(text: string, _sessionId: string, workdir: string): Promise<string> {
  const prompt = `[消息平台转发] ${text}`

  // deepcode CLI 入口：packages/opencode/bin/opencode（Node 脚本）
  // 用 import.meta.url 从本文件解析出绝对路径，不依赖 workdir
  const deepcodeCli = new URL("../../opencode/bin/opencode", import.meta.url).pathname
  const proc = Bun.spawn(
    ["bun", deepcodeCli, "run", "-c", prompt, "--model", "deepseek-v4-flash"],
    {
      cwd: workdir,
      env: {
        ...process.env,
        OPENCODE_NON_INTERACTIVE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  const timeout = 120_000
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []

  // 使用 Web Streams API 读取子进程输出
  async function readStream(
    stream: ReadableStream<Uint8Array<ArrayBuffer>> | null,
    collector: Buffer[],
  ): Promise<void> {
    if (!stream) return
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      collector.push(Buffer.from(value))
    }
  }
  await Promise.all([
    readStream(proc.stdout, stdout),
    readStream(proc.stderr, stderr),
  ])

  // proc.exited 是 Promise<number>，与超时赛跑
  const result = await Promise.race([
    proc.exited.then((exitCode) => ({ exitCode })),
    new Promise<{ exitCode: number }>((resolve) => {
      setTimeout(() => {
        proc.kill("SIGTERM")
        resolve({ exitCode: -1 })
      }, timeout)
    }),
  ])

  const output = Buffer.concat(stdout).toString("utf-8").trim()
  const errorOutput = Buffer.concat(stderr).toString("utf-8").trim()

  if (output) return output
  if (errorOutput && result.exitCode !== 0) return `(stderr) ${errorOutput.slice(0, 500)}`
  if (result.exitCode === -1) return "(超时: opencode run 未在 120 秒内完成)"
  return "(opencode 未返回输出)"
}

/**
 * 启动消息消费循环
 *
 * 从队列中持续读取消息，调用 processMessage 处理。
 * 队列为空时等待新消息到达。
 */
export function startMessageConsumer(
  queue: Queue.Queue<GatewayMessage>,
  adapter: PlatformAdapter,
  workdir: string,
): Effect.Effect<void> {
  console.log("[SessionBridge] 启动消息消费循环")
  return Stream.runDrain(
    Stream.mapEffect(
      Stream.fromQueue(queue),
      (msg: GatewayMessage) => processMessage(msg, adapter, workdir),
    ),
  )
}

/**
 * 获取会话映射的快照（用于调试/监控）
 */
export function getSessionMap(): ReadonlyMap<string, string> {
  return new Map(sessionMap)
}

/**
 * 清空所有会话映射
 */
export function clearSessionMap(): void {
  sessionMap.clear()
}
