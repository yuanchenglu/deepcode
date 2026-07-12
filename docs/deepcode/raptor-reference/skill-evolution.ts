/**
 * Skills自进化闭环（论文I-09）+ Checkpoint快照驱动多轮审查（论文I-11）
 *
 * === I-09 Skills自进化闭环 ===
 * 核心问题：Agent重复犯同样的错误，因为从错误中学习的机制缺失
 * 闭环路径：执行完成 → 免疫系统发现违规/错误 → propose_skill提议 → solidify固化为Skill文件 →
 *          Skill注册到auto-trigger → 下次同类场景自动触发 → 统计触发次数和有效性 → 进化（强化/淘汰）
 *
 * 设计要点：
 * - Skill固化格式：markdown frontmatter（兼容SuperPowers格式）+ body
 * - Skill元数据：trigger条件（正则/工具/意图）、检查逻辑、修复建议、创建原因、使用次数、成功率
 * - 进化规则：成功率<30%的Skill被废弃（从未正确触发）、成功率>80%的升级为硬约束
 * - Skill存储：.deepcode/skills/目录，按类别组织
 *
 * === I-11 Checkpoint快照驱动审查 ===
 * 核心问题：长任务审查时读取全部执行日志导致上下文爆炸，审查质量反而下降
 * 方案：结构化快照+逐轮递减上下文+独立子Agent审查
 * - 快照只包含：当前KR进度、修改文件列表、关键产出摘要、硬约束遵守情况
 * - 不带完整执行日志（不读过程，只看结果对照约束）
 * - 独立审查subagent：上下文只包含快照+约束+KR，完全隔离
 * - 逐轮递减：每轮review给的上下文量递减（避免审查本身膨胀）
 */

// ========== 外部依赖导入 ==========

// Effect框架核心：Effect用于副作用管理，Layer用于依赖注入，Ref用于可变状态引用，Schema用于数据验证
import { Context, Effect, Layer, Ref, Schema } from "effect"
// 应用节点构造器，用于将Service注册到Effect的依赖注入容器
import { makeLocationNode } from "../effect/app-node"

// ========== I-09 Skills自进化 数据模型 ==========

/**
 * Skill触发条件定义
 * 描述在什么场景下应该自动激活某个Skill
 */
export interface SkillTrigger {
  /** 触发类型：正则匹配/工具调用/意图识别/约束违规 */
  readonly type: "regex" | "tool" | "intent" | "constraint-violation"
  /** 触发模式：根据type不同含义各异
   * - regex: 正则表达式模式，匹配最近消息内容
   * - tool: 工具名称，匹配即将执行的工具
   * - intent: 意图类型，匹配当前识别的用户意图
   * - constraint-violation: 约束违规模式，在审查时匹配
   */
  readonly pattern: string
}

/**
 * 进化中的Skill实体
 * 代表一个从错误/经验中学习并持续进化的技能单元
 * 生命周期：candidate(候选) → active(激活) → hardened(硬约束) / deprecated(废弃)
 */
export interface EvolvedSkill {
  /** Skill名称（kebab-case命名规范） */
  readonly name: string
  /** Skill功能描述 */
  readonly description: string
  /** 触发条件列表（满足任一即触发） */
  readonly triggers: readonly SkillTrigger[]
  /** Skill主体内容：检查逻辑、修复建议、执行指引等 */
  readonly body: string
  /** 创建原因：记录这个Skill是由哪个免疫系统发现/违规场景产生的 */
  readonly origin: string
  /** 创建时所在的turn（对话轮次），用于追溯 */
  readonly createdTurn: number
  /** 被触发/使用的总次数 */
  readonly useCount: number
  /** 成功次数（触发后经审查确认正确处理了问题） */
  readonly successCount: number
  /** 成功率 = successCount / useCount，决定进化方向 */
  readonly successRate: number
  /** Skill当前状态
   * - candidate: 候选态，新创建尚未验证
   * - active: 激活态，已有一定使用数据，正常参与触发
   * - hardened: 强化态，高成功率(>80%)且使用充分(≥10次)，升级为硬约束
   * - deprecated: 废弃态，低成功率(<30%)，不再触发
   */
  readonly status: "candidate" | "active" | "hardened" | "deprecated"
}

/**
 * Skill文件存储目录路径（相对于项目根目录）
 * 固化的Skill以markdown格式持久化到此目录
 */
const SKILLS_DIR = ".deepcode/skills"

// ========== I-11 Checkpoint快照 数据模型 ==========

/**
 * Checkpoint检查点快照
 *
 * 核心设计原则：只存结构化结果信息，不存执行过程日志
 * 这样在审查时不会因为上下文过长（读取全部日志）而导致审查质量下降
 * 类比：如同代码审查看diff和当前状态，而不是看开发者的每一次keystroke
 */
export interface CheckpointSnapshot {
  /** 检查点唯一ID（基于时间戳+序列号生成） */
  readonly id: string
  /** 检查点序号（单调递增，从1开始） */
  readonly sequence: number
  /** 创建快照时的对话轮次turn */
  readonly turn: number
  /** KR（Key Result，关键结果）进度快照
   * 每条记录包含：KR索引、描述、当前状态（未开始/进行中/已达成）
   */
  readonly krProgress: readonly { index: number; description: string; status: "not_started" | "in_progress" | "met" }[]
  /** 已修改文件列表（只记录路径和行数变化，不读取文件内容）
   * 用于快速检测scope creep（越界修改）
   */
  readonly modifiedFiles: readonly { path: string; addedLines: number; deletedLines: number }[]
  /** 当前执行步骤的自然语言摘要 */
  readonly currentStepSummary: string
  /** 硬约束遵守状态（逐条标注）
   * - followed: 已遵守
   * - uncertain: 无法确定
   * - violated: 已违反
   * evidence字段可选，用于记录判定依据
   */
  readonly constraintStatus: readonly { constraint: string; status: "followed" | "uncertain" | "violated"; evidence?: string }[]
  /** 最近的关键决策记录（最多保留最近3条，避免膨胀） */
  readonly recentDecisions: readonly string[]
  /** 当前上下文的token数量估算（用于逐轮递减策略的计算） */
  readonly contextTokens: number
}

