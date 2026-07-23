/**
 * OpenAI 兼容 LLM 适配器。
 *
 * 对接 OpenAI Chat Completions API（/v1/chat/completions），
 * 支持 function calling (tool_calls)。可与任何 OpenAI 兼容的后端一起使用：
 * OpenAI、Azure OpenAI、DeepSeek、通义千问、本地 vLLM/Ollama 等。
 */

import type {
  LLMProvider,
  LLMResponse,
  Message,
  ToolCall,
  ToolDescriptor,
} from "../types"

/** OpenAI 适配器构造参数。 */
export interface OpenAICompatibleOptions {
  /** API 基础 URL，如 https://api.openai.com/v1 */
  baseUrl: string
  /** API Key，通过 Authorization: Bearer 头发送 */
  apiKey: string
  /** 模型 ID，如 gpt-4o, deepseek-chat */
  model: string
  /** 额外 HTTP 头 */
  headers?: Record<string, string>
  /** 可注入的 fetch 实现（用于测试或代理） */
  fetch?: typeof globalThis.fetch
  /** 最大重试次数（429/5xx 时），默认 2 */
  maxRetries?: number
  /** 请求超时（毫秒），默认 30000 */
  timeoutMs?: number
  /** 温度参数，默认 0 */
  temperature?: number
}

/** OpenAI 消息格式（最小子集）。 */
interface OAIMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

/** OpenAI 工具定义。 */
interface OAITool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** OpenAI 响应格式（最小子集）。 */
interface OAIResponse {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: Array<{
        id: string
        type: "function"
        function: { name: string; arguments: string }
      }>
    }
    finish_reason: string
  }>
  error?: { message: string; type?: string; code?: string }
}

/** LLM 错误类。 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "LLMError"
  }
}

/** 认证错误（401/403）。 */
export class LLMAuthError extends LLMError {
  constructor(message: string) {
    super(message, 401, "AUTH_ERROR")
    this.name = "LLMAuthError"
  }
}

/** 限流错误（429）。 */
export class LLMRateLimitError extends LLMError {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message, 429, "RATE_LIMIT")
    this.name = "LLMRateLimitError"
  }
}

/** 超时错误。 */
export class LLMTimeoutError extends LLMError {
  constructor(message: string) {
    super(message, undefined, "TIMEOUT")
    this.name = "LLMTimeoutError"
  }
}

/**
 * 把 DeepAgent Message 数组转换为 OpenAI 消息格式。
 * 暴露为公开方法便于单独测试。
 */
export function messagesToOpenAI(messages: Message[]): OAIMessage[] {
  const out: OAIMessage[] = []
  for (const m of messages) {
    switch (m.role) {
      case "system":
        out.push({ role: "system", content: m.content })
        break
      case "user":
        out.push({ role: "user", content: m.content })
        break
      case "assistant": {
        const oa: OAIMessage = { role: "assistant", content: m.content || null }
        if (m.toolCalls && m.toolCalls.length > 0) {
          oa.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }))
        }
        out.push(oa)
        break
      }
      case "tool":
        out.push({
          role: "tool",
          content: m.content,
          tool_call_id: m.toolCallId ?? "unknown",
          name: m.name,
        })
        break
    }
  }
  return out
}

/** 把 DeepAgent ToolDescriptor 转为 OpenAI 工具格式。 */
export function descriptorsToOpenAI(tools: ToolDescriptor[]): OAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }))
}

/**
 * 解析 OpenAI 响应为 DeepAgent LLMResponse。
 * 暴露为公开方法便于单独测试。
 */
export function parseOpenAIResponse(resp: OAIResponse): LLMResponse {
  if (resp.error) {
    throw new LLMError(resp.error.message, undefined, resp.error.code)
  }
  const choice = resp.choices[0]
  if (!choice) {
    return { content: "" }
  }
  const msg = choice.message
  const content = msg.content ?? ""
  const toolCalls: ToolCall[] = []
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments)
      } catch {
        // 解析失败时保留原始字符串
        args = { _raw: tc.function.arguments }
      }
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        arguments: args,
      })
    }
  }
  return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
}

/** 简单的指数退避延迟。 */
function backoff(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000)
}

/** OpenAI 兼容 LLM 适配器实现。 */
export class OpenAICompatibleProvider implements LLMProvider {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly temperature: number

  constructor(opts: OpenAICompatibleOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "")
    this.apiKey = opts.apiKey
    this.model = opts.model
    this.headers = opts.headers ?? {}
    // Bun/Node 全局 fetch；测试可注入
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.maxRetries = opts.maxRetries ?? 2
    this.timeoutMs = opts.timeoutMs ?? 30000
    this.temperature = opts.temperature ?? 0
  }

  async chat(messages: Message[], tools: ToolDescriptor[]): Promise<LLMResponse> {
    const oaiMessages = messagesToOpenAI(messages)
    const oaiTools = tools.length > 0 ? descriptorsToOpenAI(tools) : undefined

    const body: Record<string, unknown> = {
      model: this.model,
      messages: oaiMessages,
      temperature: this.temperature,
    }
    if (oaiTools) {
      body.tools = oaiTools
      body.tool_choice = "auto"
    }

    let lastError: LLMError | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeoutMs)
        let resp: Response
        try {
          resp = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
              ...this.headers,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timer)
        }

        if (resp.status === 401 || resp.status === 403) {
          throw new LLMAuthError(`认证失败: HTTP ${resp.status}`)
        }
        if (resp.status === 429) {
          const retryAfter = resp.headers.get("retry-after")
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoff(attempt)
          throw new LLMRateLimitError(`限流: HTTP 429`, waitMs)
        }
        if (resp.status >= 500) {
          throw new LLMError(`服务器错误: HTTP ${resp.status}`, resp.status, "SERVER_ERROR")
        }
        if (!resp.ok) {
          const text = await resp.text().catch(() => "")
          throw new LLMError(`HTTP ${resp.status}: ${text.slice(0, 200)}`, resp.status, "HTTP_ERROR")
        }

        const json = (await resp.json()) as OAIResponse
        return parseOpenAIResponse(json)
      } catch (err) {
        if (err instanceof LLMAuthError) throw err // 不重试认证错误
        if (err instanceof LLMTimeoutError) throw err // 超时不重试
        const isAbort = err instanceof DOMException && err.name === "AbortError"
        if (isAbort) {
          if (attempt >= this.maxRetries) throw new LLMTimeoutError(`请求超时(${this.timeoutMs}ms)`)
        } else if (err instanceof LLMRateLimitError) {
          if (attempt >= this.maxRetries) throw err
          await delay(err.retryAfterMs ?? backoff(attempt))
          continue
        } else if (err instanceof LLMError) {
          lastError = err
          if (attempt >= this.maxRetries) throw err
          await delay(backoff(attempt))
          continue
        } else {
          // 网络错误等
          lastError = new LLMError(`网络错误: ${(err as Error).message}`)
          if (attempt >= this.maxRetries) throw lastError
          await delay(backoff(attempt))
        }
      }
    }
    throw lastError ?? new LLMError("未知错误")
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
