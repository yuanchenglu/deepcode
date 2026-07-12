/**
 * DeepCode Harness — 7+1 意图分类器
 *
 * 模块五：在执行前自动识别任务类型，绑定对应的执行策略
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * 不同类型任务需要不同的执行策略：
 * - "排序 import"：直接做，不需要 Plan，不需要审查
 * - "重构支付模块"：需要深度面谈、细粒度 Plan、每步审查
 * - "从零搭建博客"：需求澄清、完整 Plan、关键节点审查
 * - "对比 ORM 框架"：探索性任务，不做修改
 *
 * 论文 I-08（7+1 意图路由）的分类：
 * - 7 种任务类型：Simple/Medium/Refactor/New/Architecture/Research/Collaboration
 * - +1 Spec-Driven：检测到 openspec/ 时走协议流程
 *
 * ============================================================
 * 分类策略
 * ============================================================
 *
 * 两级分类（Hybrid）：
 * 1. Code-based 快速规则：正则匹配高置信度 case（零成本，零延迟）
 * 2. 未匹配 case 降级到 medium（保守策略）
 *
 * 为什么不全用 LLM 分类？
 * - 正则覆盖高频明确意图（"重构 X" → refactor）
 * - LLM 分类有 token 成本和延迟
 * - 保守降级（medium）在大多数场景表现足够好
 * - 后续可在首轮 prompt 中让 LLM 确认/修正分类
 *
 * @module
 */

import { Context, Effect, Layer, Ref } from "effect"
import { makeLocationNode } from "../../effect/app-node"

// ============================================================
// 类型定义
// ============================================================

/**
 * 8 种意图类型
 *
 * - simple:        简单机械任务，无计划直接执行
 * - medium:        常规功能/bug 修复，简单确认
 * - refactor:      代码重构，细粒度计划+高频审查
 * - new:           新建项目/功能，深度需求澄清+完整计划
 * - architecture: 架构设计，方案对比+最大推理
 * - research:      调研分析，探索性，不做写入
 * - collaboration: 多文件/多模块协作，分模块处理
 * - spec-driven:   OpenSpec 协议驱动（检测到 openspec/ 时）
 */
export type IntentType =
  | "simple"
  | "medium"
  | "refactor"
  | "new"
  | "architecture"
  | "research"
  | "collaboration"
  | "spec-driven"

/**
 * 分类结果
 *
 * @property intent     - 识别出的意图
 * @property confidence - 置信度 0-1（正则默认 0.8+，降级默认 0.3）
 * @property reason     - 分类依据（人类可读，用于调试和 TUI 展示）
 */
export interface IntentClassification {
  intent: IntentType
  confidence: number
  reason: string
}

/**
 * 各意图的执行策略配置
 *
 * 策略绑定表（对应论文 I-08 的策略矩阵）：
 * - requiresClarification: 开始执行前是否需要用户确认/面谈
 * - planGranularity: Plan 粒度（none/coarse/medium/fine）
 * - reviewStrictness: 审查严格度
 * - checkpointFrequency: Checkpoint 频率（控制免疫系统触发频率）
 * - reasoningEffort: 对应模块四的 reasoning_effort
 * - interviewDepth: 面谈深度
 */
export interface IntentStrategy {
  requiresClarification: boolean
  planGranularity: "none" | "coarse" | "medium" | "fine"
  reviewStrictness: "none" | "low" | "medium" | "high" | "max"
  checkpointFrequency: "none" | "low" | "medium" | "high"
  reasoningEffort: "none" | "low" | "high" | "max"
  interviewDepth: "none" | "brief" | "standard" | "deep"
}

// ============================================================
// 策略绑定表（核心配置）
// ============================================================

/**
 * 8 种意图 → 执行策略的映射表
 *
 * 这是模块五最重要的配置：决定了每种任务"怎么执行"
 */
const STRATEGY_TABLE: Record<IntentType, IntentStrategy> = {
  simple: {
    requiresClarification: false, // 简单任务不问，直接做
    planGranularity: "none",       // 不需要计划
    reviewStrictness: "none",      // 不需要审查
    checkpointFrequency: "none",   // 不触发 checkpoint
    reasoningEffort: "low",        // 浅度推理
    interviewDepth: "none",        // 无面谈
  },
  medium: {
    requiresClarification: true,   // 简单确认
    planGranularity: "medium",     // 中等粒度计划（3-5步）
    reviewStrictness: "medium",
    checkpointFrequency: "medium",
    reasoningEffort: "high",
    interviewDepth: "brief",
  },
  refactor: {
    requiresClarification: true,
    planGranularity: "fine",       // 细粒度（5-10步），重构风险高
    reviewStrictness: "high",      // 严格审查
    checkpointFrequency: "high",   // 每步 checkpoint
    reasoningEffort: "high",
    interviewDepth: "standard",
  },
  new: {
    requiresClarification: true,
    planGranularity: "fine",       // 完整计划
    reviewStrictness: "medium",
    checkpointFrequency: "medium",
    reasoningEffort: "high",
    interviewDepth: "deep",        // 深度需求澄清
  },
  architecture: {
    requiresClarification: true,
    planGranularity: "coarse",     // 粗粒度模块级计划
    reviewStrictness: "max",       // 最严格审查（架构决策影响大）
    checkpointFrequency: "high",
    reasoningEffort: "max",        // 最大推理深度
    interviewDepth: "deep",
  },
  research: {
    requiresClarification: true,
    planGranularity: "none",       // 探索性，不预设计划
    reviewStrictness: "low",       // 调研报告无需代码审查
    checkpointFrequency: "low",
    reasoningEffort: "high",
    interviewDepth: "brief",
  },
  collaboration: {
    requiresClarification: true,
    planGranularity: "medium",
    reviewStrictness: "high",
    checkpointFrequency: "medium",
    reasoningEffort: "high",
    interviewDepth: "standard",
  },
  "spec-driven": {
    requiresClarification: false,  // Spec 流程已有自己的澄清机制
    planGranularity: "fine",       // 按 change/tasks 执行
    reviewStrictness: "high",
    checkpointFrequency: "high",
    reasoningEffort: "high",
    interviewDepth: "standard",
  },
}

