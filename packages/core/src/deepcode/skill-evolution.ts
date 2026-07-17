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

// Effect框架核心：Context（DI token）、Effect（副作用管理）、Layer（依赖注入）、Ref（可变状态）
import { Context, Effect, Layer, Ref } from "effect"
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
  /** 触发模式：根据type不同含义各异 */
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
  /** Skill当前状态 */
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
 */
export interface CheckpointSnapshot {
  /** 检查点唯一ID */
  readonly id: string
  /** 检查点序号（单调递增，从1开始） */
  readonly sequence: number
  /** 创建快照时的对话轮次turn */
  readonly turn: number
  /** KR（Key Result）进度快照 */
  readonly krProgress: readonly { index: number; description: string; status: "not_started" | "in_progress" | "met" }[]
  /** 已修改文件列表（只记录路径和行数变化，不读取文件内容） */
  readonly modifiedFiles: readonly { path: string; addedLines: number; deletedLines: number }[]
  /** 当前执行步骤的自然语言摘要 */
  readonly currentStepSummary: string
  /** 硬约束遵守状态（逐条标注） */
  readonly constraintStatus: readonly { constraint: string; status: "followed" | "uncertain" | "violated"; evidence?: string }[]
  /** 最近的关键决策记录（最多保留最近3条） */
  readonly recentDecisions: readonly string[]
  /** 当前上下文的token数量估算 */
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
    severity: "critical" | "warning" | "info"
    description: string
    relatedKR?: number
    relatedConstraint?: string
    suggestion: string
  }[]
  /** 建议生成的新Skill列表 */
  readonly skillSuggestions: readonly { name: string; description: string; trigger: string; body: string }[]
  /** 是否需要原点回拉（注意力衰减检测） */
  readonly needsReinjection: boolean
}

/** getActiveSkills 的上下文信号 */
export interface SkillActivationContext {
  /** 最近的消息内容（用于regex匹配） */
  readonly lastMessage?: string
  /** 将要执行的工具名（用于tool匹配） */
  readonly toolName?: string
  /** 当前意图类型（用于intent匹配） */
  readonly intent?: string
}

/** recordReview 的返回结构 */
export interface RecordReviewResult {
  /** 本次新固化的Skill列表 */
  readonly newSkills: readonly EvolvedSkill[]
}

// ========== 服务接口定义（从 旧API 迁移到 Context.Service 模式） ==========

/**
 * SkillEvolution服务接口
 *
 * 提供Skills自进化和Checkpoint审查两大功能模块。
 * 通过Ref管理内部可变状态，保证线程安全和纯函数式更新。
 */
export interface Interface {
  /** 固化一个新Skill（闭环入口） */
  readonly solidifySkill: (
    name: string,
    description: string,
    triggers: readonly SkillTrigger[],
    body: string,
    origin: string,
    turn: number,
  ) => Effect.Effect<EvolvedSkill>

  /** 记录Skill触发事件（useCount +1） */
  readonly recordSkillTrigger: (skillName: string) => Effect.Effect<void>

  /** 记录Skill使用结果并执行进化逻辑 */
  readonly recordSkillResult: (skillName: string, success: boolean) => Effect.Effect<EvolvedSkill | null>

  /** 获取当前上下文中应该激活的所有Skills */
  readonly getActiveSkills: (context: SkillActivationContext) => Effect.Effect<readonly EvolvedSkill[]>

  /** 获取所有已注册的Skills（包含所有状态） */
  readonly getAllSkills: () => Effect.Effect<readonly EvolvedSkill[]>

  /** 将Skill渲染为SuperPowers兼容的Markdown格式 */
  readonly renderSkillMarkdown: (skill: EvolvedSkill) => string

  /** 创建Checkpoint快照 */
  readonly createCheckpoint: (
    krProgress: CheckpointSnapshot["krProgress"],
    modifiedFiles: CheckpointSnapshot["modifiedFiles"],
    currentStepSummary: string,
    constraintStatus: CheckpointSnapshot["constraintStatus"],
    recentDecisions: readonly string[],
    contextTokens: number,
  ) => Effect.Effect<CheckpointSnapshot>

  /** 构建独立审查Agent的Prompt（逐轮递减上下文策略） */
  readonly buildReviewPrompt: (
    snapshot: CheckpointSnapshot,
    objective: string,
    constraints: readonly string[],
  ) => string

  /** 记录审查结果，触发Skill固化闭环 */
  readonly recordReview: (review: CheckpointReview, turn: number) => Effect.Effect<RecordReviewResult>

