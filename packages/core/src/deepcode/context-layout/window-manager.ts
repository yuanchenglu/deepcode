/**
 * DeepCode Harness — 滑动窗口对齐 + Token 预算管理
 *
 * 模块八：基于 V4 sliding_window=128 的上下文布局感知与 Token 预算追踪
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * DeepSeek V4 的混合注意力架构（CSA + HCA + MQA）决定了并非所有上下文中的
 * token 都享有同等的注意力密度：
 *
 * 1. **滑动窗口区**（最后 128 tokens）：sliding_window=128
 *    → 全密度 MQA 注意力，每个 token 都 attend 到窗口内所有其他 token
 *    → 这是模型"看得最清楚"的区域
 *
 * 2. **Anchor 区**（约 128-512 tokens for Flash, 128-1024 for Pro）：
 *    → CSA 4x 压缩路径 + Indexer learned scoring 选择 top-k 位置
 *    → Flash index_topk=512，Pro index_topk=1024
 *    → 结构化的锚点内容（checkpoint、decision）容易被检索到
 *
 * 3. **压缩历史区**（512/1024 tokens 以外）：
 *    → HCA 128x 重度压缩，信息密度极低
 *    → 几乎不可被有效注意到，仅保留粗粒度语义
 *
 * 关键推论：1M context ≠ 所有 token 同等可见。当前目标/约束/下一步指令
 * 必须物理上位于尾部窗口内，否则模型只能通过模糊的压缩路径感知它们。
 *
 * 对应约束：C-002（Layout-driven Context）
 *
 * ============================================================
 * 策略
 * ============================================================
 *
 * 本模块提供三类核心能力：
 *
 * 1. **Token 预算分区**：定义四区预算并追踪当前占用
 *    - Stable Prefix Zone: 稳定前缀（byte-stable，受 cache 保护）
 *    - Anchor Zone: 锚点区（checkpoint/decision/hard-constraint 摘要）
 *    - Active Working Set: 当前活跃工作集（当前操作/文件/目标）
 *    - Compressed History: 压缩历史（原始对话/工具输出的压缩摘要）
 *
 * 2. **窗口位置感知**：根据当前 token 位置判断各区与滑动窗口的关系
 *    - 输出预算建议：确保模型输出后关键指令仍在 128 窗口内
 *    - 压缩触发：历史超过阈值建议压缩为 checkpoint
 *
 * 3. **模型差异配置**：Flash/Pro 的不同 index_topk 导致不同预算
 *    - Flash: active budget ≈ 400 tokens（512 index_topk - 128 window）
 *    - Pro: active budget ≈ 900 tokens（1024 index_topk - 128 window）
 *
 * Token 估算策略（不依赖 tokenizer，快速启发式）：
 * - 英文：~4 chars/token
 * - 中文：~1.5 chars/token
 * - 代码：~3-5 chars/token
 * 本模块使用保守的 3 chars/token 估算，避免低估导致溢出。
 *
 * @module
 */

// ============================================================
// 外部依赖
// ============================================================
import { Context, Effect, Layer, Ref } from "effect"
import { makeLocationNode } from "../../effect/app-node"

// ============================================================
// 常量与配置
// ============================================================

/**
 * V4 滑动窗口大小（tokens）
 *
 * 所有四个变体（Flash/Flash-Base/Pro/Pro-Base）config.json 实测 sliding_window=128。
 * 这是全密度局部注意力的窗口大小。
 */
export const SLIDING_WINDOW_SIZE = 128

/**
 * Indexer top-k 预算
 *
 * Flash 系列 index_topk=512，Pro 系列 index_topk=1024。
 * 这决定了 CSA 路径上可被检索的最大压缩位置数。
 */
export const INDEX_TOPK_FLASH = 512
export const INDEX_TOPK_PRO = 1024

