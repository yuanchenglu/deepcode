/**
 * Anthropic 兼容 LLM 适配器。
 *
 * 对接 Anthropic Messages API（/v1/messages），支持 tool_use / tool_result。
 * 与 OpenAI 格式的关键差异：
 *  1. system 是独立请求参数，不在 messages 中
 *  2. content 是 block 数组而非纯字符串
 *  3. tool_result 归属于 user 角色
 */

import type {
  LLMProvider,
  LLMResponse,
  Message,
  ToolCall,
  ToolDescriptor,
} from "../types"
import { LLMError, LLMAuthError, LLMRateLimitError, LLMTimeoutError } from "./openai-compatible"

/** Anthropic 适配器构造参数。 */
export interface AnthropicCompatibleOptions {
  /** API 基础 URL，如 https://api.anthropic.com */
  baseUrl: string
  /** API Key，通过 x-api-key 头发送 */
  apiKey: string
  /** 模型 ID，如 claude-sonnet-4-5-20250929 */
  model: string
  /** Anthropic API 版本，默认 2023-06-01 */
  apiVersion?: string
  /** 最大输出 token 数，默认 4096 */
  maxTokens?: number
  /** 额外 HTTP 头 */
  headers?: Record<string, string>
  /** 可注入 fetch（测试/代理） */
  fetch?: typeof globalThis.fetch
  /** 最大重试次数，默认 2 */
  maxRetries?: number
  /** 请求超时（毫秒），默认 30000 */
  timeoutMs?: number
  /** 温度，默认 0 */
  temperature?: number
}

/** Anthropic content block 类型。 */
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }

/** Anthropic 消息格式。 */
interface AnthropicMessage {
  role: "user" | "assistant"
  content: ContentBlock[]
}

/** Anthropic 工具定义。 */
interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** Anthropic 响应。 */
interface AnthropicResponse {
  content: ContentBlock[]
  stop_reason: string
  error?: { type: string; message: string }
}

/** 把 DeepAgent Message 数组分离为 system 字符串和 Anthropic messages 数组。 */
export function messagesToAnthropic(messages: Message[]): {
  system: string | undefined
  messages: AnthropicMessage[]
} {
  let system: string | undefined
  const out: AnthropicMessage[] = []

  for (const m of messages) {
    switch (m.role) {
      case "system":
        system = m.content
        break
      case "user":
        out.push({ role: "user", content: [{ type: "text", text: m.content }] })
        break
      case "assistant": {
        const blocks: ContentBlock[] = []
        if (m.content) blocks.push({ type: "text", text: m.content })
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments })
          }
        }
        out.push({ role: "assistant", content: blocks })
        break
      }
      case "tool":
        // Anthropic 的 tool_result 属于 user 角色
        out.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: m.toolCallId ?? "unknown",
              content: m.content,
            },
          ],
        })
        break
    }
  }

  // Anthropic 要求 messages 以 user 开头。如果第一条是 assistant（没有 user 消息的边界情况），
  // 插入一个空 user 消息。
  if (out.length > 0 && out[0]!.role === "assistant") {
    out.unshift({ role: "user", content: [{ type: "text", text: "..." }] })
  }

  return { system, messages: out }
}

/** 把 DeepAgent ToolDescriptor 转为 Anthropic 工具格式。 */
export function descriptorsToAnthropic(tools: ToolDescriptor[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as unknown as Record<string, unknown>,
  }))
}

/** 解析 Anthropic 响应为 DeepAgent LLMResponse。 */
export function parseAnthropicResponse(resp: AnthropicResponse): LLMResponse {
  if (resp.error) {
    throw new LLMError(resp.error.message, undefined, resp.error.type)
  }
  let text = ""
  const toolCalls: ToolCall[] = []
  for (const block of resp.content) {
    if (block.type === "text") {
      text += block.text
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input,
      })
    }
  }
  return {
    content: text,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  }
}

function backoff(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000)
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Anthropic 兼容 LLM 适配器实现。 */
export class AnthropicCompatibleProvider implements LLMProvider {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly apiVersion: string
  private readonly maxTokens: number
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly temperature: number

  constructor(opts: AnthropicCompatibleOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "")
    this.apiKey = opts.apiKey
    this.model = opts.model
    this.apiVersion = opts.apiVersion ?? "2023-06-01"
    this.maxTokens = opts.maxTokens ?? 4096
    this.headers = opts.headers ?? {}
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.maxRetries = opts.maxRetries ?? 2
    this.timeoutMs = opts.timeoutMs ?? 30000
    this.temperature = opts.temperature ?? 0
  }

  async chat(messages: Message[], tools: ToolDescriptor[]): Promise<LLMResponse> {
    const { system, messages: anthropicMessages } = messagesToAnthropic(messages)
    const anthropicTools = tools.length > 0 ? descriptorsToAnthropic(tools) : undefined

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: anthropicMessages,
      temperature: this.temperature,
    }
    if (system) body.system = system
    if (anthropicTools) body.tools = anthropicTools

    let lastError: LLMError | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeoutMs)
        let resp: Response
        try {
          resp = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.apiKey,
              "anthropic-version": this.apiVersion,
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

        const json = (await resp.json()) as AnthropicResponse
        return parseAnthropicResponse(json)
      } catch (err) {
        if (err instanceof LLMAuthError) throw err
        if (err instanceof LLMTimeoutError) throw err
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
          lastError = new LLMError(`网络错误: ${(err as Error).message}`)
          if (attempt >= this.maxRetries) throw lastError
          await delay(backoff(attempt))
        }
      }
    }
    throw lastError ?? new LLMError("未知错误")
  }
}