  /** 获取最近一次的Checkpoint快照 */
  readonly getLatestCheckpoint: () => Effect.Effect<CheckpointSnapshot | null>

  /** 获取所有审查历史记录 */
  readonly getReviews: () => Effect.Effect<readonly CheckpointReview[]>

  /** 重置所有状态 */
  readonly reset: () => Effect.Effect<void>

  /** Skill存储目录常量 */
  readonly SKILLS_DIR: string
}

/** DI token — 从 旧API 迁移到 Context.Service */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeSkillEvolution",
) {}

// ========== Layer 实现 ==========

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // ---- 内部状态（使用Effect Ref管理，保证线程安全和纯函数式更新） ----

    /** Skills存储：以name为key的Map，维护所有进化中的Skill */
    const skillsRef = yield* Ref.make<Map<string, EvolvedSkill>>(new Map())
    /** Checkpoint快照历史：最多保留20个 */
    const checkpointsRef = yield* Ref.make<CheckpointSnapshot[]>([])
    /** 审查结果历史：与checkpoints对应，最多保留20个 */
    const reviewsRef = yield* Ref.make<CheckpointReview[]>([])
    /** Checkpoint序列号计数器：单调递增 */
    const seqRef = yield* Ref.make(0)

    // ---------- I-09 Skills自进化 核心方法 ----------

    /**
     * 固化一个新Skill
     *
     * 闭环入口：免疫系统发现违规/错误后调用此方法
     * 新创建的Skill状态为candidate（候选），等待实际使用数据验证有效性
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
      }).pipe(
        // 从更新后的Map中取出刚创建的Skill返回
        Effect.map((skills) => skills.get(name)!),
      )

    /** 记录Skill触发事件（useCount +1） */
    const recordSkillTrigger = (skillName: string): Effect.Effect<void> =>
      Ref.update(skillsRef, (skills) => {
        const skill = skills.get(skillName)
        if (!skill) return skills
        // 不可变更新：useCount计数+1
        const newMap = new Map(skills)
        newMap.set(skillName, { ...skill, useCount: skill.useCount + 1 })
        return newMap
      })

    /**
     * 记录Skill使用结果（成功/失败），更新成功率并执行进化逻辑
     *
     * 进化规则（在useCount >= 5时开始评估）：
     * 1. 成功率 < 30% → deprecated（废弃）
     * 2. 成功率 > 80% 且 useCount >= 10 → hardened（硬约束）
     * 3. 其他情况 → active（激活）
     */
    const recordSkillResult = (skillName: string, success: boolean): Effect.Effect<EvolvedSkill | null> =>
      Ref.updateAndGet(skillsRef, (skills) => {
        const skill = skills.get(skillName)
        if (!skill) return skills

        // 更新统计数据（useCount已在recordSkillTrigger中递增）
        const newUseCount = skill.useCount
        const newSuccessCount = skill.successCount + (success ? 1 : 0)
        const newRate = newUseCount > 0 ? newSuccessCount / newUseCount : 0

        // ---- 进化状态机逻辑 ----
        let newStatus = skill.status
        if (newUseCount >= 5) {
          if (newRate < 0.3) {
            newStatus = "deprecated"
          } else if (newRate > 0.8 && newUseCount >= 10) {
            newStatus = "hardened"
          } else {
            newStatus = "active"
          }
        }

        // 不可变更新Skill状态
        const newMap = new Map(skills)
        newMap.set(skillName, {
          ...skill,
          successCount: newSuccessCount,
          successRate: newRate,
          status: newStatus,
        })
        return newMap
      }).pipe(Effect.map((s) => s.get(skillName) ?? null))

    /**
     * 获取当前上下文中应该激活的所有Skills
     *
     * 根据当前上下文信号匹配所有非废弃Skill的触发条件
     */
    const getActiveSkills = (context: SkillActivationContext): Effect.Effect<readonly EvolvedSkill[]> =>
      Ref.get(skillsRef).pipe(
        Effect.map((skills) => {
          const active: EvolvedSkill[] = []
          for (const skill of skills.values()) {
            // 跳过已废弃的Skill
            if (skill.status === "deprecated") continue

            // 检查是否有任一触发条件匹配当前上下文
            const matched = skill.triggers.some((t) => {
              switch (t.type) {
                case "regex":
                  return context.lastMessage ? new RegExp(t.pattern, "i").test(context.lastMessage) : false
                case "tool":
                  return context.toolName === t.pattern
                case "intent":
                  return context.intent === t.pattern
                case "constraint-violation":
                  return true
                default:
                  return false
              }
            })
            if (matched) active.push(skill)
          }
          return active
        }),
      )

    /** 获取所有已注册的Skills */
    const getAllSkills = (): Effect.Effect<readonly EvolvedSkill[]> =>
      Ref.get(skillsRef).pipe(Effect.map((s) => Array.from(s.values())))

    /**
     * 将Skill渲染为SuperPowers兼容的Markdown格式
     *
     * 输出格式：YAML frontmatter + Markdown body + 页脚统计
     */
    const renderSkillMarkdown = (skill: EvolvedSkill): string => {
      return `---
name: ${skill.name}
description: ${skill.description}
status: ${skill.status}
use_count: ${skill.useCount}
success_rate: ${(skill.successRate * 100).toFixed(0)}%
origin: "${skill.origin}"
triggers:
${skill.triggers.map((t) => `  - type: ${t.type}\n    pattern: "${t.pattern}"`).join("\n")}
---

# ${skill.name}

${skill.description}

## 触发条件
${skill.triggers.map((t) => `- ${t.type}: \`${t.pattern}\``).join("\n")}