/**
 * Token 估算比率：字符/token（保守估计）
 *
 * 中文约 1.5 chars/token，英文约 4 chars/token，代码约 3-5 chars/token。
 * 使用 3.0 作为保守估计，确保预算不超支。
 */
const CHARS_PER_TOKEN_CONSERVATIVE = 3.0

/**
 * 上下文区域定义
 */
export type ContextZone = "prefix" | "anchor" | "active" | "compressed" | "tail"

/**
 * Token 预算配置（按模型档位）
 *
 * 预算逻辑：
 * - prefix: 不限制（稳定前缀由 cache 保护，不占用运行时注意力预算）
 * - anchor: index_topk - sliding_window 留给 anchor 和 active
 * - active: 约 60% 的非窗口预算给当前工作集
 * - compressed: 剩余空间，超出建议压缩
 * - tail: 滑动窗口大小，预留给模型输出和最新交互
 */
export interface BudgetConfig {
  /** Anchor 区最大 token 数 */
  anchorMaxTokens: number
  /** Active 工作集最大 token 数 */
  activeMaxTokens: number
  /** Compressed 历史区建议 token 数上限 */
  compressedSoftLimit: number
  /** 留给模型输出的预分配 token 数（从 tail 区扣除） */
  outputReserveTokens: number
}

/** Flash 档位预算配置 */
const FLASH_BUDGET: BudgetConfig = {
  anchorMaxTokens: 128,
  activeMaxTokens: 256, // ~60% of (512-128)
  compressedSoftLimit: 512,
  outputReserveTokens: 64, // 预留 64 tokens 给输出，确保指令不被挤出窗口
}

/** Pro 档位预算配置 */
const PRO_BUDGET: BudgetConfig = {
  anchorMaxTokens: 256,
  activeMaxTokens: 640, // ~60% of (1024-128) ≈ 537, 取 640 留余量
  compressedSoftLimit: 1024,
  outputReserveTokens: 128, // Pro 输出更长
}

// ============================================================
// 类型定义
// ============================================================

/**
 * 当前 Token 使用情况快照
 */
export interface TokenSnapshot {
  /** Prefix 区 token 数（稳定前缀） */
  prefixTokens: number
  /** Anchor 区 token 数 */
  anchorTokens: number
  /** Active 工作集 token 数 */
  activeTokens: number
  /** Compressed 历史 token 数 */
  compressedTokens: number
  /** Tail 区已使用 token 数（当前轮交互） */
  tailTokens: number
  /** 估算总 token 数 */
  totalTokens: number
}

/**
 * 窗口状态报告
 */
export interface WindowStatus {
  /** 当前快照 */
  snapshot: TokenSnapshot
  /** 当前模型档位 */
  tier: "flash" | "pro"
  /** 活跃区是否溢出（需要压缩） */
  activeOverflow: boolean
  /** 压缩区是否超过软限制（建议 checkpoint） */
  compressionNeeded: boolean
  /** 建议最大输出 token 数（确保关键内容不滑出窗口） */
  recommendedMaxOutputTokens: number
  /** 滑动窗口内是否已包含硬约束/目标 */
  criticalInWindow: boolean
  /** 预算使用详情 */
  budget: BudgetConfig
}

// ============================================================
// 纯函数工具
// ============================================================

/**
 * 估算文本的 token 数（保守启发式）
 *
 * 使用 CHARS_PER_TOKEN_CONSERVATIVE 进行保守估算。
 * 这是上界估计，确保预算不超支。
 *
 * @param text - 待估算的文本
 * @returns 估算的 token 数（向上取整）
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN_CONSERVATIVE)
}

/**
 * 根据模型档位获取预算配置
 *
 * @param tier - 模型档位
 * @returns 对应的预算配置
 */
export function getBudgetForTier(tier: "flash" | "pro"): BudgetConfig {
  return tier === "pro" ? PRO_BUDGET : FLASH_BUDGET
}

