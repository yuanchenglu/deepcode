/**
 * 传输层消息信封定义。
 *
 * 所有传输适配器（HTTP/CLI/InProcess）共用统一的请求/响应/错误格式，
 * 便于不同接入通道之间保持一致的消息语义。
 */

/** 请求信封：外部输入到 Agent。 */
export interface ChatRequestEnvelope {
  /** 会话 ID，用于记忆隔离。 */
  sessionId: string
  /** 用户消息文本。 */
  content: string
  /** 可选：指定角色 ID（若不提供则使用 runtime 绑定的角色）。 */
  role?: string
  /** 可选：透传元数据。 */
  metadata?: Record<string, unknown>
}

/** 响应信封：Agent 输出到外部。 */
export interface ChatResponseEnvelope {
  /** assistant 最终文本。 */
  text: string
  /** 本轮工具调用次数。 */
  toolCalls: number
  /** 终止原因。 */
  stoppedReason: "completed" | "max-steps"
  /** 会话 ID 回传。 */
  sessionId: string
  /** 处理耗时（毫秒），如果有测量的话。 */
  durationMs?: number
}

/** 流式事件类型。 */
export type StreamEventType = "token" | "tool_call" | "tool_result" | "done" | "error"

/** 流式事件。 */
export interface StreamEvent {
  type: StreamEventType
  /** token 事件：增量文本。 */
  delta?: string
  /** tool_call 事件。 */
  toolCall?: { id: string; name: string; arguments: Record<string, unknown> }
  /** tool_result 事件。 */
  toolResult?: { id: string; name: string; result: unknown; isError?: boolean }
  /** done 事件携带最终结果。 */
  response?: ChatResponseEnvelope
  /** error 事件。 */
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

/** 错误信封。 */
export interface ErrorEnvelope {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  sessionId?: string
}

/** 错误码枚举。 */
export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  ROLE_NOT_FOUND: "ROLE_NOT_FOUND",
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  MAX_STEPS_EXCEEDED: "MAX_STEPS_EXCEEDED",
  LLM_ERROR: "LLM_ERROR",
  LLM_TIMEOUT: "LLM_TIMEOUT",
  LLM_AUTH_ERROR: "LLM_AUTH_ERROR",
  LLM_RATE_LIMIT: "LLM_RATE_LIMIT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
