/**
 * 内置工具：plan-reader。
 *
 * 让 LLM 在循环中读取当前 Plan 的结构化信息，便于决定下一步。
 */

import type { Tool, Plan } from "../../types"

/**
 * 创建 plan-reader 工具，绑定到一个 Plan 引用（通常由 Planner 提供）。
 */
export function createPlanReader(getPlan: () => Plan | undefined): Tool {
  return {
    name: "plan_reader",
    description: "读取当前任务执行计划的步骤与状态。",
    parameters: { type: "object", properties: {} },
    async execute() {
      const plan = getPlan()
      if (!plan) return { hasPlan: false }
      return {
        hasPlan: true,
        goal: plan.goal,
        status: plan.status,
        steps: plan.steps.map((s) => ({
          id: s.id,
          description: s.description,
          status: s.status,
          result: s.result,
          error: s.error,
        })),
      }
    },
  }
}