/**
 * 计算建议的最大输出 token 数
 *
 * 逻辑：sliding_window - tail_used - reserve = 可用输出空间
 * 确保输出后，当前轮的关键指令（目标、约束、下一步）仍然在
 * 滑动窗口内被全密度注意力覆盖。
 *
 * @param tailTokens - 当前 tail 区已使用 token 数
 * @param reserve - 预留 token 数
 * @returns 建议的最大输出 token 数（最小 16）
 */
export function recommendMaxOutput(tailTokens: number, reserve: number): number {
  const available = SLIDING_WINDOW_SIZE - tailTokens - reserve
  return Math.max(16, available)
}

// ============================================================
// 服务接口
// ============================================================

export interface Interface {
  /**
   * 更新某区域的 token 计数
   *
   * @param zone - 上下文区域
   * @param tokens - 该区域的 token 数
   */
  readonly setZoneTokens: (zone: ContextZone, tokens: number) => Effect.Effect<void>

  /**
   * 按文本内容更新某区域（内部估算 token 数）
   *
   * @param zone - 上下文区域
   * @param text - 该区域的文本内容
   */
  readonly setZoneText: (zone: ContextZone, text: string) => Effect.Effect<void>

  /**
   * 增量添加 token 到某区域
   *
   * @param zone - 上下文区域
   * @param additionalTokens - 新增的 token 数
   */
  readonly addTokens: (zone: ContextZone, additionalTokens: number) => Effect.Effect<void>

  /**
   * 获取当前 token 快照
   */
  readonly getSnapshot: () => Effect.Effect<TokenSnapshot>

  /**
   * 获取完整窗口状态报告（含溢出检测和建议）
   *
   * @param tier - 当前模型档位
   */
  readonly getWindowStatus: (tier: "flash" | "pro") => Effect.Effect<WindowStatus>

  /**
   * 重置所有计数（新会话或 checkpoint 压缩后调用）
   */
  readonly reset: () => Effect.Effect<void>

  /**
   * 压缩历史区（checkpoint 后将 active 内容合并到 anchor，清空 active）
   *
   * @param keepInAnchor - 保留在 anchor 区的 checkpoint 摘要 token 数
   */
  readonly compressHistory: (keepInAnchor: number) => Effect.Effect<void>
}

/** DI token */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeWindowManager",
) {}

