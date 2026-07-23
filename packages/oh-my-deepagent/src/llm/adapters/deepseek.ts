/**
 * DeepSeek LLM 适配器
 *
 * 功能：DeepSeek API 完全兼容 OpenAI Chat Completions 格式，
 * 本适配器基于 OpenAICompatibleProvider，仅改变默认 baseUrl 与模型名。
 *
 * 默认 baseUrl: https://api.deepseek.com/v1
 * 默认 model: deepseek-chat（DeepSeek-V4）
 */

import { OpenAICompatibleProvider, type OpenAICompatibleOptions } from "../openai-compatible"

export interface DeepSeekOptions extends Omit<OpenAICompatibleOptions, "baseUrl" | "model"> {
  baseUrl?: string
  model?: string
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(opts: DeepSeekOptions) {
    super({
      ...opts,
      baseUrl: opts.baseUrl ?? "https://api.deepseek.com/v1",
      model: opts.model ?? "deepseek-chat",
    })
  }
}
