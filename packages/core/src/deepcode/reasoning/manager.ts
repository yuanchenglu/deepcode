/**
 * DeepCode Harness — Reasoning Content 管理
 *
 * 模块四：DeepSeek V4 Thinking/Reasoning 内容的生命周期管理
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * DeepSeek V4 支持 Thinking Mode：
 * - reasoning_effort: none/low/high/max 控制推理深度
 * - 模型在 tool_call 之间返回 <think>...</think>（reasoning_content）
 * - API 要求：工具调用轮次中必须回传 reasoning_content 才能维持思考连续性
 *
 * 问题：reasoning_content 可能数千 token，长期回灌到上下文中：
 * 1. 浪费 token（模型不需要重读所有历史思考）
 * 2. 注意力稀释（CSA/HCA 压缩后远端 reasoning 几乎不被注意）
 * 3. 冗余信息（最终决策已经反映在 tool_call 选择中）
 *
 * 论文 I-14（Reasoning Content Stripping）核心原则：
 * "reasoning-not-memory" — reasoning 用于 display/archive，不作为长期记忆回灌
 *
 * ============================================================
 * 策略
 * ============================================================
 *
 * 三阶段生命周期：
 *
 * 1. 当前工具调用轮次（Turn N, turnOffset=0）：
 *    - 完整 reasoning_content 回传给 API（维持思考链）
 *    - 完整 reasoning 持久化到 DB（供用户查看/归档）
 *    - 策略：full
 *
 * 2. 下一轮（Turn N+1, turnOffset=1）：
 *    - reasoning 替换为结构化摘要（1-3 句话，~50-80 tokens）
 *    - 摘要格式：[推理摘要] 分析了 X → 决定执行 Y
 *    - 策略：summary
 *
 * 3. 历史轮次（Turn N+2 及以后, turnOffset>=2）：
 *    - reasoning 完全剥离（节省上下文空间）
 *    - 关键决策已在 tool_call/assistant 文本中体现
 *    - 策略：stripped
 *
 * 特殊规则：工具调用轮次且 keepFullForToolCalls=true 时，
 * 即使是历史轮次也保留完整 reasoning（API 协议要求回传）。
 *
 * reasoning_effort 档位分配：
 * - Flash 模型：low（Flash 不擅长深度思考）
 * - Pro + Simple/Medium：high
 * - Pro + Architecture：max
 * - Pro + Refactor/New：high
 *
 * @module
 */

import { Context, Effect, Layer, Ref } from "effect"
import { makeLocationNode } from "../../effect/app-node"

/**
 * reasoning_effort 档位
 * - none: 不启用 thinking（最快，成本最低）
 * - low:  浅度推理（简单任务）
 * - high: 深度推理（大多数复杂任务）
 * - max:  最大推理（架构/审查）
 */
export type ReasoningEffort = "none" | "low" | "high" | "max"

/**
 * Reasoning 管理的三阶段策略
 * - full:     完整保留 reasoning 内容（当前轮）
 * - summary:  替换为结构化摘要（下一轮）
 * - stripped: 完全剥离（历史轮次）
 */
export type ReasoningPolicy = "full" | "summary" | "stripped"

/** Reasoning 管理配置 */
export interface ReasoningConfig {
  /** 是否从历史中剥离 reasoning */
  stripFromHistory: boolean
  /** 摘要最大字符数 */
  maxSummaryChars: number
  /** 工具调用轮次是否保留完整 reasoning */
  keepFullForToolCalls: boolean
}

/**
 * 默认配置常量（供初始化参考和外部覆盖时作为 fallback）
 *
 * 注意：运行时配置存储在 Layer 内的 Ref 中，
 * 通过 setConfig 方法可动态修改（如通过 opencode.json 配置）。
 */
export const DEFAULT_CONFIG: ReasoningConfig = {
  stripFromHistory: true,
  maxSummaryChars: 300,  // ~80 tokens（中文约1.5字/token）
  keepFullForToolCalls: true,
}