/**
 * Code-based 快速分类规则
 *
 * 顺序很重要：更具体的规则放前面。
 * research 放在 architecture 前面是因为"调研...对比"中的"对比"
 * 容易被 architecture 的"对比"误匹配——修复：收紧 architecture 模式。
 *
 * confidence 含义：
 * - 0.9: 极高置信度（明确关键词如"排序"、"typo"）
 * - 0.85: 高置信度（明确动词如"重构"、"新建"）
 * - 0.8: 中等置信度（"调研"、"设计"）
 * - 0.6: 低置信度（模糊词如"添加"、"修复"，可能是多种意图）
 */
const CODE_RULES: Array<{
  pattern: RegExp
  intent: IntentType
  confidence: number
}> = [
  // Simple：极高置信度的机械任务
  { pattern: /(?:排序|sort|typo|格式化|format|整理import|fix.{0,10}error|修个?小)/i, intent: "simple", confidence: 0.9 },
  // Research：调研类（放前面避免被 architecture 截胡）
  { pattern: /(?:调研|research|研究|了解)/i, intent: "research", confidence: 0.8 },
  // Refactor：重构类
  { pattern: /(?:重构|refactor|重写|rewrite|改造|重新设计)/i, intent: "refactor", confidence: 0.85 },
  // New：从零创建
  { pattern: /(?:从零|从0|新建|create.{0,5}from.{0,5}scratch|搭建|初始化项目|new project)/i, intent: "new", confidence: 0.85 },
  // Architecture：架构设计（收紧模式避免误匹配"对比"）
  { pattern: /(?:设计.{0,5}架构|架构设计|技术选型|architecture|技术方案)/i, intent: "architecture", confidence: 0.8 },
  // Medium：通用添加/修复（置信度低，可被 LLM 覆盖）
  { pattern: /(?:添加|add|新增|实现|implement|修[理改]?|fix|bug)/i, intent: "medium", confidence: 0.6 },
]

// ============================================================
// 服务接口
// ============================================================

export interface Interface {
  /**
   * 分类用户输入
   *
   * @param message     - 用户消息文本
   * @param hasOpenSpec - 工作目录是否包含 openspec/ 配置
   * @returns 分类结果
   */
  readonly classify: (
    message: string,
    hasOpenSpec?: boolean,
  ) => Effect.Effect<IntentClassification>
  /** 获取某意图的策略配置 */
  readonly getStrategy: (intent: IntentType) => IntentStrategy
  /** 获取当前会话的已确认意图（可能被 LLM 覆盖） */
  readonly getCurrent: () => Effect.Effect<IntentClassification | undefined>
  /**
   * 设置当前意图（LLM 高置信度分类后调用，覆盖 code 规则）
   *
   * @param classification - 新的分类结果
   */
  readonly setCurrent: (classification: IntentClassification) => Effect.Effect<void>
}

/** DI token */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeIntentRouter",
) {}

// ============================================================
// 分类逻辑（纯函数）
// ============================================================

/**
 * 执行 Code-based 快速分类
 *
 * @param message - 用户消息
 * @returns 匹配结果或 null（无规则匹配）
 */
function codeClassify(message: string): IntentClassification | null {
  for (const rule of CODE_RULES) {
    if (rule.pattern.test(message)) {
      return {
        intent: rule.intent,
        confidence: rule.confidence,
        reason: `Code rule matched: ${rule.pattern.source}`,
      }
    }
  }
  return null
}

// ============================================================
// Layer 实现
// ============================================================

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 存储当前会话的已确认意图（undefined = 未分类）
    const current = yield* Ref.make<IntentClassification | undefined>(undefined)

    return Service.of({
      /**
       * classify：执行分类
       *
       * 流程：
       * 1. 如果 hasOpenSpec → 直接返回 spec-driven
       * 2. Code-based 规则匹配
       * 3. 高置信度（>=0.8）直接返回
       * 4. 低置信度/无匹配 → 默认 medium
       */
      classify: Effect.fn("DeepCodeIntentRouter.classify")(
        (message: string, hasOpenSpec?: boolean) =>
          Effect.sync(() => {
            // Spec-Driven 优先级最高（OpenSpec 存在时走协议流程）
            if (hasOpenSpec) {
              return {
                intent: "spec-driven" as IntentType,
                confidence: 1.0,
                reason: "OpenSpec configuration detected in workspace",
              }
            }

            // Code-based 快速匹配
            const codeResult = codeClassify(message)
            if (codeResult && codeResult.confidence >= 0.8) {
              return codeResult
            }

            // 低置信度 code 结果或无匹配 → 返回
            if (codeResult) return codeResult

            // 默认降级到 medium（保守策略）
            return {
              intent: "medium" as IntentType,
              confidence: 0.3,
              reason: "No specific pattern matched, defaulting to medium",
            }
          }),
      ),

      /** getStrategy：查询策略表 */
      getStrategy: (intent: IntentType) => STRATEGY_TABLE[intent],

      /** getCurrent：读取 Ref */
      getCurrent: () => Ref.get(current),

      /** setCurrent：写入 Ref */
      setCurrent: (classification: IntentClassification) => Ref.set(current, classification),
    })
  }),
)

/** LocationNode 导出 */
export const node = makeLocationNode({
  name: "deepcode-intent-router",
  layer,
  deps: [],
})
