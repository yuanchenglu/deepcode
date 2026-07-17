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

// Effect框架核心依赖：Context（DI token）、Effect（副作用管理）、Layer（依赖注入）、Ref（可变状态）
import { Context, Effect, Layer, Ref } from "effect"
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
   * - decision:    决策记录
   * - error:       错误修复
   * - preference:  用户偏好
   * - finding:     发现
   * - constraint:  约束
   * - plan_change: 计划变更
   */
  readonly type: "decision" | "error" | "preference" | "finding" | "constraint" | "plan_change"
  /** 记忆内容文本（结构化短语或摘要） */
  readonly content: string
  /** 记忆强度λ，值域[0,1]，0=已遗忘/极低价值，1=永久保留/极高价值 */
  readonly lambda: number
  /** 该记忆创建时所在的turn编号，用于时间衰减计算 */
  readonly turn: number
  /** 关联的KR编号（如果该记忆与某个KR相关） */
  readonly relatedKR?: number
  /** 标签列表，用于按主题遗忘 */
  readonly tags: readonly string[]
  /** 是否已被压缩/摘要处理，压缩后λ会降低 */
  readonly compressed: boolean
}

/** 工作记忆条目（带过期turn） */
interface WorkingMemoryEntry extends MemoryEntry {
  /** 过期turn编号，到期后自动衰减或提升 */
  expiresAtTurn: number
}

/**
 * 会话记忆状态
 * 使用Ref管理的可变状态，存储当前会话的全部记忆数据
 */
interface MemoryState {
  /** 工作记忆队列（当前step及近期step的临时观察） */
  workingMemory: WorkingMemoryEntry[]
  /** 情景记忆列表（跨step保留的高价值记忆） */
  episodicMemory: MemoryEntry[]
  /** 当前记忆强度λ值，由意图路由动态设置 */
  currentLambda: number
  /** 当前任务模式 */
  currentMode: MemoryMode
  /** 当前turn编号，每次endStep时递增 */
  turn: number
}

/** setMode 的返回结构 */
export interface SetModeResult {
  readonly mode: MemoryMode
  readonly lambda: number
}

/** endStep 的返回结构 */
export interface EndStepResult {
  /** 提升为情景记忆的条目数 */
  readonly promoted: number
  /** 过期丢弃的条目数 */
  readonly expired: number
}

/** getStats 的返回结构 */
export interface MemoryStats {
  readonly mode: MemoryMode
  readonly lambda: number
  readonly workingCount: number
  readonly episodicCount: number
  readonly turn: number
}

/**
 * 意图类型到记忆配置的映射表
 * 每种意图类型对应一个MemoryMode和初始λ值
 */
const intentToMemoryConfig: Record<string, { mode: MemoryMode; lambda: number }> = {
  simple:       { mode: "converge", lambda: 0.2 },
  refactor:     { mode: "balanced", lambda: 0.5 },
  debug:        { mode: "converge", lambda: 0.3 },
  "new":        { mode: "diverge",   lambda: 0.7 },
  medium:       { mode: "balanced", lambda: 0.5 },
  architecture: { mode: "diverge",   lambda: 0.9 },
  research:     { mode: "diverge",   lambda: 0.8 },
  collaboration:{ mode: "balanced", lambda: 0.6 },
  "spec-driven":{ mode: "diverge",   lambda: 0.7 },
  complex:      { mode: "diverge",   lambda: 0.8 },
  multidomain:  { mode: "diverge",   lambda: 0.9 },
  dangerous:    { mode: "balanced", lambda: 0.6 },
}

// ========== 服务接口定义（从 旧API 迁移到 Context.Service 模式） ==========

/**
 * 记忆粒度服务接口
 *
 * 提供三级记忆的管理能力：添加、遗忘、衰减、压缩提取、渲染等。
 */
export interface Interface {
  /** 设置记忆模式（意图路由后调用） */
  readonly setMode: (intentType: string) => Effect.Effect<SetModeResult>

  /**
   * 添加工作记忆
   *
   * @param type - 记忆类型
   * @param content - 记忆内容文本
   * @param tags - 标签列表
   * @param lifetimeTurns - 存活turn数，默认3
   * @param relatedKR - 关联的KR编号（可选）
   */
  readonly addWorking: (
    type: MemoryEntry["type"],
    content: string,
    tags?: readonly string[],
    lifetimeTurns?: number,
    relatedKR?: number,
  ) => Effect.Effect<void>

