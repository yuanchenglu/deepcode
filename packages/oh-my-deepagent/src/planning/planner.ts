/**
 * Planner — 任务拆解。
 *
 * 提供两条拆解路径：
 *  1. 传入显式的 steps 字符串数组 → 直接构造 Plan。
 *  2. 传入一个 goal 与可选 LLMProvider → 调用模型把 goal 拆成 N 步，再解析回 Plan。
 *
 * 为了避免对模型输出格式的强耦合，LLM 拆解时要求模型每行输出一个步骤，
 * 以 "1. " "2. " 或 "- " 开头；解析器做容错处理。
 */

import type { LLMProvider, Plan, Message } from "../types"
import { InvalidGoalError } from "../errors"
import { emptyPlan, stepsFromDescriptions, tally } from "./plan"

/** Planner 构造参数。 */
export interface PlannerOptions {
  /** 可选 LLM；不传时只能用 createPlanFromList。 */
  llm?: LLMProvider
  /** 系统提示词（可覆盖默认）。 */
  systemPrompt?: string
  /** 期望最多拆出的步数，默认 8。 */
  maxSteps?: number
}

const DEFAULT_SYSTEM_PROMPT = `你是任务规划助手。把用户给出的目标拆解为若干可执行的步骤。
要求：
- 每一步用一行输出，以 "1. ", "2. " 这类数字开头。
- 不要输出额外解释、编号之外的文字或 Markdown 代码块。
- 每步简洁明了，不超过 50 字。`

export class Planner {
  private readonly llm?: LLMProvider
  private readonly systemPrompt: string
  private readonly maxSteps: number

  constructor(opts: PlannerOptions = {}) {
    this.llm = opts.llm
    this.systemPrompt = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    this.maxSteps = opts.maxSteps ?? 8
  }

  /**
   * 直接用给定的步骤描述构造 Plan（不需要 LLM）。
   */
  createPlanFromList(goal: string, descriptions: string[]): Plan {
    if (!goal || goal.trim().length === 0) {
      throw new InvalidGoalError("goal 不能为空")
    }
    const list = descriptions.map((d) => d.trim()).filter(Boolean)
    if (list.length === 0) {
      throw new InvalidGoalError("至少需要一个步骤")
    }
    return {
      goal: goal.trim(),
      steps: stepsFromDescriptions(list),
      status: "pending",
    }
  }

  /**
   * 把一段模型输出（编号列表文本）解析为步骤描述。
   * 暴露为公开方法便于单元测试。
   */
  parseStepsFromText(text: string): string[] {
    const out: string[] = []
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // 匹配 "1. xxx" / "1) xxx" / "- xxx" / "* xxx"
      const m = /^\s*(?:\d+[.)]\s*|[-*]\s+)(.+)$/.exec(trimmed)
      if (m) {
        out.push(m[1]!.trim())
      } else if (out.length > 0) {
        // 非编号行视为上一步的追加描述
        out[out.length - 1] = out[out.length - 1]! + " " + trimmed
      }
      // 第一行就不是编号则忽略
    }
    return out.slice(0, this.maxSteps)
  }

  /**
   * 用 LLM 把 goal 拆成 Plan。
   */
  async createPlan(goal: string): Promise<Plan> {
    if (!goal || goal.trim().length === 0) {
      throw new InvalidGoalError("goal 不能为空")
    }
    if (!this.llm) {
      throw new InvalidGoalError("Planner 未配置 LLM，无法自动拆解；请用 createPlanFromList()")
    }
    const messages: Message[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: goal.trim() },
    ]
    const resp = await this.llm.chat(messages, [])
    const descriptions = this.parseStepsFromText(resp.content)
    if (descriptions.length === 0) {
      // 兜底：把整段文本作为唯一一步
      return this.createPlanFromList(goal, [resp.content.trim() || goal.trim()])
    }
    return this.createPlanFromList(goal, descriptions)
  }
}

/** 重新导出 tally 便于使用方通过 planner 子模块访问。 */
export { emptyPlan, tally }
