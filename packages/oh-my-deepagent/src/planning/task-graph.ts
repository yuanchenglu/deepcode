/**
 * Plan/PlanStep 类型定义
 */

/** 步骤状态 */
export type PlanStepStatus = "pending" | "running" | "done" | "failed" | "skipped"

/** 计划步骤 */
export interface PlanStep {
  /** 步骤 id */
  id: string
  /** 步骤说明 */
  description: string
  /** 建议使用的工具名 */
  tool?: string
  /** 建议的工具参数 */
  toolArgs?: Record<string, unknown>
  /** 当前状态 */
  status: PlanStepStatus
  /** 执行结果文本 */
  result?: string
  /** 错误信息 */
  error?: string
}

/** 一个完整计划 */
export interface Plan {
  /** 原始目标 */
  goal: string
  /** 步骤列表（按顺序） */
  steps: PlanStep[]
}
