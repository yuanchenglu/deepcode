/**
 * DeepCode 消息网关 — 会话桥接
 *
 * 将平台消息转发到 OpenCode 执行，并回发结果。
 * 每个平台聊天会话（chatId）映射到一个 OpenCode 会话。
 *
 * 多轮上下文策略：
 * - 首次消息：不传 --session，opencode 自动创建新 session
 * - 从 --format json 输出中解析 sessionID 字段，存入 sessionMap
 * - 后续消息：传入 --session <id> 续接同一会话，保持多轮上下文
 *
 * @module
 */

import { Effect, Queue, Stream } from "effect"
import type { PlatformAdapter } from "./adapter"
import type { GatewayMessage, OutboundMessage } from "./message"

/** 会话映射：平台 chatId → OpenCode sessionId */
const sessionMap = new Map<string, string>()

/**
 * 获取已有的 OpenCode 会话 ID
 *
 * 首次消息时返回 null（尚未创建 session），
 * 后续消息返回已存储的真实 session ID。
 *
 * @param chatId - 平台聊天会话 ID
 * @returns 已存储的 session ID，首次返回 null
 */
export function getOrCreateSession(chatId: string): string | null {
  return sessionMap.get(chatId) ?? null
}

/**
 * 存储首次执行后解析到的真实 session ID
 *
 * 在 executeCli 首次执行完毕后，从 opencode run --format json
 * 的输出中解析 sessionID 字段并调用此方法持久化。
 *
 * @param chatId    - 平台聊天会话 ID
 * @param sessionId - opencode 分配的真实 session ID
 */
export function setSessionId(chatId: string, sessionId: string): void {
  sessionMap.set(chatId, sessionId)
}

/** executeCli 返回结构：包含回复文本和解析到的 session ID */
interface CliResult {
  /** 回复给用户的文本内容 */
  text: string
  /** 从 JSON 输出中解析到的 session ID（首次执行时有值，后续为 null） */
  sessionId: string | null
}

/**
 * 执行一条消息并回发结果
 *
 * 流程：
 * 1. 从平台消息中提取文本
 * 2. 获取对应的 OpenCode 会话 ID（首次为 null）
 * 3. 通过 opencode run CLI 执行消息（子进程）
 * 4. 从 JSON 输出中解析 session ID（首次）和回复文本
 * 5. 首次执行后存储真实 session ID，后续消息复用
 * 6. 将执行结果通过适配器回发
 */
export function processMessage(
  msg: GatewayMessage,
  workdir: string,
  adapters: Map<string, PlatformAdapter>,
): Effect.Effect<void> {
  // 用 Effect.ignoreLogged 兜底错误，不中断消费循环
  return Effect.gen(function* () {
    const sessionId = getOrCreateSession(msg.chat.id)
    const text = msg.content

    console.log(
      `[SessionBridge] 处理消息: chat=${msg.chat.id} session=${sessionId ?? "(首次)"} text="${text.slice(0, 80)}..."`,
    )

    // 通过 opencode run CLI 执行（子进程方式）
    const result = yield* Effect.tryPromise({
      try: () => executeCli(text, sessionId, workdir),
      catch: (err) => new Error(`opencode run 失败: ${(err as Error).message}`),
    })

    // 首次执行后存储真实 session ID，后续消息复用以保持多轮上下文
    if (result.sessionId) {
      setSessionId(msg.chat.id, result.sessionId)
      console.log(`[SessionBridge] 已存储 session ID: ${result.sessionId} for chat=${msg.chat.id}`)
    }

    // 截断过长输出（飞书消息有长度限制）
    const replyText = result.text.length > 3000
      ? result.text.slice(0, 3000) + "\n\n…（输出过长已截断）"
      : result.text

    // 回发结果：路由回原 source adapter（多 Adapter 并存时不抢回复）
    const reply: OutboundMessage = { chatId: msg.chat.id, type: "text", content: replyText }
    const sourceAdapter = msg.sourceAdapter
      ? adapters.get(msg.sourceAdapter)
      : undefined
    if (sourceAdapter) {
      yield* sourceAdapter.send(reply).pipe(Effect.ignore)
      console.log(`[SessionBridge] 已回发结果给 chat=${msg.chat.id} via ${sourceAdapter.name}`)
    } else {
      // 无 sourceAdapter 或找不到对应适配器：回退到第一个适配器（兼容旧行为）
      const fallback = adapters.values().next().value
      if (fallback) {
        yield* fallback.send(reply).pipe(Effect.ignore)
        console.log(`[SessionBridge] 已回发结果给 chat=${msg.chat.id} via fallback ${fallback.name}`)
      }
    }
  }).pipe(
    // 任何错误都记日志但不中断消费循环
    Effect.ignore({ log: true }),
  )
}

