/**
 * Plan 类型与工具函数。
 */

import type { Plan, Step } from "../types"

/** 创建空计划。 */
export function emptyPlan(goal: string): Plan {
  return { goal, steps: [], status: "pending" }
}

/** 生成一个短步骤 ID（仅用于运行时，不追求全局唯一）。 */
export function makeStepId(index: number): string {
  return `s${index + 1}`
}

/** 把纯文本步骤描述列表转成 Step 数组。 */
export function stepsFromDescriptions(descriptions: string[]): Step[] {
  return descriptions.map((d, i) => ({
    id: makeStepId(i),
    description: d,
    status: "pending",
  }))
}

/** 统计一个 Plan 的完成情况。 */
export function tally(plan: Plan): { pending: number; running: number; done: number; failed: number } {
  const t = { pending: 0, running: 0, done: 0, failed: 0 }
  for (const s of plan.steps) t[s.status]++
  return t
}