  /**
   * 添加情景记忆
   *
   * @param type - 记忆类型
   * @param content - 记忆内容文本
   * @param tags - 标签列表
   * @param lambda - 自定义λ值（不传则使用当前模式的λ）
   * @param relatedKR - 关联的KR编号（可选）
   * @returns 新创建的记忆条目
   */
  readonly addEpisodic: (
    type: MemoryEntry["type"],
    content: string,
    tags?: readonly string[],
    lambda?: number,
    relatedKR?: number,
  ) => Effect.Effect<MemoryEntry>

  /** 主动遗忘（按标签），返回被标记为遗忘的情景记忆条目数量 */
  readonly forgetByTag: (tag: string) => Effect.Effect<number>

  /** Step结束处理（记忆衰减与提升） */
  readonly endStep: () => Effect.Effect<EndStepResult>

  /** Compaction前提取高价值记忆，返回格式化文本 */
  readonly extractForCompaction: (maxTokens?: number) => Effect.Effect<string>

  /** 获取当前记忆统计信息 */
  readonly getStats: () => Effect.Effect<MemoryStats>

  /** 重置记忆状态 */
  readonly reset: () => Effect.Effect<void>

  /** 渲染情景记忆为可读文本 */
  readonly renderEpisodic: (maxEntries?: number) => Effect.Effect<string>
}

/** DI token — 从 旧API 迁移到 Context.Service */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeMemoryGranularity",
) {}