/**
 * 通过 opencode run CLI 执行消息（子进程）
 *
 * 多轮上下文实现：
 * - sessionId 为 null（首次）：不加 --session，opencode 创建新 session
 * - sessionId 非 null（后续）：加 --session <id> 续接已有 session
 * - 始终使用 --format json 输出，从中解析 sessionID 和文本内容
 *
 * 超时 120 秒，超时则强制终止。
 *
 * 注：Bun 1.3+ 的 Subprocess.stdout 是 Web ReadableStream，
 * 使用 getReader() 读取而非 Node.js stream 的 .on("data")。
 *
 * @param text      - 用户消息文本
 * @param sessionId - 已有 session ID（首次为 null）
 * @param workdir   - 工作目录
 * @returns 回复文本和解析到的 session ID
 */
async function executeCli(
  text: string,
  sessionId: string | null,
  workdir: string,
): Promise<CliResult> {
  const prompt = `[消息平台转发] ${text}`

  // deepcode CLI 入口：packages/opencode/bin/opencode（Node 脚本）
  // 用 import.meta.url 从本文件解析出绝对路径，不依赖 workdir
  const deepcodeCli = new URL("../../opencode/bin/opencode", import.meta.url).pathname

  // 构建 CLI 参数：始终使用 --format json 以便解析 session ID
  const args = [
    "bun",
    deepcodeCli,
    "run",
    "-c",
    prompt,
    "--model",
    "deepseek-v4-flash",
    "--format",
    "json",
  ]
  // 非首次执行：传入 --session 续接已有会话，保持多轮上下文
  if (sessionId) {
    args.push("--session", sessionId)
  }

  const proc = Bun.spawn(args, {
    cwd: workdir,
    env: {
      ...process.env,
      OPENCODE_NON_INTERACTIVE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

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

  const rawOutput = Buffer.concat(stdout).toString("utf-8").trim()
  const errorOutput = Buffer.concat(stderr).toString("utf-8").trim()

  // 解析 JSON 事件流，提取 session ID 和文本内容
  // opencode run --format json 输出格式（每行一个 JSON 事件）：
  // {"type":"step_start","sessionID":"ses_xxx","part":{...}}
  // {"type":"text","sessionID":"ses_xxx","part":{"text":"回复内容",...}}
  // {"type":"step_finish","sessionID":"ses_xxx","part":{...}}
  let parsedSessionId: string | null = null
  const textParts: string[] = []

  for (const line of rawOutput.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const event = JSON.parse(trimmed)
      // 首次解析到 sessionID 时存储（所有事件行都带 sessionID）
      if (!parsedSessionId && event.sessionID) {
        parsedSessionId = event.sessionID as string
      }
      // 提取文本内容（type=text 事件的 part.text 字段）
      if (event.type === "text" && event.part?.text) {
        textParts.push(event.part.text as string)
      }
    } catch {
      // 非 JSON 行（如错误信息），跳过
    }
  }

  const textOutput = textParts.join("")

  // 优先返回解析到的文本内容
  if (textOutput) return { text: textOutput, sessionId: parsedSessionId }
  // JSON 解析失败时回退到原始输出
  if (rawOutput) return { text: rawOutput, sessionId: parsedSessionId }
  // 错误输出
  if (errorOutput && result.exitCode !== 0) {
    return { text: `(stderr) ${errorOutput.slice(0, 500)}`, sessionId: parsedSessionId }
  }
  // 超时
  if (result.exitCode === -1) {
    return { text: "(超时: opencode run 未在 120 秒内完成)", sessionId: parsedSessionId }
  }
  // 无输出
  return { text: "(opencode 未返回输出)", sessionId: parsedSessionId }
}

/**
 * 启动消息消费循环
 *
 * 从队列中持续读取消息，调用 processMessage 处理。
 * 队列为空时等待新消息到达。
 */
export function startMessageConsumer(
  queue: Queue.Queue<GatewayMessage>,
  workdir: string,
  adapters: Map<string, PlatformAdapter>,
): Effect.Effect<void> {
  console.log("[SessionBridge] 启动消息消费循环")
  return Stream.runDrain(
    Stream.mapEffect(
      Stream.fromQueue(queue),
      (msg: GatewayMessage) => processMessage(msg, workdir, adapters),
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
