/**
 * 消息循环实现。
 *
 * 抽离为独立函数便于 AgentRuntime 与未来多 Agent 复用。
 * 核心逻辑：
 *   1. 把当前消息列表交给 LLM
 *   2. 若 LLM 返回 toolCalls：依次执行工具，把结果追加到消息列表，重复
 *   3. 否则返回最终文本
 *   4. 防止死循环：超过 maxSteps 终止
 */

import type {
  LLMProvider,
  Message,
  RoleDefinition,
  ToolCall,
  ToolRegistryLike,
  ToolResult,
} from "../types"
import { ToolRunner } from "../tool/tool-runner"

/** 消息循环输入。 */
export interface MessageLoopInput {
  role: RoleDefinition
  llm: LLMProvider
  registry: ToolRegistryLike
  /** 用于执行工具的 runner；若未传则内部创建。 */
  runner?: ToolRunner
  /** 当前会话消息列表（会被就地修改）。 */
  messages: Message[]
  /** 最大工具调用轮次（每轮可包含多个 toolCalls），默认 8。 */
  maxSteps?: number
  /** 可选日志器。 */
  logger?: { info: (m: string) => void; warn: (m: string) => void }
  /** 会话 ID（写入工具 ctx）。 */
  sessionId?: string
}

/** 消息循环输出。 */
export interface MessageLoopResult {
  /** 最终 assistant 文本。 */
  text: string
  /** 累计执行的工具调用次数。 */
  toolCalls: number
  /** 终止原因。 */
  stoppedReason: "completed" | "max-steps"
  /** 循环过程中产生的所有消息（含 assistant + tool 结果），便于追加到记忆。 */
  generated: Message[]
}

/** 把 ToolCall 数组转成 assistant 消息。 */
function assistantMessageWithTools(text: string, calls: ToolCall[]): Message {
  return { role: "assistant", content: text, toolCalls: calls }
}

/** 把 ToolResult 转成 tool 消息。 */
function toolMessage(r: ToolResult): Message {
  return {
    role: "tool",
    content: r.content,
    toolCallId: r.toolCallId,
    name: r.name,
  }
}

export async function runMessageLoop(input: MessageLoopInput): Promise<MessageLoopResult> {
  const { role, llm, registry, logger, sessionId = "default" } = input
  const maxSteps = input.maxSteps ?? 8
  const runner =
    input.runner ??
    new ToolRunner({ registry, sessionId, roleId: role.id, logger })
  const messages = input.messages
  const generated: Message[] = []

  // 把角色 system prompt 注入到 messages 开头（若尚未有 system 消息）
  if (!messages.some((m) => m.role === "system")) {
    const sysPrompt = role.systemPrompt.replace(/\{role\}/g, role.displayName)
    messages.unshift({ role: "system", content: sysPrompt })
  }

  let text = ""
  let toolCalls = 0
  let stoppedReason: MessageLoopResult["stoppedReason"] = "completed"

  for (let step = 0; step < maxSteps; step++) {
    const toolDescriptors = registry.descriptors()
    logger?.info(`[step ${step + 1}/${maxSteps}] 调用 LLM，可用工具: ${toolDescriptors.length}`)
    const resp = await llm.chat(messages, toolDescriptors)
    text = resp.content ?? ""
    const calls = resp.toolCalls ?? []
    const assistantMsg = assistantMessageWithTools(text, calls)
    messages.push(assistantMsg)
    generated.push(assistantMsg)

    if (calls.length === 0) {
      // 无工具调用，结束
      break
    }
    // 执行每个工具
    for (const call of calls) {
      toolCalls++
      logger?.info(`执行工具: ${call.name}(${JSON.stringify(call.arguments)})`)
      const result = await runner.execute(call)
      const tm = toolMessage(result)
      messages.push(tm)
      generated.push(tm)
      if (result.isError) {
        logger?.warn(`工具 ${call.name} 失败: ${result.content}`)
      }
    }
    // 继续下一轮，让 LLM 看到工具结果
  }

  if (toolCalls > 0 && text === "" && generated.length > 0) {
    // 最后一轮只返回工具调用但没有文本时，做一次收尾
    const last = generated[generated.length - 1]
    if (last?.role === "tool") {
      // 再请求一次 LLM 做总结（消耗一轮 maxSteps）
      const resp = await llm.chat(messages, registry.descriptors())
      text = resp.content ?? ""
      const finalMsg: Message = { role: "assistant", content: text }
      messages.push(finalMsg)
      generated.push(finalMsg)
    }
  }

  if (toolCalls > 0 && generated.length >= maxSteps * 2) {
    stoppedReason = "max-steps"
  }

  return { text, toolCalls, stoppedReason, generated }
}