/**
 * Checkpoint审查结果
 * 由独立的审查子Agent返回，完全隔离于主执行上下文
 */
export interface CheckpointReview {
  /** 对应的检查点ID */
  readonly checkpointId: string
  /** 总体状态：通过/警告/失败 */
  readonly overallStatus: "pass" | "warning" | "fail"
  /** 发现的问题列表 */
  readonly issues: readonly {
    /** 严重程度：严重/警告/信息 */
    severity: "critical" | "warning" | "info"
    /** 问题描述 */
    description: string
    /** 关联的KR索引（可选） */
    relatedKR?: number
    /** 关联的约束内容（可选） */
    relatedConstraint?: string
    /** 修复建议 */
    suggestion: string
  }[]
  /** 建议生成的新Skill列表
   * 审查中发现的重复模式/防错规则可建议固化为Skill
   * 这是I-09闭环的关键输入点
   */
  readonly skillSuggestions: readonly { name: string; description: string; trigger: string; body: string }[]
  /** 是否需要原点回拉（注意力衰减检测）
   * 为true时表示Agent可能已经偏离原始目标，需要重新注入objective和constraints
   */
  readonly needsReinjection: boolean
}

// ========== Service层：核心业务逻辑 ==========

/**
 * SkillEvolution服务
 *
 * 使用Effect的Service模式定义，通过Ref管理内部可变状态
 * 提供Skills自进化和Checkpoint审查两大功能模块
 */
export class Service extends Context.Service<Service, Interface>()("@opencode/v2/DeepCode/SkillEvolution") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // ---- 内部状态（使用Effect Ref管理，保证线程安全和纯函数式更新） ----

    /** Skills存储：以name为key的Map，维护所有进化中的Skill */
    const skillsRef = yield* Ref.make<Map<string, EvolvedSkill>>(new Map())
    /** Checkpoint快照历史：最多保留20个（slice(-19)策略） */
    const checkpointsRef = yield* Ref.make<CheckpointSnapshot[]>([])
    /** 审查结果历史：与checkpoints对应，最多保留20个 */
    const reviewsRef = yield* Ref.make<CheckpointReview[]>([])
    /** Checkpoint序列号计数器：单调递增，用于生成唯一ID */
    const seqRef = yield* Ref.make(0)

    // ---------- I-09 Skills自进化 核心方法 ----------

    /**
     * 固化一个新Skill
     *
     * 闭环入口：免疫系统发现违规/错误后，或审查propose_skill后调用此方法
     * 完成闭环步骤：发现问题 → 生成Skill → 注册到内存（未来还需写入文件）
     *
     * 新创建的Skill状态为candidate（候选），等待实际使用数据来验证有效性
     *
     * @param name - Skill名称（kebab-case）
     * @param description - Skill功能描述
     * @param triggers - 触发条件列表
     * @param body - Skill主体内容（检查逻辑/修复建议）
     * @param origin - 创建原因（来自免疫系统的发现描述）
     * @param turn - 当前对话轮次
     * @returns 新创建的EvolvedSkill对象
     */
    const solidifySkill = (
      name: string,
      description: string,
      triggers: readonly SkillTrigger[],
      body: string,
      origin: string,
      turn: number,
    ): Effect.Effect<EvolvedSkill> =>
      Ref.updateAndGet(skillsRef, (skills) => {
        // 构造新Skill对象，初始统计值都为0，状态为candidate
        const skill: EvolvedSkill = {
          name,
          description,
          triggers,
          body,
          origin,
          createdTurn: turn,
          useCount: 0,
          successCount: 0,
          successRate: 0,
          status: "candidate",
        }
        // 创建新Map（不可变更新），将新Skill加入
        const newMap = new Map(skills)
        newMap.set(name, skill)
        return newMap
      }),
)


// ========== TODO待实现功能（未来迭代计划） ==========

// TODO(I-09): solidifySkill时异步写入.skills/目录为markdown文件（持久化）
// TODO(I-09): 任务开始时从.skills/目录加载已有Skills到内存（初始化加载）
// TODO(I-09): 每次tool执行前匹配skill triggers，激活的skills注入到Mid-Conversation Message（自动触发注入）
// TODO(I-09): hardened级别的skills自动转为hard constraints注入L1区（硬约束升级）
// TODO(I-11): step完成/grade up时调用createCheckpoint生成快照（自动快照）
// TODO(I-11): 使用subagent执行快照审查（不要在主agent上下文中审查）（隔离审查）
// TODO(I-11): needsReinjection=true时调用review-anti-drift的getReinjectionContent（原点回拉）

// ========== Effect节点注册 ==========

/**
 * 将SkillEvolution服务注册为Effect应用节点
 *
 * - name: 节点唯一标识名
 * - service: 服务类引用
 * - layer: 默认依赖注入Layer
 * - deps: 依赖的其他服务列表（当前无外部依赖）
 */
export const node = makeLocationNode({
  name: "deepcode-skill-evolution",
  service: Service,
  layer: layer,
  deps: [],
})