/** 服务接口 */
export interface Interface {
  /**
   * 根据意图和模型档位确定 reasoning_effort
   *
   * @param intent - 当前意图类型（undefined = 未分类）
   * @param tier   - 当前模型档位（flash/pro）
   * @returns 推荐的 reasoning_effort
   */
  readonly getEffort: (
    intent: string | undefined,
    tier: "flash" | "pro",
  ) => Effect.Effect<ReasoningEffort>

  /**
   * 获取某条历史消息的 reasoning 处理策略（三阶段）
   *
   * 替代旧版 shouldStrip 的布尔判断，提供更精细的三阶段控制：
   * - turnOffset === 0（当前轮）→ "full"（完整保留）
   * - turnOffset === 1（下一轮）→ "summary"（替换为摘要）
   * - turnOffset >= 2（历史轮）→ "stripped"（完全剥离）
   * - 工具调用轮次且 keepFullForToolCalls → "full"（API 协议要求）
   *
   * @param turnOffset     - 距当前轮的偏移量（0=当前轮）
   * @param isToolCallTurn - 该轮次是否包含工具调用
   * @returns reasoning 处理策略
   */
  readonly getReasoningPolicy: (
    turnOffset: number,
    isToolCallTurn: boolean,
  ) => ReasoningPolicy

  /**
   * 判断某条历史消息的 reasoning 是否应该剥离（兼容方法）
   *
   * 等价于 getReasoningPolicy(...) === "stripped"，
   * 保留供旧调用方使用。
   *
   * @param turnOffset     - 距当前轮的偏移量（0=当前轮）
   * @param isToolCallTurn - 该轮次是否包含工具调用
   * @returns true = 剥离，false = 保留
   */
  readonly shouldStrip: (turnOffset: number, isToolCallTurn: boolean) => boolean

  /**
   * 将完整 reasoning 文本压缩为摘要
   *
   * 策略：提取第一个有意义的句子（分析了什么）和最后一个句子（决定了什么），
   * 控制在 maxSummaryChars 以内。
   *
   * @param reasoningText - 完整 reasoning 文本
   * @returns 摘要文本（空输入返回空字符串）
   */
  readonly summarize: (reasoningText: string) => string

  /**
   * 动态更新 reasoning 配置
   *
   * 使用 Partial 合并，未指定的字段保持原值。
   * 允许运行时通过 opencode.json 等外部配置覆盖默认值。
   *
   * @param partial - 需要更新的配置字段
   */
  readonly setConfig: (partial: Partial<ReasoningConfig>) => Effect.Effect<void>
}

/** DI token */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeReasoningManager",
) {}

/**
 * 生成 reasoning 摘要
 *
 * 启发式策略（纯函数，零 LLM 成本）：
 * 1. 按句子分隔符拆分（。！？.!?\n）
 * 2. 过滤掉过短的句子（<5 字符）
 * 3. 取第一句（初始分析）和最后一句（最终决定）
 * 4. 如果摘要超长则截断加 "..."
 *
 * 为什么不用 LLM 做摘要？
 * - 摘要发生在每轮消息投影时，用 LLM 增加延迟和成本
 * - 简单的首尾句策略已经覆盖"分析了什么→决定了什么"的核心信息
 * - LLM 摘要可作为后续优化（TD 记录）
 *
 * @param text     - 完整 reasoning
 * @param maxChars - 最大字符数
 * @returns 摘要文本
 */
function summarizeReasoning(text: string, maxChars: number = 300): string {
  if (!text || text.length === 0) return ""

  // 按中英文标点和换行拆分句子
  const sentences = text
    .split(/[。！？.!?\n]+/)
    .filter((s) => s.trim().length > 5) // 过滤掉碎片

  if (sentences.length === 0) {
    // 无法拆句时直接截断
    return text.length > maxChars ? text.slice(0, maxChars - 3) + "..." : text
  }

  const first = sentences[0].trim()
  const last = sentences.length > 1 ? sentences[sentences.length - 1].trim() : ""

  // 组合摘要
  let summary = `[推理摘要] ${first}`
  if (last && last !== first) {
    summary += ` → ${last}`
  }

  // 超长截断
  if (summary.length > maxChars) {
    summary = summary.slice(0, maxChars - 3) + "..."
  }
  return summary
}

