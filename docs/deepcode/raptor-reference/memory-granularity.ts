/**
 * 记忆粒度分层模块（论文I-12）
 *
 * === 核心问题 ===
 * 传统Memory系统对所有信息一视同仁，但注意力预算有限——
 * 收敛任务(debug/编码)中保留大量中间推理是浪费，
 * 发散任务(研究/架构设计)中过早丢弃备选方案会丢失重要上下文。
 *
 * === 方案核心 ===
 * 记忆强度λ∈[0,1]按任务类型动态调节，三级记忆层+主动遗忘：
 *   1. Working Memory（工作记忆）：当前step的tool output、reasoning
 *      - λ=1（完整保留）在当前step内
 *      - step完成后按λ衰减
 *   2. Episodic Memory（情景记忆）：session内的决策、错误、KR进度
 *      - 结构化存储，不是原始文本
 *      - 不经过HCA压缩区（通过compaction前提取保留）
 *   3. Semantic Memory（语义记忆）：跨session的用户偏好、代码库约定、进化Skills
 *      - 持久化到磁盘
 *      - λ最高（几乎不遗忘）
 *
 * === 粒度控制规则（与意图路由联动）===
 * - Simple任务:       λ=0.2，几乎不保留中间过程，只保留结果
 * - Refactor任务:     λ=0.5，保留关键决策和重构原则
 * - Research/Brainstorm: λ=0.8，保留备选方案和推理链
 * - Architecture:     λ=0.9，保留所有设计决策和权衡
 * - Debug任务:        λ=0.3，保留错误根因和修复方法，丢弃试错过程
 * - New任务:          λ=0.7，新建文件需要保留较多设计上下文
 * - Medium任务:       λ=0.5，中等复杂度平衡保留与遗忘
 * - Collaboration:    λ=0.6，协作模式保留足够上下文供后续跟进
 * - Spec-driven:      λ=0.7，规格驱动需保留规格理解和决策链
 * - Complex:          λ=0.8，复杂任务保留较完整推理链
 * - Multidomain:      λ=0.9，跨域任务保留所有设计决策和权衡
 * - Dangerous:        λ=0.6，危险操作需保留足够决策上下文以便审计
 *
 * === 主动遗忘策略 ===
 * - 被cascade修正的旧计划版本：立即遗忘（不保留）
 * - 失败的tool尝试：只保留错误类型和根因，不保留完整错误输出
 * - Reasoning内容：紧邻回传后立即遗忘（由reasoning-manager处理）
 * - 已完成step的详细过程：压缩为一句话摘要
 */

// Effect框架核心依赖：Effect用于副作用管理，Layer用于依赖注入，
// Ref用于可变状态管理，Schema用于数据验证
import { Context, Effect, Layer, Ref, Schema } from "effect"
// 引入app-node工厂函数，用于将Service注册为应用节点
import { makeLocationNode } from "../effect/app-node"

/**
 * 任务模式（决定记忆粒度λ的宏观分类）
 * - converge: 收敛型任务（debug、简单编码等），目标明确，λ偏低，快速遗忘中间过程
 * - balanced: 平衡型任务（重构、协作等），λ中等，保留关键决策
 * - diverge:   发散型任务（研究、架构设计等），λ偏高，保留推理链和备选方案
 */
export type MemoryMode = "converge" | "balanced" | "diverge"

/**
 * 记忆条目类型
 * 定义一条结构化记忆的完整元数据
 */
export interface MemoryEntry {
  /** 唯一标识符，wm-前缀表示工作记忆，em-前缀表示情景记忆 */
  readonly id: string
  /**
   * 记忆类型标签，决定记忆的语义角色：
   * - decision:    决策记录（选择了方案A而非方案B的原因）
   * - error:       错误修复（遇到的错误及根因、修复方法）
   * - preference:  用户偏好（代码风格、工具选择等）
   * - finding:     发现（代码库中的重要观察、规律）
   * - constraint:  约束（硬约束/软约束，影响后续决策）
   * - plan_change: 计划变更（cascade触发的计划调整）
   */
  readonly type: "decision" | "error" | "preference" | "finding" | "constraint" | "plan_change"
  /** 记忆内容文本（结构化短语或摘要） */
  readonly content: string
  /** 记忆强度λ，值域[0,1]，0=已遗忘/极低价值，1=永久保留/极高价值 */
  readonly lambda: number
  /** 该记忆创建时所在的turn编号，用于时间衰减计算 */
  readonly turn: number
  /** 关联的KR编号（如果该记忆与某个KR相关），用于KR粒度的记忆检索 */
  readonly relatedKR?: number
  /** 标签列表，用于按主题遗忘（如cascade修正时按tag批量遗忘旧计划） */
  readonly tags: readonly string[]
  /** 是否已被压缩/摘要处理，压缩后λ会降低 */
  readonly compressed: boolean
}

