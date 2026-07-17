/**
 * OKR+PlanStep 级联模块（论文 I-06）
 *
 * 核心功能：
 * 实现三级计划体系 O → KR → PlanStep，在约束执行过程中自动级联修正上游目标。
 * 解决问题：传统 Agent "做完再发现方向错了" 的根本原因，是没有上游约束下游的强制机制。
 *
 * 设计要点（论文 I-06）：
 * 1. O (Objective)：一句话任务目标（从用户原始意图中提取）
 * 2. KR (Key Result)：可验证的验收标准，通常 2-5 条
 * 3. PlanStep：具体执行步骤，每个 step 绑定 goal / okr（关联哪些 KR）/ deps（依赖哪些 step）/ status / acceptance
 * 4. 级联修正：执行中发现约束或假设发生变化时，自动向上修正 O / KR / 未开始的 PlanStep；已完成 step 保持不变
 * 5. Review 锚定：Review / Checkpoint 审查时逐条对照 KR 验收，而非对照原始模糊需求
 *
 * 工程设计决策：
 * - 计划通过 TodoWrite 工具 + Mid-Conversation Message 呈现，不修改 system prompt 前缀
 * - PlanStep 状态：pending / in_progress / blocked / done / verified
 * - 级联修正触发时机：硬约束新增、scope creep 检测、step 完成后发现偏差时
 * - 与意图路由绑定：Simple 任务跳过 OKR 直接执行，Refactor / Architecture 等复杂任务必须先建 OKR
 *
 * @module okr-plan
 */

// Effect 框架：Context（DI token）、Effect（效应）、Layer（依赖注入层）、Ref（可变引用）
import { Context, Effect, Layer, Ref } from "effect"
// makeLocationNode 是 OpenCode 的 Location 级服务注册器
import { makeLocationNode } from "../effect/app-node"

/**
 * PlanStep（计划步骤）的状态枚举
 *
 * - pending：待执行，尚未开始
 * - in_progress：正在执行中
 * - blocked：被阻塞（依赖未满足或遇到障碍）
 * - done：步骤已完成，等待 KR 验证
 * - verified：步骤关联的 KR 已全部通过验收，步骤最终确认
 */
export type StepStatus = "pending" | "in_progress" | "blocked" | "done" | "verified"

/**
 * 单个 PlanStep（执行步骤）
 *
 * 计划体系中最细粒度的执行单元，每个步骤描述一个具体可操作的动作，
 * 并明确其关联的 KR、前置依赖、当前状态和验收条件。
 */
export interface PlanStep {
  /** 步骤唯一标识符，格式为 "s1"、"s2" ... */
  readonly id: string
  /** 步骤一句话描述，说明该步骤要做什么 */
  readonly goal: string
  /** 关联的 KR 索引数组，表示本步骤的完成有助于哪些 KR 的达成 */
  readonly okr: readonly number[]
  /** 前置依赖的步骤 ID 数组，本步骤需在这些步骤完成后才能开始 */
  readonly deps: readonly string[]
  /** 当前执行状态 */
  readonly status: StepStatus
  /** 完成验收条件（一句话描述），用于判断步骤是否真正完成 */
  readonly acceptance: string
  /** 实际产出记录（步骤完成后填写），简要记录执行结果 */
  readonly result?: string
  /** 重试次数，用于追踪步骤被重复执行的次数 */
  readonly attempts: number
}

/**
 * 一条 Key Result（关键结果/可验证验收标准）
 *
 * KR 是判断 Objective 是否达成的可量化/可验证依据，
 * 每个 Objective 通常包含 2-5 条 KR。
 */
export interface KeyResult {
  /** KR 的序号索引（从 0 开始），用于 PlanStep 引用 */
  readonly index: number
  /** KR 描述，说明需要达成什么结果 */
  readonly description: string
  /** 验证方式描述，例如：代码运行通过 / 截图对比 / 类型检查通过 / 单元测试全部通过等 */
  readonly verification: string
  /** 该 KR 是否已达成 */
  readonly met: boolean
}

/**
 * 一个 Objective（目标）
 *
 * 描述一句话的任务目标，及其对应的可验证验收标准（KR 列表）。
 */
export interface Objective {
  /** 一句话目标描述，表达任务的核心意图 */
  readonly description: string
  /** 验收 KR 列表，所有 KR 达成即视为目标完成 */
  readonly keyResults: readonly KeyResult[]
}