/** Layer 实现 */
const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 运行时可修改的配置 Ref（替代原来的模块级常量）
    // 初始值为 DEFAULT_CONFIG，可通过 setConfig 动态覆盖
    const configRef = yield* Ref.make<ReasoningConfig>({ ...DEFAULT_CONFIG })
    // 同步缓存：供 getReasoningPolicy/shouldStrip/summarize 等同步方法读取
    // Effect v4 的 Ref 没有 unsafeGet，同步方法无法 yield* Ref.get，
    // 因此用闭包变量缓存当前配置值，setConfig 时同步更新
    let configCache: ReasoningConfig = { ...DEFAULT_CONFIG }

    return Service.of({
      /**
       * getEffort：根据意图和档位推理 effort
       *
       * 决策逻辑：
       * - Flash 模型一律 low：Flash 的参数量决定它不擅长长 chain-of-thought，
       *   开启 high effort 反而增加延迟不增加质量
       * - Pro + architecture = max：架构设计需要最深度推理
       * - Pro + refactor/new/research = high：复杂任务需要深度推理
       * - 其他 Pro = high（默认）
       */
      getEffort: Effect.fn("DeepCodeReasoningManager.getEffort")(
        (intent: string | undefined, tier: "flash" | "pro") =>
          Effect.sync(() => {
            if (tier === "flash") return "low" as const
            switch (intent) {
              case "architecture":
                return "max" as const
              case "refactor":
              case "new":
              case "research":
              default:
                return "high" as const
            }
          }),
      ),

      /**
       * getReasoningPolicy：三阶段 reasoning 处理策略
       *
       * 返回值含义：
       * - "full"     → 完整保留 reasoning（当前轮 / 工具调用轮）
       * - "summary"  → 替换为结构化摘要（下一轮）
       * - "stripped" → 完全剥离（历史轮次）
       *
       * 特殊规则：工具调用轮次且 keepFullForToolCalls=true 时，
       * 即使是历史轮次也返回 "full"（API 协议要求回传 reasoning_content）。
       */
      getReasoningPolicy: (turnOffset: number, isToolCallTurn: boolean) => {
        // 从同步缓存读取配置（getReasoningPolicy 是同步函数）
        const config = configCache
        if (config.keepFullForToolCalls && isToolCallTurn) return "full"
        // 当前轮：完整保留
        if (turnOffset === 0) return "full"
        // 下一轮：替换为摘要
        if (turnOffset === 1) return "summary"
        // 历史轮次：完全剥离
        return "stripped"
      },

      /**
       * shouldStrip：兼容方法，等价于 getReasoningPolicy === "stripped"
       *
       * 保留供旧调用方使用，新代码应直接调用 getReasoningPolicy。
       */
      shouldStrip: (turnOffset: number, isToolCallTurn: boolean) => {
        // 从同步缓存读取配置
        const config = configCache
        // 如果禁用剥离，一律不剥离
        if (!config.stripFromHistory) return false
        // 工具调用轮次且配置保留 → 不剥离
        if (config.keepFullForToolCalls && isToolCallTurn) return false
        // 当前轮和下一轮不剥离（下一轮替换为摘要，不算剥离）
        if (turnOffset <= 1) return false
        // 历史轮次：剥离
        return true
      },

      /** summarize：生成摘要（从缓存读取 maxSummaryChars 配置） */
      summarize: (text: string) => {
        const config = configCache
        return summarizeReasoning(text, config.maxSummaryChars)
      },

      /**
       * setConfig：动态更新配置
       *
       * 使用 Ref.update 合并 partial 配置，未指定的字段保持原值。
       * 同时同步更新 configCache，确保同步方法能读取到最新配置。
       * 允许运行时通过 opencode.json 等外部配置覆盖默认值。
       */
      setConfig: Effect.fn("DeepCodeReasoningManager.setConfig")(
        (partial: Partial<ReasoningConfig>) =>
          Ref.update(configRef, (cfg) => {
            const updated = { ...cfg, ...partial }
            // 同步更新缓存，供 getReasoningPolicy/shouldStrip/summarize 读取
            configCache = updated
            return updated
          }),
      ),
    })
  }),
)

/** LocationNode 导出 */
export const node = makeLocationNode({
  name: "deepcode-reasoning-manager",
  layer,
  deps: [],
})