// ============================================================
// Layer 实现
// ============================================================

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 五个区域的 token 计数（fiber-safe 原子引用）
    const prefixTokens = yield* Ref.make(0)
    const anchorTokens = yield* Ref.make(0)
    const activeTokens = yield* Ref.make(0)
    const compressedTokens = yield* Ref.make(0)
    const tailTokens = yield* Ref.make(0)

    /** 读取所有区域值，构建快照 */
    const readSnapshot = Effect.fn("DeepCodeWindowManager.readSnapshot")(() =>
      Effect.gen(function* () {
        const p = yield* Ref.get(prefixTokens)
        const a = yield* Ref.get(anchorTokens)
        const ac = yield* Ref.get(activeTokens)
        const c = yield* Ref.get(compressedTokens)
        const t = yield* Ref.get(tailTokens)
        return {
          prefixTokens: p,
          anchorTokens: a,
          activeTokens: ac,
          compressedTokens: c,
          tailTokens: t,
          totalTokens: p + a + ac + c + t,
        } satisfies TokenSnapshot
      }),
    )

    return Service.of({
      setZoneTokens: Effect.fn("DeepCodeWindowManager.setZoneTokens")(
        (zone: ContextZone, tokens: number) => {
          const ref = {
            prefix: prefixTokens,
            anchor: anchorTokens,
            active: activeTokens,
            compressed: compressedTokens,
            tail: tailTokens,
          }[zone]
          return Ref.set(ref, Math.max(0, tokens))
        },
      ),

      setZoneText: Effect.fn("DeepCodeWindowManager.setZoneText")(
        (zone: ContextZone, text: string) => {
          const tokens = estimateTokens(text)
          const ref = {
            prefix: prefixTokens,
            anchor: anchorTokens,
            active: activeTokens,
            compressed: compressedTokens,
            tail: tailTokens,
          }[zone]
          return Ref.set(ref, tokens)
        },
      ),

      addTokens: Effect.fn("DeepCodeWindowManager.addTokens")(
        (zone: ContextZone, additionalTokens: number) => {
          const ref = {
            prefix: prefixTokens,
            anchor: anchorTokens,
            active: activeTokens,
            compressed: compressedTokens,
            tail: tailTokens,
          }[zone]
          return Ref.update(ref, (n) => Math.max(0, n + additionalTokens))
        },
      ),

      getSnapshot: readSnapshot,

      getWindowStatus: Effect.fn("DeepCodeWindowManager.getWindowStatus")(
        (tier: "flash" | "pro") =>
          Effect.gen(function* () {
            const snap = yield* readSnapshot()
            const budget = getBudgetForTier(tier)

            // 活跃区溢出检测
            const activeOverflow = snap.activeTokens > budget.activeMaxTokens

            // 压缩区超软限制检测
            const compressionNeeded = snap.compressedTokens > budget.compressedSoftLimit

            // 建议最大输出 token 数
            const recommendedMaxOutputTokens = recommendMaxOutput(
              snap.tailTokens,
              budget.outputReserveTokens,
            )

            // 关键内容（硬约束/目标）是否在窗口内：
            // 如果 tail + active 的尾部 128 tokens 包含非零内容则视为在窗口内
            // 简化判断：tailTokens > 0 表示当前轮有交互内容在窗口内
            const criticalInWindow = snap.tailTokens > 0 || snap.activeTokens <= SLIDING_WINDOW_SIZE

            return {
              snapshot: snap,
              tier,
              activeOverflow,
              compressionNeeded,
              recommendedMaxOutputTokens,
              criticalInWindow,
              budget,
            } satisfies WindowStatus
          }),
      ),

      reset: Effect.fn("DeepCodeWindowManager.reset")(() =>
        Effect.gen(function* () {
          yield* Ref.set(prefixTokens, 0)
          yield* Ref.set(anchorTokens, 0)
          yield* Ref.set(activeTokens, 0)
          yield* Ref.set(compressedTokens, 0)
          yield* Ref.set(tailTokens, 0)
        }),
      ),

      compressHistory: Effect.fn("DeepCodeWindowManager.compressHistory")(
        (keepInAnchor: number) =>
          Effect.gen(function* () {
            // checkpoint 压缩策略：
            // 1. active 区内容已转化为 checkpoint 摘要（keepInAnchor tokens）
            // 2. 将原 active 内容移到 compressed 区（追加历史）
            // 3. anchor 区更新为新的 checkpoint 摘要
            // 4. active 区清空（等待新工作集填入）
            const currentActive = yield* Ref.get(activeTokens)
            yield* Ref.update(compressedTokens, (n) => n + currentActive)
            yield* Ref.set(anchorTokens, keepInAnchor)
            yield* Ref.set(activeTokens, 0)
            // tail 区不清空：当前轮交互仍在窗口内
          }),
      ),
    })
  }),
)

// ============================================================
// LocationNode 导出
// ============================================================

/**
 * LocationNode 定义，用于集成到 location-services.ts
 *
 * 此模块无外部依赖（纯内存 Ref 状态管理），可被其他 DeepCode 模块注入使用。
 * 典型消费方：
 * - SessionRunnerLLM: 在每轮前查询 getWindowStatus() 决定 max_output_tokens
 * - Reasoning Manager: 在 reasoning 累积超限时调用 compressHistory()
 * - Model Router: 路由到 Pro 时切换到 PRO_BUDGET
 */
export const node = makeLocationNode({
  name: "deepcode-window-manager",
  layer,
  deps: [],
})
