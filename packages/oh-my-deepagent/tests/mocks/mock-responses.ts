/**
 * Mock 响应数据集合。
 *
 * 覆盖所有消息类型：纯文本、tool_call、tool_result、错误、多轮对话。
 * 供 OpenAI/Anthropic 适配器和端到端测试使用。
 */

import { jsonResponse } from "./fetch-mock"

// ======== OpenAI Chat Completions 响应 ========

/** OpenAI 纯文本响应（最终回复）。 */
export function openaiTextResponse(text: string) {
  return jsonResponse({
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: 1700000000,
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  })
}

/** OpenAI 工具调用响应（请求 calculator）。 */
export function openaiToolCallResponse(id: string, fnName: string, args: Record<string, unknown>) {
  return jsonResponse({
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: 1700000000,
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id,
              type: "function",
              function: { name: fnName, arguments: JSON.stringify(args) },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  })
}

/** OpenAI 多工具并行响应。 */
export function openaiMultiToolCallResponse(
  calls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
) {
  return jsonResponse({
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
        finish_reason: "tool_calls",
      },
    ],
  })
}

/** OpenAI 429 限流响应。 */
export function openaiRateLimitResponse(retryAfter = "0") {
  return new Response("rate limited", {
    status: 429,
    headers: { "retry-after": retryAfter, "Content-Type": "text/plain" },
  })
}

/** OpenAI 401 认证错误。 */
export function openaiAuthErrorResponse() {
  return jsonResponse({ error: { message: "invalid api key", type: "auth_error", code: "invalid_api_key" } }, 401)
}

/** OpenAI 500 服务器错误。 */
export function openaiServerErrorResponse() {
  return new Response("internal server error", { status: 500 })
}

// ======== Anthropic Messages 响应 ========

/** Anthropic 纯文本响应。 */
export function anthropicTextResponse(text: string) {
  return jsonResponse({
    id: "msg-mock",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-sonnet-4-5",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  })
}

/** Anthropic 工具调用响应。 */
export function anthropicToolUseResponse(id: string, name: string, input: Record<string, unknown>) {
  return jsonResponse({
    id: "msg-mock",
    type: "message",
    role: "assistant",
    content: [
      { type: "text", text: "" },
      { type: "tool_use", id, name, input },
    ],
    model: "claude-sonnet-4-5",
    stop_reason: "tool_use",
  })
}

/** Anthropic 401 错误。 */
export function anthropicAuthErrorResponse() {
  return jsonResponse({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401)
}

/** Anthropic 429 响应。 */
export function anthropicRateLimitResponse() {
  return new Response("", { status: 429, headers: { "retry-after": "0" } })
}

/** Anthropic 500 响应。 */
export function anthropicServerErrorResponse() {
  return new Response("", { status: 500 })
}

// ======== 预构建多轮脚本（用于 e2e）========

/** 完整的单工具调用脚本：工具调用 → 最终文本。OpenAI 格式。 */
export function openaiScriptCalculator() {
  return [
    openaiToolCallResponse("call-1", "calculator", { expression: "1+2*3" }),
    openaiTextResponse("结果是 7"),
  ]
}

/** 完整的单工具调用脚本：Anthropic 格式。 */
export function anthropicScriptCalculator() {
  return [
    anthropicToolUseResponse("tu-1", "calculator", { expression: "1+2*3" }),
    anthropicTextResponse("结果是 7"),
  ]
}

/** 多轮对话脚本：第一轮无工具，第二轮有工具。OpenAI 格式。 */
export function openaiScriptMultiTurn() {
  return [
    openaiTextResponse("好的，我来帮你算"),
    openaiToolCallResponse("call-2", "calculator", { expression: "2+3" }),
    openaiTextResponse("2+3=5"),
  ]
}
