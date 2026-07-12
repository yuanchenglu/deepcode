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

import { Context, Effect, Layer, Ref, Schema } from "effect"
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

/**
 * Plan 级联服务
 *
 * 提供 OKR 计划的创建、查询、步骤更新、推进、级联修正、KR 评估、渲染和重置功能。
 * 使用 Effect 的 Ref 管理可变状态（planRef 存储当前计划，turnRef 记录级联轮次）。
 *
 * 服务标识符：@opencode/v2/DeepCode/OKRPlan
 */
export class Service extends Context.Service<Service, Interface>()("@opencode/v2/DeepCode/OKRPlan") {}

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
     * 在意图路由完成后、实际执行前调用。根据传入的目标、KR 列表和步骤列表，
     * 构建一个完整的 Plan 对象并将其设为当前活动计划。
     *
     * 初始化规则：
     * - 步骤 ID 自动编号为 s1, s2, s3...
     * - 若步骤未指定 okr 且只有 1 个 KR，则默认关联 KR0；否则 okr 为空数组
     * - 若步骤未指定 deps，则第 1 个步骤无依赖，后续步骤依赖前一个步骤
     * - 第 1 个步骤初始状态为 in_progress，其余为 pending
     * - 初始 revision 为 1，cascadeHistory 为空
     *
     * @param objective - 用户目标的一句话描述
     * @param krs - Key Result 列表，每项包含 description 和 verification
     * @param steps - PlanStep 初始列表，可省略 okr 和 deps（由系统自动推导）
     * @returns 新创建的 Plan 对象
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
            }),
)


// TODO(I-06): 在意图路由完成后，若意图类型非 Simple，自动触发 createPlan 创建计划
// TODO(I-06): TodoWrite 工具完成（step done）后调用 advanceToNext 推进到下一步
// TODO(I-06): Checkpoint 审查时调用 evaluateKRs 验证 KR 达成情况
// TODO(I-06): scope creep 检测 / 硬约束新增 / 模型 request_more_context 时调用 cascade 进行级联修正

/**
 * OKR Plan 服务的定位节点（Location Node）
 *
 * 用于将服务注册到应用节点图中，标识服务名称、实现类、默认 Layer 和依赖项。
 * 通过 makeLocationNode 创建，支持在依赖注入容器中被其他组件发现和引用。
 */
export const node = makeLocationNode({
  /** 节点名称，用于在节点图中唯一标识 */
  name: "deepcode-okr-plan",
  /** 服务实现类 */
  service: Service,
  /** 默认服务 Layer（使用 layer，即 effect 字段中定义的构造） */
  layer: layer,
  /** 依赖的其他服务列表（当前无外部依赖） */
  deps: [],
})