## 检查/执行逻辑
${skill.body}

---
_此Skill由DeepCode免疫系统自动创建。使用${skill.useCount}次，成功率${(skill.successRate * 100).toFixed(0)}%。_
`
    }

    // ---------- I-11 Checkpoint快照驱动审查 核心方法 ----------

    /**
     * 创建Checkpoint快照
     *
     * 设计原则：快照只包含结构化信息（结果），不包含执行过程日志
     * 快照保留策略：最多保留最近20个
     */
    const createCheckpoint = (
      krProgress: CheckpointSnapshot["krProgress"],
      modifiedFiles: CheckpointSnapshot["modifiedFiles"],
      currentStepSummary: string,
      constraintStatus: CheckpointSnapshot["constraintStatus"],
      recentDecisions: readonly string[],
      contextTokens: number,
    ): Effect.Effect<CheckpointSnapshot> =>
      Effect.gen(function* () {
        // 获取并递增序列号
        const seq = yield* Ref.updateAndGet(seqRef, (s) => s + 1)
        // 构造快照对象
        const checkpoint: CheckpointSnapshot = {
          id: `cp-${Date.now().toString(36)}-${seq}`,
          sequence: seq,
          turn: 0,  // turn由调用方在外部设置
          krProgress,
          modifiedFiles,
          currentStepSummary,
          constraintStatus,
          recentDecisions: recentDecisions.slice(-3),
          contextTokens,
        }
        // 追加到快照列表，保留最近19个+新的=最多20个
        yield* Ref.update(checkpointsRef, (cps) => [...cps.slice(-19), checkpoint])
        return checkpoint
      })

    /**
     * 构建独立审查Agent的Prompt
     *
     * 核心设计：逐轮递减上下文策略（decayFactor）
     * 前五轮给全部上下文，之后每轮递减至最低保留量
     */
    const buildReviewPrompt = (
      snapshot: CheckpointSnapshot,
      objective: string,
      constraints: readonly string[],
    ): string => {
      // 计算上下文衰减因子：前5轮100%，之后递减
      const decayFactor = Math.min(1, 5 / snapshot.sequence)
      const maxFiles = Math.max(3, Math.ceil(snapshot.modifiedFiles.length * decayFactor))
      const maxKRs = Math.max(2, Math.ceil(snapshot.krProgress.length * decayFactor))

      const lines = [`你是一个独立的代码审查Agent。你只能看到检查点快照，看不到执行过程。`]
      lines.push(`\n原始目标: ${objective}`)
      lines.push(`\n硬约束（必须逐条检查）:`)
      for (const c of constraints) lines.push(`- ${c}`)

      lines.push(`\nKR验收标准进度（重点检查未完成的）:`)
      const criticalKRs = snapshot.krProgress.filter((kr) => kr.status !== "met").slice(0, maxKRs)
      for (const kr of criticalKRs) {
        lines.push(`- [${kr.status}] KR${kr.index}: ${kr.description}`)
      }

      lines.push(`\n当前步骤: ${snapshot.currentStepSummary}`)
      lines.push(`\n约束遵守状态:`)
      for (const cs of snapshot.constraintStatus) {
        const icon = cs.status === "followed" ? "✅" : cs.status === "violated" ? "❌" : "⚠️"
        lines.push(`- ${icon} ${cs.constraint}${cs.evidence ? ` (证据: ${cs.evidence})` : ""}`)
      }

      lines.push(`\n已修改文件（前${maxFiles}个）:`)
      for (const f of snapshot.modifiedFiles.slice(0, maxFiles)) {
        lines.push(`- ${f.path} (+${f.addedLines}/-${f.deletedLines})`)
      }

      if (snapshot.recentDecisions.length > 0) {
        lines.push(`\n最近决策:`)
        for (const d of snapshot.recentDecisions) lines.push(`- ${d}`)
      }

      lines.push(`\n请审查：