/**
 * 完整 OKR 计划
 *
 * 包含一个 Objective、其下所有执行步骤，以及版本号和级联修正历史。
 * 每次级联修正会递增 revision 并记录 CascadeEvent。
 */
export interface Plan {
  /** 计划目标（O）及其 KR */
  readonly objective: Objective
  /** 所有执行步骤列表 */
  readonly steps: readonly PlanStep[]
  /** 计划版本号，每次级联修正时递增（初始为 1） */
  readonly revision: number
  /** 级联修正历史记录，按时间顺序排列 */
  readonly cascadeHistory: readonly CascadeEvent[]
}

/**
 * 级联修正事件
 *
 * 记录一次级联修正的触发原因、发生时机、变更内容和受影响的步骤。
 * 用于审计和回溯计划变更过程。
 */
export interface CascadeEvent {
  /** 触发本次级联修正的原因描述 */
  readonly reason: string
  /** 修正发生时的对话轮次（turn） */
  readonly turn: number
  /** 变更内容的简要描述（JSON 序列化，截断至 500 字符） */
  readonly changes: string
  /** 受影响的步骤 ID 列表（已完成步骤不会被修改） */
  readonly affectedSteps: readonly string[]
}

/** 级联修正变更描述对象 */
export interface CascadeChanges {
  /** 更新后的 Objective 描述（可选） */
  readonly objectiveUpdate?: string
  /** KR 更新列表，每项指定要更新的 KR 索引及新的字段值（可选） */
  readonly krUpdates?: readonly { index: number; description?: string; verification?: string }[]
  /** 现有步骤更新列表，每项指定步骤 ID 及新的字段值（可选） */
  readonly stepUpdates?: readonly {
    id: string
    goal?: string
    acceptance?: string
    okr?: readonly number[]
    deps?: readonly string[]
    newStatus?: StepStatus
  }[]
  /** 要追加的新步骤列表（可选） */
  readonly newSteps?: readonly { goal: string; acceptance: string; okr?: readonly number[]; deps?: readonly string[] }[]
}

/** KR 评估结果统计 */
export interface KREvaluationResult {
  /** 是否全部 KR 已达成 */
  readonly allMet: boolean
  /** 已达成的 KR 数量 */
  readonly metCount: number
  /** KR 总数 */
  readonly totalCount: number
}

// ============================================================
// 服务接口定义（从 旧API 迁移到 Context.Service 模式）
// ============================================================

/**
 * Plan 级联服务接口
 *
 * 提供 OKR 计划的创建、查询、步骤更新、推进、级联修正、KR 评估、渲染和重置功能。
 */
export interface Interface {
  /**
   * 创建初始 OKR 计划
   *
   * @param objective - 用户目标的一句话描述
   * @param krs - Key Result 列表
   * @param steps - PlanStep 初始列表
   * @returns 新创建的 Plan 对象
   */
  readonly createPlan: (
    objective: string,
    krs: readonly { description: string; verification: string }[],
    steps: readonly { goal: string; acceptance: string; okr?: readonly number[]; deps?: readonly string[] }[],
  ) => Effect.Effect<Plan>

  /** 获取当前活动计划（无活动计划返回 null） */
  readonly getPlan: () => Effect.Effect<Plan | null>

  /**
   * 更新指定步骤的状态和信息
   *
   * @param stepId - 要更新的步骤 ID
   * @param update - 包含要更新字段的部分对象
   * @returns 更新后的 Plan 对象；若无活动计划则返回 null
   */
  readonly updateStep: (
    stepId: string,
    update: Partial<Pick<PlanStep, "status" | "result" | "acceptance">>,
  ) => Effect.Effect<Plan | null>

  /** 推进到下一个可执行步骤（无下一个返回 null） */
  readonly advanceToNext: () => Effect.Effect<PlanStep | null>

  /**
   * 级联修正：当上游假设变化时，修正未开始步骤和 KR
   *
   * @param reason - 触发级联修正的原因
   * @param changes - 变更描述对象
   * @returns 修正后的 Plan 对象；若无活动计划则返回 null
   */
  readonly cascade: (reason: string, changes: CascadeChanges) => Effect.Effect<Plan | null>

