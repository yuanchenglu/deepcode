/**
 * PlanExecutor — 执行追踪。
 *
 * 负责推进 Plan 的步骤状态、记录结果、在全部完成/失败时更新整体状态。
 * 具体「每一步做什么」由调用方提供的 stepHandler 回调完成，
 * 本类只负责状态机与并发/顺序控制（默认顺序执行）。
 */

import type { Plan, Step, StepStatus } from "../types"
import { tally } from "./plan"

/** 单步处理器。接收当前 Step，返回该步骤的结果文本。 */
export type StepHandler = (step: Step, index: number) => Promise<string> | string

export interface PlanExecutorOptions {
  /** 计划对象（会被就地修改）。 */
  plan: Plan
  /** 单步处理器。 */
  handler: StepHandler
  /** 失败是否继续后续步骤，默认 false（fail-fast）。 */
  continueOnError?: boolean
}

export class PlanExecutor {
  private readonly plan: Plan
  private readonly handler: StepHandler
  private readonly continueOnError: boolean

  constructor(opts: PlanExecutorOptions) {
    this.plan = opts.plan
    this.handler = opts.handler
    this.continueOnError = opts.continueOnError ?? false
  }

  /** 当前计划快照（深复制 steps，避免外部修改）。 */
  snapshot(): Plan {
    return {
      ...this.plan,
      steps: this.plan.steps.map((s) => ({ ...s })),
    }
  }

  /** 标记计划开始执行。 */
  start(): void {
    this.plan.status = "running"
    for (const s of this.plan.steps) {
      if (s.status === "pending") s.status = "pending" // 保持
    }
  }

  /** 推进单步：从 pending → running → done/failed。 */
  async advance(index: number): Promise<Step> {
    const step = this.plan.steps[index]
    if (!step) throw new Error(`步骤下标越界: ${index}`)
    if (step.status === "done") return step
    step.status = "running"
    try {
      const result = await this.handler(step, index)
      step.status = "done"
      step.result = result
      step.error = undefined
    } catch (err) {
      step.status = "failed"
      step.error = err instanceof Error ? err.message : String(err)
      if (!this.continueOnError) {
        this.plan.status = "failed"
        throw err
      }
    } finally {
      this.recomputeStatus()
    }
    return step
  }

  /** 顺序执行所有 pending 步骤。 */
  async runAll(): Promise<Plan> {
    this.start()
    for (let i = 0; i < this.plan.steps.length; i++) {
      if (this.plan.status === "failed") break
      await this.advance(i)
    }
    return this.snapshot()
  }

  /** 手工标记某一步失败（用于外部中断）。 */
  markFailed(index: number, error: string): void {
    const step = this.plan.steps[index]
    if (!step) return
    step.status = "failed"
    step.error = error
    this.recomputeStatus()
  }

  /** 根据所有步骤状态重新计算 plan.status。 */
  private recomputeStatus(): void {
    const t = tally(this.plan)
    const total = this.plan.steps.length
    const finished = t.done + t.failed
    // 在 continueOnError 模式下，只要还有未开始/进行中的步骤就保持 running
    if (t.running > 0) {
      this.plan.status = "running"
      return
    }
    if (finished < total) {
      // 还有 pending 步骤
      this.plan.status = this.plan.status === "failed" && !this.continueOnError ? "failed" : "running"
      // 如果处于非 continueOnError 模式且已经有失败，则保留 failed
      if (!this.continueOnError && t.failed > 0) this.plan.status = "failed"
      return
    }
    // 所有步骤都完成了
    if (t.failed > 0 && !this.continueOnError) {
      this.plan.status = "failed"
    } else {
      // continueOnError 时即使有失败也视为 done
      this.plan.status = "done"
    }
  }
}