1. 每条硬约束是否被遵守？（逐条对照）
2. 未完成的KR是否在正确推进？
3. 是否有scope creep（修改了不该改的文件）？
4. 是否需要建议新的Skill防止未来犯同样错误？
5. 是否需要重新注入原始目标和约束（注意力衰减警报）？

输出JSON格式：
{
  "overallStatus": "pass|warning|fail",
  "issues": [{"severity": "critical|warning|info", "description": "...", "relatedKR": number, "relatedConstraint": "...", "suggestion": "..."}],
  "skillSuggestions": [{"name": "...", "description": "...", "trigger": "...", "body": "..."}],
  "needsReinjection": true/false
}`)

      return lines.join("\n")
    }

    /**
     * 记录审查结果，触发Skill固化闭环
     *
     * 这是连接I-11（审查）和I-09（Skill进化）的关键桥梁：
     * 审查Agent发现的问题如果建议了新Skill，会自动调用solidifySkill固化
     */
    const recordReview = (
      review: CheckpointReview,
      turn: number,
    ): Effect.Effect<RecordReviewResult> =>
      Effect.gen(function* () {
        // 保存审查结果，最多保留20条
        yield* Ref.update(reviewsRef, (rs) => [...rs.slice(-19), review])

        // ---- I-09闭环触发：审查建议的新Skill自动固化 ----
        const newSkills: EvolvedSkill[] = []
        for (const sugg of review.skillSuggestions) {
          const skill = yield* solidifySkill(
            sugg.name,
            sugg.description,
            [{ type: "constraint-violation", pattern: sugg.trigger }],
            sugg.body,
            `Checkpoint review at turn ${turn}`,
            turn,
          )
          newSkills.push(skill)
        }
        return { newSkills }
      })

    /** 获取最近一次的Checkpoint快照 */
    const getLatestCheckpoint = (): Effect.Effect<CheckpointSnapshot | null> =>
      Ref.get(checkpointsRef).pipe(Effect.map((cps) => cps[cps.length - 1] ?? null))

    /** 获取所有审查历史记录 */
    const getReviews = (): Effect.Effect<readonly CheckpointReview[]> =>
      Ref.get(reviewsRef)

    /** 重置所有状态 */
    const reset = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.set(skillsRef, new Map())
        yield* Ref.set(checkpointsRef, [])
        yield* Ref.set(reviewsRef, [])
        yield* Ref.set(seqRef, 0)
      })

    // ---- 暴露Service的公开方法 ----
    return Service.of({
      // I-09 Skills自进化相关方法
      solidifySkill,
      recordSkillTrigger,
      recordSkillResult,
      getActiveSkills,
      getAllSkills,
      renderSkillMarkdown,
      // I-11 Checkpoint审查相关方法
      createCheckpoint,
      buildReviewPrompt,
      recordReview,
      getLatestCheckpoint,
      getReviews,
      reset,
      SKILLS_DIR,
    })
  }),
)

// ========== TODO待实现功能（未来迭代计划） ==========

// TODO(I-09): solidifySkill时异步写入.skills/目录为markdown文件（持久化）
// TODO(I-09): 任务开始时从.skills/目录加载已有Skills到内存（初始化加载）
// TODO(I-09): 每次tool执行前匹配skill triggers，激活的skills注入到Mid-Conversation Message
// TODO(I-09): hardened级别的skills自动转为hard constraints注入L1区
// TODO(I-11): step完成/grade up时调用createCheckpoint生成快照
// TODO(I-11): 使用subagent执行快照审查（隔离审查）
// TODO(I-11): needsReinjection=true时调用review-anti-drift的getReinjectionContent

// ========== Effect节点注册 ==========

/**
 * 将SkillEvolution服务注册为Effect应用节点
 * 无外部服务依赖（deps 为空）。
 */
export const node = makeLocationNode({
  name: "deepcode-skill-evolution",
  layer,
  deps: [],
})
