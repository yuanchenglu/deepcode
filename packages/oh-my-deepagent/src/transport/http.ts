/**
 * HTTPTransport — 基于 Node http 模块的 HTTP 传输。
 *
 * 暴露三个端点：
 *   POST /chat         → 完整响应（JSON）
 *   GET  /health       → 健康检查
 *
 * 使用 Node 内置 http 模块，零第三方依赖。适用于容器部署或 webhook 集成。
 */

import type { IncomingMessage, ServerResponse, Server } from "node:http"
import { createServer } from "node:http"
import type { AgentRuntime } from "../runtime/agent-runtime"
import type { ChatRequestEnvelope, ChatResponseEnvelope, ErrorEnvelope } from "./envelope"
import { ErrorCodes } from "./envelope"

/** HTTPTransport 构造参数。 */
export interface HTTPTransportOptions {
  /** AgentRuntime 实例。 */
  runtime: AgentRuntime
  /** 监听端口，默认 3017。 */
  port?: number
  /** 监听地址，默认 127.0.0.1。 */
  host?: string
  /** 健康检查路径，默认 /health。 */
  healthPath?: string
  /** 聊天路径，默认 /chat。 */
  chatPath?: string
}

/** HTTP 传输服务器。 */
export class HTTPTransport {
  private readonly runtime: AgentRuntime
  private readonly port: number
  private readonly host: string
  private readonly healthPath: string
  private readonly chatPath: string
  private server: Server | null = null

  constructor(opts: HTTPTransportOptions) {
    this.runtime = opts.runtime
    this.port = opts.port ?? 3017
    this.host = opts.host ?? "127.0.0.1"
    this.healthPath = opts.healthPath ?? "/health"
    this.chatPath = opts.chatPath ?? "/chat"
  }

  /**
   * 解析 HTTP 请求体为字符串。
   * 单独暴露为静态方法便于测试。
   */
  static readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on("data", (c: Buffer) => chunks.push(c))
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
      req.on("error", reject)
    })
  }

  /**
   * 处理 /chat 请求。公开以便直接单元测试（不启动服务器）。
   */
  async handleChat(req: ChatRequestEnvelope): Promise<ChatResponseEnvelope | ErrorEnvelope> {
    // 基础校验
    if (!req.sessionId || typeof req.sessionId !== "string") {
      return {
        error: { code: ErrorCodes.INVALID_REQUEST, message: "sessionId 必填且必须是字符串" },
      }
    }
    if (typeof req.content !== "string") {
      return {
        error: { code: ErrorCodes.INVALID_REQUEST, message: "content 必填且必须是字符串" },
      }
    }
    try {
      const start = Date.now()
      const sessionRuntime = this.runtime.withSession(req.sessionId)
      const result = await sessionRuntime.chat(req.content)
      return {
        text: result.text,
        toolCalls: result.toolCalls,
        stoppedReason: result.stoppedReason,
        sessionId: req.sessionId,
        durationMs: Date.now() - start,
      }
    } catch (err) {
      return {
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : String(err),
        },
        sessionId: req.sessionId,
      }
    }
  }

  /** 处理健康检查。 */
  handleHealth(): { status: string; version: string } {
    return { status: "ok", version: "0.1.0" }
  }

  /** 把响应序列化为 JSON 并设置头。 */
  private sendJSON(res: ServerResponse, statusCode: number, body: unknown): void {
    const payload = JSON.stringify(body)
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload),
    })
    res.end(payload)
  }

  /** 路由请求。公开以便不启动网络也能测试。 */
  async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

    if (req.method === "GET" && url.pathname === this.healthPath) {
      this.sendJSON(res, 200, this.handleHealth())
      return
    }

    if (req.method === "POST" && url.pathname === this.chatPath) {
      const raw = await HTTPTransport.readBody(req)
      let parsed: ChatRequestEnvelope
      try {
        parsed = JSON.parse(raw) as ChatRequestEnvelope
      } catch {
        this.sendJSON(res, 400, {
          error: { code: ErrorCodes.INVALID_REQUEST, message: "请求体不是合法 JSON" },
        })
        return
      }
      const result = await this.handleChat(parsed)
      const statusCode = "error" in result ? 400 : 200
      this.sendJSON(res, statusCode, result)
      return
    }

    this.sendJSON(res, 404, {
      error: { code: "NOT_FOUND", message: `路径 ${url.pathname} 不存在` },
    })
  }

  /** 启动 HTTP 服务器。 */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.route(req, res).catch((err) => {
          this.sendJSON(res, 500, {
            error: { code: ErrorCodes.INTERNAL_ERROR, message: String(err) },
          })
        })
      })
      this.server.on("error", reject)
      this.server.listen(this.port, this.host, () => resolve())
    })
  }

  /** 停止 HTTP 服务器。 */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve()
      this.server.close((err) => (err ? reject(err) : resolve()))
      this.server = null
    })
  }

  /** 获取监听地址（启动后）。 */
  getAddress(): { host: string; port: number } | null {
    if (!this.server) return null
    const addr = this.server.address()
    if (!addr || typeof addr === "string") return null
    return { host: addr.address, port: addr.port }
  }
}