// ========== Layer 实现 ==========

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
    })

    /**
     * 设置记忆模式
     * 在意图路由完成后调用，根据意图类型更新当前的MemoryMode和λ值。
     */
    const setMode = (intentType: string): Effect.Effect<SetModeResult> =>
      Ref.updateAndGet(stateRef, (s) => {
        // 查找对应配置，未知类型默认使用balanced模式λ=0.5
        const config = intentToMemoryConfig[intentType] ?? { mode: "balanced" as const, lambda: 0.5 }
        return { ...s, currentMode: config.mode, currentLambda: config.lambda }
      }).pipe(Effect.map((s) => ({ mode: s.currentMode, lambda: s.currentLambda })))

    /**
     * 添加工作记忆
     * 用于存储当前step的临时观察（tool输出、临时发现等）。
     * 工作记忆具有生命周期，在指定turn数后自动过期。
     */
    const addWorking = (
      type: MemoryEntry["type"],
      content: string,
      tags: readonly string[] = [],
      lifetimeTurns: number = 3,
      relatedKR?: number,
    ): Effect.Effect<void> =>
      Ref.update(stateRef, (s) => {
        // 构造工作记忆条目
        const entry: WorkingMemoryEntry = {
          id: `wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          content,
          lambda: s.currentLambda * 0.5,  // 工作记忆λ打5折，因为临时性更强
          turn: s.turn,
          tags,
          compressed: false,
          expiresAtTurn: s.turn + lifetimeTurns,
          relatedKR,
        }
        return {
          ...s,
          // 添加新条目的同时清理已过期的工作记忆
          workingMemory: [...s.workingMemory.filter((e) => e.expiresAtTurn > s.turn), entry],
        }
      })

    /**
     * 添加情景记忆
     * 用于存储跨step保留的高价值记忆：决策、错误修复、约束变化、计划变更等。
     */
    const addEpisodic = (
      type: MemoryEntry["type"],
      content: string,
      tags: readonly string[] = [],
      lambda?: number,
      relatedKR?: number,
    ): Effect.Effect<MemoryEntry> =>
      Ref.updateAndGet(stateRef, (s) => {
        const entry: MemoryEntry = {
          id: `em-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          content,
          lambda: lambda ?? s.currentLambda,
          turn: s.turn,
          tags,
          compressed: false,
          relatedKR,
        }
        return {
          ...s,
          episodicMemory: [...s.episodicMemory, entry],
        }
      }).pipe(
        Effect.map((s) => s.episodicMemory[s.episodicMemory.length - 1]!),
      )

    /**
     * 主动遗忘（按标签）
     * 当cascade修正旧计划时调用：
     * - 情景记忆：λ降低到原来的10%，标记为compressed
     * - 工作记忆：直接过滤移除
     */
    const forgetByTag = (tag: string): Effect.Effect<number> =>
      Ref.updateAndGet(stateRef, (s) => ({
        ...s,
        episodicMemory: s.episodicMemory.map((e) =>
          e.tags.includes(tag) ? { ...e, lambda: e.lambda * 0.1, compressed: true } : e,
        ),
        workingMemory: s.workingMemory.filter((e) => !e.tags.includes(tag)),
      })).pipe(
        Effect.map((s) => s.episodicMemory.filter((e) => e.tags.includes(tag)).length),
      )

    /**
     * Step结束处理
     * 在每个推理step完成时调用，执行记忆衰减和提升逻辑：
     * 1. turn计数器递增
     * 2. 过滤出已过期的工作记忆
     * 3. 高λ(>0.5)的过期工作记忆提升为情景记忆（λ打8折）
     * 4. 低λ的过期工作记忆直接丢弃
     */
    const endStep = (): Effect.Effect<EndStepResult> =>
      Ref.updateAndGet(stateRef, (s) => {
        // turn递增，表示进入下一个推理步骤
        const newState = { ...s, turn: s.turn + 1 }
        // 分离过期和未过期的工作记忆
        const expired = newState.workingMemory.filter((e) => e.expiresAtTurn <= newState.turn)
        const remaining = newState.workingMemory.filter((e) => e.expiresAtTurn > newState.turn)

        // 高价值工作记忆提升为情景记忆
        const promoted: MemoryEntry[] = []
        for (const e of expired) {
          if (e.lambda > 0.5) {
            promoted.push({
              id: e.id.replace("wm-", "em-"),
              type: e.type,
              content: e.content,
              lambda: e.lambda * 0.8,  // 提升时λ衰减20%
              turn: newState.turn,
              tags: e.tags,
              compressed: true,
              relatedKR: e.relatedKR,
            })
          }
        }

        return {
          ...newState,
          workingMemory: remaining,
          episodicMemory: [...newState.episodicMemory, ...promoted],
        }
      }).pipe(
        Effect.map((s) => {
          const expired = s.episodicMemory.filter((e) => e.compressed && e.turn < s.turn - 20).length
          return {
            promoted: s.episodicMemory.filter((e) => e.id.startsWith("em-") && e.compressed).length,
            expired,
          }
        }),
      )

    /**
     * Compaction前提取记忆
     * 在上下文压缩（HCA）执行前调用，从情景记忆中提取最高价值的条目。
     *
     * 提取策略：按λ值降序排列，按token预算贪心选择
     */
    const extractForCompaction = (maxTokens: number = 2000): Effect.Effect<string> =>
      Ref.get(stateRef).pipe(
        Effect.map((s) => {
          // 按λ降序排列，高价值记忆优先保留
          const allMemories = [...s.episodicMemory].sort((a, b) => b.lambda - a.lambda)

          // 按token预算贪心选择
          const selected: MemoryEntry[] = []
          let tokenCount = 0
          for (const m of allMemories) {
            const tokens = Math.ceil(m.content.length / 4)
            if (tokenCount + tokens > maxTokens) break
            selected.push(m)
            tokenCount += tokens
          }

          if (selected.length === 0) return ""

          // 格式化为<session-memory>标签包裹的文本
          const lines = ["<session-memory>（从上一阶段保留的高价值记忆）"]
          const typeLabel: Record<MemoryEntry["type"], string> = {
            decision: "决策",
            error: "错误修复",
            preference: "偏好",
            finding: "发现",
            constraint: "约束",
            plan_change: "计划变更",
          }
          for (const m of selected) {
            lines.push(`- [${typeLabel[m.type]}] ${m.content}`)
          }
          lines.push("</session-memory>")
          return lines.join("\n")
        }),
      )

    /** 获取当前记忆统计信息 */
    const getStats = (): Effect.Effect<MemoryStats> =>
      Ref.get(stateRef).pipe(
        Effect.map((s) => ({
          mode: s.currentMode,
          lambda: s.currentLambda,
          workingCount: s.workingMemory.length,
          episodicCount: s.episodicMemory.length,
          turn: s.turn,
        })),
      )

    /** 重置记忆状态 */
    const reset = (): Effect.Effect<void> =>
      Ref.set(stateRef, {
        workingMemory: [],
        episodicMemory: [],
        currentLambda: 0.5,
        currentMode: "balanced",
        turn: 0,
      })

    /**
     * 渲染情景记忆为可读文本
     * 用于Mid-Conversation Message注入。
     */
    const renderEpisodic = (maxEntries: number = 10): Effect.Effect<string> =>
      Ref.get(stateRef).pipe(
        Effect.map((s) => {
          const topMemories = [...s.episodicMemory]
            .sort((a, b) => b.lambda - a.lambda)
            .slice(0, maxEntries)
          if (topMemories.length === 0) return ""
          const lines = ["<key-decisions>（当前会话的关键记忆）"]
          for (const m of topMemories) lines.push(`- ${m.content}`)
          lines.push("</key-decisions>")
          return lines.join("\n")
        }),
      )

    // 返回服务实例，暴露所有公共方法
    return Service.of({
      setMode,
      addWorking,
      addEpisodic,
      forgetByTag,
      endStep,
      extractForCompaction,
      getStats,
      reset,
      renderEpisodic,
    })
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
 * 无外部服务依赖（deps 为空）。
 */
export const node = makeLocationNode({
  name: "deepcode-memory-granularity",
  layer,
  deps: [],
})