/**
 * 会话记忆状态
 * 使用Ref管理的可变状态，存储当前会话的全部记忆数据
 */
interface MemoryState {
  /**
   * 工作记忆队列
   * 存储当前step及近期step的临时观察（tool输出、临时推理等）
   * 每条记忆带有expiresAtTurn，到期后自动衰减或提升
   */
  workingMemory: Array<MemoryEntry & { expiresAtTurn: number }>
  /**
   * 情景记忆列表
   * 存储跨step保留的高价值记忆（决策、错误修复、约束等）
   * 结构化存储，不直接保存原始文本
   */
  episodicMemory: MemoryEntry[]
  /** 当前记忆强度λ值，由意图路由动态设置 */
  currentLambda: number
  /** 当前任务模式（converge/balanced/diverge） */
  currentMode: MemoryMode
  /** 当前turn编号，每次endStep时递增，作为记忆衰减的时间基准 */
  turn: number
}

/**
 * 意图类型到记忆配置的映射表
 * 每种意图类型对应一个MemoryMode和初始λ值
 * λ值越高，该类型任务保留的中间过程越多
 */
const intentToMemoryConfig: Record<string, { mode: MemoryMode; lambda: number }> = {
  simple:       { mode: "converge", lambda: 0.2 },  // 简单任务：几乎不保留中间过程
  refactor:     { mode: "balanced", lambda: 0.5 },  // 重构任务：保留关键决策
  debug:        { mode: "converge", lambda: 0.3 },  // 调试任务：只保留根因和修复
  "new":        { mode: "diverge",   lambda: 0.7 },  // 新建任务：保留设计上下文
  medium:       { mode: "balanced", lambda: 0.5 },  // 中等复杂度：平衡策略
  architecture: { mode: "diverge",   lambda: 0.9 },  // 架构设计：保留所有决策权衡
  research:     { mode: "diverge",   lambda: 0.8 },  // 研究任务：保留推理链
  collaboration:{ mode: "balanced", lambda: 0.6 },  // 协作任务：保留足够上下文
  "spec-driven":{ mode: "diverge",   lambda: 0.7 },  // 规格驱动：保留规格理解
  complex:      { mode: "diverge",   lambda: 0.8 },  // 复杂任务：保留完整推理
  multidomain:  { mode: "diverge",   lambda: 0.9 },  // 跨域任务：保留所有决策
  dangerous:    { mode: "balanced", lambda: 0.6 },  // 危险操作：保留审计上下文
}

/**
 * 记忆粒度服务
 *
 * 提供三级记忆的管理能力：添加、遗忘、衰减、压缩提取、渲染等。
 * 作为Effect Service注册，可通过依赖注入在其他模块中使用。
 *
 * 服务标识符：@opencode/v2/DeepCode/MemoryGranularity
 */
export class Service extends Context.Service<Service, Interface>()("@opencode/v2/DeepCode/MemoryGranularity") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 初始化记忆状态：空工作记忆、空情景记忆、默认λ=0.5、平衡模式、turn=0
    const stateRef = yield* Ref.make<MemoryState>({
      workingMemory: [],
      episodicMemory: [],
      currentLambda: 0.5,
      currentMode: "balanced",
      turn: 0,
    }),
)


// === 集成点（待I-12实现）===
// TODO(I-12): 意图路由完成后调用setMode设置记忆粒度λ
// TODO(I-12): 每个tool执行结果addWorking（临时观察）
// TODO(I-12): 决策/错误修复/硬约束变化调用addEpisodic
// TODO(I-12): cascade修正旧计划后调用forgetByTag主动遗忘旧版本
// TODO(I-12): step完成/grade up时调用endStep
// TODO(I-12): compaction前调用extractForCompaction，结果注入新epoch L2区

/**
 * 记忆粒度模块的应用节点定义
 * 供应用启动时注册到依赖注入容器。
 * - name: 节点名称（deepcode-memory-granularity）
 * - service: 服务类（Service）
 * - layer: 默认服务层（layer，使用effect中定义的默认构造）
 * - deps: 依赖列表（当前无外部依赖）
 */
export const node = makeLocationNode({
  name: "deepcode-memory-granularity",
  service: Service,
  layer: layer,
  deps: [],
})
