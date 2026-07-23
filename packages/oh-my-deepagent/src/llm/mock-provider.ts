/**
 * MockLLMProvider — 测试与示例用的脚本化 LLM。
 *
 * 构造时接收一个脚本数组：每次 chat() 按顺序返回下一个脚本响应。
 * 脚本可以是：
 *   - 对象：直接作为 LLMResponse 返回
 *   - 函数：(messages, tools) => LLMResponse | Promise<LLMResponse>
 * 超出脚本长度后默认返回空文本响应（或返回 fallback）。
 */

import type { LLMProvider, LLMResponse, Message, ToolDescriptor } from "../types"

export type ScriptStep =
  | LLMResponse
  | ((messages: Message[], tools: ToolDescriptor[]) => LLMResponse | Promise<LLMResponse>)

export interface MockLLMOptions {
  /** 超过脚本长度后的兜底响应。 */
  fallback?: LLMResponse
}

export class MockLLMProvider implements LLMProvider {
  private readonly script: ScriptStep[]
  private readonly fallback: LLMResponse
  private cursor = 0
  /** 记录每次 chat 的调用，便于断言。 */
  readonly calls: Array<{ messages: Message[]; tools: ToolDescriptor[] }> = []

  constructor(script: ScriptStep[] = [], opts: MockLLMOptions = {}) {
    this.script = script
    this.fallback = opts.fallback ?? { content: "" }
  }

  async chat(messages: Message[], tools: ToolDescriptor[]): Promise<LLMResponse> {
    this.calls.push({ messages: [...messages], tools: [...tools] })
    const step = this.script[this.cursor]
    this.cursor++
    if (!step) return this.fallback
    return typeof step === "function" ? await step(messages, tools) : step
  }

  /** 重置脚本游标与调用记录（测试用）。 */
  reset(): void {
    this.cursor = 0
    this.calls.length = 0
  }
}