  /**
   * 评估 KR 是否达成
   *
   * @param krResults - KR 验证结果数组
   * @returns 包含 allMet / metCount / totalCount 的统计对象
   */
  readonly evaluateKRs: (
    krResults: readonly { index: number; met: boolean }[],
  ) => Effect.Effect<KREvaluationResult>

  /** 渲染当前计划为用户可见的 Markdown 文本 */
  readonly renderPlan: () => Effect.Effect<string>

  /** 重置计划（新任务开始时调用） */
  readonly reset: () => Effect.Effect<void>
}

/** DI token — 从 旧API 迁移到 Context.Service */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeOKRPlan",
) {}

// ============================================================
// Layer 实现
// ============================================================

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    /** 当前 OKR 计划的可变引用，无活动计划时为 null */
    const planRef = yield* Ref.make<Plan | null>(null)
    /** 级联修正轮次计数器，每次 cascade 调用时递增 */
    const turnRef = yield* Ref.make(0)

    /**
     * 创建初始 OKR 计划
     *
     * 初始化规则：
     * - 步骤 ID 自动编号为 s1, s2, s3...
     * - 若步骤未指定 okr 且只有 1 个 KR，则默认关联 KR0；否则 okr 为空数组
     * - 若步骤未指定 deps，则第 1 个步骤无依赖，后续步骤依赖前一个步骤
     * - 第 1 个步骤初始状态为 in_progress，其余为 pending
     * - 初始 revision 为 1，cascadeHistory 为空
     */
    const createPlan = (
      objective: string,
      krs: readonly { description: string; verification: string }[],
      steps: readonly { goal: string; acceptance: string; okr?: readonly number[]; deps?: readonly string[] }[],
    ): Effect.Effect<Plan> =>
      Ref.modify(planRef, () => {
        // 构建完整的 Plan 对象
        const plan: Plan = {
          objective: {
            description: objective,
            keyResults: krs.map((kr, i) => ({
              index: i,
              description: kr.description,
              verification: kr.verification,
              met: false,
            })),
          },
          steps: steps.map((s, i) => ({
            id: `s${i + 1}`,
            goal: s.goal,
            // 若未指定 okr 关联且只有 1 个 KR，则默认关联第 0 个 KR
            okr: s.okr ?? krs.length === 1 ? [0] : [],
            // 若未指定依赖：第 1 步无依赖，后续步骤依赖前一步
            deps: s.deps ?? (i === 0 ? [] : [`s${i}`]),
            // 第 1 步立即进入 in_progress，其余为 pending
            status: i === 0 ? "in_progress" : "pending",
            acceptance: s.acceptance,
            attempts: 0,
          })),
          revision: 1,
          cascadeHistory: [],
        }
        return [plan, plan] as const
      })

    /** 获取当前活动计划 */
    const getPlan = (): Effect.Effect<Plan | null> => Ref.get(planRef)

    /**
     * 更新指定步骤的状态和信息
     *
     * 若更新的状态为 in_progress，则自动将该步骤的 attempts（重试次数）加 1。
     */
    const updateStep = (
      stepId: string,
      update: Partial<Pick<PlanStep, "status" | "result" | "acceptance">>,
    ): Effect.Effect<Plan | null> =>
      Ref.updateAndGet(planRef, (plan) => {
        if (!plan) return null
        return {
          ...plan,
          steps: plan.steps.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  ...update,
                  // 如果状态变为 in_progress（重新尝试执行），重试次数 +1
                  attempts: update.status === "in_progress" ? s.attempts + 1 : s.attempts,
                }
              : s,
          ),
        }
      })

    /**
     * 推进到下一个可执行步骤
     *
     * 查找第一个处于 pending 状态且所有依赖步骤均已完成（done/verified）的步骤，
     * 将其状态改为 in_progress 并返回。
     */
    const advanceToNext = (): Effect.Effect<PlanStep | null> =>
      Ref.modify(planRef, (plan) => {
        if (!plan) return [null, null] as const
        // 收集所有已完成（done 或 verified）步骤的 ID 集合
        const doneIds = new Set(
          plan.steps.filter((s) => s.status === "done" || s.status === "verified").map((s) => s.id),
        )
        // 找到第一个 pending 且所有依赖都已完成的步骤
        const next = plan.steps.find((s) => {
          if (s.status !== "pending") return false
          return s.deps.every((d) => doneIds.has(d))
        })
        if (!next) return [null, plan] as const
        // 将找到的步骤状态更新为 in_progress
        const newPlan: Plan = {
          ...plan,
          steps: plan.steps.map((s) => (s.id === next.id ? { ...s, status: "in_progress" } : s)),
        }
        return [newPlan.steps.find((s) => s.id === next.id)!, newPlan] as const
      })

    /**
     * 级联修正：当上游假设变化时，修正未开始步骤和 KR
     *
     * 设计决策：
     * - 已完成（status = done / verified）的步骤不做修改，保证执行结果的稳定性
     * - 只修改 pending / in_progress / blocked 状态的步骤
     * - 如果 objective 发生变化，所有未开始的 step 都需要重新评估
     * - 每次调用递增 turn 计数器和 plan.revision
     */
    const cascade = (
      reason: string,
      changes: CascadeChanges,
    ): Effect.Effect<Plan | null> =>
      Effect.gen(function* () {
        // 递增级联轮次计数器
        const turn = yield* Ref.updateAndGet(turnRef, (t) => t + 1)
        return yield* Ref.updateAndGet(planRef, (plan) => {
          if (!plan) return null
          const affectedStepIds: string[] = []

          // === 1. 更新 Objective 描述 ===
          const newObjective: Objective = changes.objectiveUpdate
            ? { ...plan.objective, description: changes.objectiveUpdate }
            : plan.objective

          // === 2. 更新 KR ===
          const newKRs = [...plan.objective.keyResults]
          if (changes.krUpdates) {
            for (const kru of changes.krUpdates) {
              if (kru.index < newKRs.length) {
                newKRs[kru.index] = { ...newKRs[kru.index], ...kru, index: kru.index }
              }
            }
          }

          // === 3. 更新现有步骤（只更新非 done/verified 的） ===
          let newSteps = [...plan.steps]
          if (changes.stepUpdates) {
            for (const su of changes.stepUpdates) {
              const idx = newSteps.findIndex((s) => s.id === su.id)
              // 安全检查：只修改未最终完成的步骤，避免破坏已确认的执行结果
              if (idx >= 0 && newSteps[idx].status !== "done" && newSteps[idx].status !== "verified") {
                newSteps[idx] = { ...newSteps[idx], ...su }
                affectedStepIds.push(su.id)
              }
            }
          }

          // === 4. 追加新步骤 ===
          if (changes.newSteps) {
            // 计算当前最大步骤编号，确保新步骤 ID 不冲突
            const maxNum = newSteps.reduce((m, s) => Math.max(m, parseInt(s.id.slice(1)) || 0), 0)
            for (let i = 0; i < changes.newSteps.length; i++) {
              const ns = changes.newSteps[i]
              const newId = `s${maxNum + i + 1}`
              newSteps.push({
                id: newId,
                goal: ns.goal,
                okr: ns.okr ?? [],
                // 若未指定依赖，则默认依赖追加前的最后一个步骤
                deps: ns.deps ?? (newSteps.length > 0 ? [newSteps[newSteps.length - 1].id] : []),
                status: "pending",
                acceptance: ns.acceptance,
                attempts: 0,
              })
              affectedStepIds.push(newId)
            }
          }

          // 记录本次级联修正事件
          const event: CascadeEvent = {
            reason,
            turn,
            changes: JSON.stringify(changes).slice(0, 500),
            affectedSteps: affectedStepIds,
          }

          return {
            objective: { ...newObjective, keyResults: newKRs },
            steps: newSteps,
            revision: plan.revision + 1,
            cascadeHistory: [...plan.cascadeHistory, event],
          }
        })
      })

    /**
     * 评估 KR 是否达成
     *
     * 验证逻辑：
     * - 对于每个传入的 krResult，更新对应 KR 的 met 字段
     * - 对于处于 done 状态的步骤，检查其关联的所有 KR 是否已全部 met
     * - 若全部 met，则将该步骤状态升级为 verified
     */
    const evaluateKRs = (
      krResults: readonly { index: number; met: boolean }[],
    ): Effect.Effect<KREvaluationResult> =>
      Ref.updateAndGet(planRef, (plan) => {
        if (!plan) return plan
        // 更新 KR 的达成状态
        const newKRs = plan.objective.keyResults.map((kr) => {
          const result = krResults.find((r) => r.index === kr.index)
          return result ? { ...kr, met: result.met } : kr
        })
        // 将关联 KR 全部达成的 done 步骤标记为 verified
        const newSteps = plan.steps.map((s) => {
          const metKRs = krResults.filter((r) => r.met).map((r) => r.index)
          if (s.status === "done" && s.okr.some((k) => metKRs.includes(k))) {
            // 检查该步骤关联的所有 KR 是否均已达成
            const allMet = s.okr.every((k) => newKRs[k]?.met)
            return allMet ? { ...s, status: "verified" as const } : s
          }
          return s
        })
        return { ...plan, objective: { ...plan.objective, keyResults: newKRs }, steps: newSteps }
      }).pipe(
        Effect.map((plan) => {
          if (!plan) return { allMet: false, metCount: 0, totalCount: 0 }
          const metCount = plan.objective.keyResults.filter((kr) => kr.met).length
          return {
            allMet: metCount === plan.objective.keyResults.length,
            metCount,
            totalCount: plan.objective.keyResults.length,
          }
        }),
      )

    /**
     * 渲染当前计划为用户可见的 Markdown 文本
     *
     * 使用 <plan> XML 标签包裹，便于前端识别和渲染。
     */
    const renderPlan = (): Effect.Effect<string> =>
      Ref.get(planRef).pipe(
        Effect.map((plan) => {
          if (!plan) return "（无活动计划）"
          // 步骤状态对应的 emoji 图标映射
          const statusEmoji: Record<StepStatus, string> = {
            pending: "⬜",
            in_progress: "🔄",
            blocked: "🚧",
            done: "✅",
            verified: "🎯",
          }
          const lines: string[] = []
          lines.push(`<plan revision="${plan.revision}">`)
          // 渲染目标
          lines.push(`**目标(O)**: ${plan.objective.description}`)
          // 渲染 KR 列表
          lines.push(`**验收标准(KR)**: `)
          for (const kr of plan.objective.keyResults) {
            lines.push(`  ${kr.met ? "✅" : "⬜"} KR${kr.index}: ${kr.description} _(验证: ${kr.verification})_`)
          }
          // 渲染执行步骤列表
          lines.push(`**执行步骤**: `)
          for (const step of plan.steps) {
            lines.push(`  ${statusEmoji[step.status]} **${step.id}**: ${step.goal}`)
            lines.push(`    → 验收: ${step.acceptance}`)
            if (step.deps.length > 0) lines.push(`    → 依赖: ${step.deps.join(", ")}`)
            if (step.result) lines.push(`    → 结果: ${step.result.slice(0, 100)}`)
            if (step.attempts > 1) lines.push(`    → 重试: ${step.attempts}次`)
          }
          // 渲染级联修正历史（仅显示最近 3 次）
          if (plan.cascadeHistory.length > 0) {
            lines.push(`\n**级联修正记录** (${plan.cascadeHistory.length}次):`)
            for (const evt of plan.cascadeHistory.slice(-3)) {
              lines.push(`  - Turn${evt.turn}: ${evt.reason}`)
            }
          }
          lines.push(`</plan>`)
          return lines.join("\n")
        }),
      )

    /** 重置计划（新任务开始时调用） */
    const reset = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.set(planRef, null)
        yield* Ref.set(turnRef, 0)
      })

    // 暴露服务的所有公开方法
    return Service.of({
      createPlan,
      getPlan,
      updateStep,
      advanceToNext,
      cascade,
      evaluateKRs,
      renderPlan,
      reset,
    })
  }),
)

// TODO(I-06): 在意图路由完成后，若意图类型非 Simple，自动触发 createPlan 创建计划
// TODO(I-06): TodoWrite 工具完成（step done）后调用 advanceToNext 推进到下一步
// TODO(I-06): Checkpoint 审查时调用 evaluateKRs 验证 KR 达成情况
// TODO(I-06): scope creep 检测 / 硬约束新增 / 模型 request_more_context 时调用 cascade 进行级联修正

/**
 * OKR Plan 服务的定位节点（Location Node）
 *
 * 用于将服务注册到应用节点图中，标识服务名称、实现 Layer 和依赖项。
 * 当前无外部依赖（纯 Ref 状态管理）。
 */
export const node = makeLocationNode({
  name: "deepcode-okr-plan",
  layer,
  deps: [],
})
