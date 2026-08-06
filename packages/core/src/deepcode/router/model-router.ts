/**
 * DeepCode Harness — Flash/Pro 智能路由
 *
 * 模块三：根据任务上下文自动选择 Flash 或 Pro 模型
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * DeepSeek V4 提供两个模型变体（见 docs/stage1/05_DSV4_NOTES.md）：
 *
 * | 参数 | Flash | Pro |
 * |------|-------|-----|
 * | hidden_size | 4096 | 7168 |
 * | 层数 | 43 | 61 |
 * | 专家数 | 256 | 384 |
 * | 速度/成本 | 快/便宜 | 慢/贵 |
 * | 适合场景 | 读取、搜索、小修改 | 架构、复杂重构、审查 |
 *
 * 编码任务约 70-80% 步骤是 Flash 足够应对的（读文件、grep、简单编辑），
 * 剩余 20-30% 需要 Pro 的强推理能力。自动路由可以：
 * 1. 降低 API 成本（70% 调用走便宜的 Flash）
 * 2. 提高响应速度（Flash 推理更快）
 * 3. 不牺牲质量（高风险节点自动升级 Pro）
 *
 * ============================================================
 * 路由决策逻辑
 * ============================================================
 *
 * 优先级从高到低：
 * 1. 用户手动 override（最高优先级，尊重用户选择）
 * 2. Checkpoint 审查、自我审查 → Pro
 * 3. 架构讨论、Plan 制定 → Pro
 * 4. 高风险意图（architecture/refactor）→ Pro
 * 5. 写入高风险文件（*.sql、migrations、config）→ Pro
 * 6. 连续 N 次失败 → Pro（升级重试）
 * 7. 中风险意图（new/collaboration）→ Flash（可升级）
 * 8. 低风险意图（simple/research）→ Flash
 * 9. 写操作 → Flash（中风险但非高风险）
 * 10. 读操作 → Flash
 * 11. 默认 → Flash-first
 *
 * @module
 */

// ============================================================
// 外部依赖
// ============================================================
import { Context, Effect, Layer, Ref } from "effect"
import { makeLocationNode } from "../../effect/app-node"

// ============================================================
// 类型定义
// ============================================================

/**
 * 模型档位
 * - flash: DeepSeek V4 Flash（快/便宜/较小）
 * - pro:   DeepSeek V4 Pro（强/贵/较大）
 */
export type ModelTier = "flash" | "pro"

/**
 * 风险等级 — 用于 route reason 记录和后续分析
 * - low: 简单读取/搜索，Flash 足够
 * - medium: 常规写入，先 Flash 可能升级
 * - high: 关键操作，强制 Pro
 */
export type RiskLevel = "low" | "medium" | "high"

/**
 * 一次路由决策记录
 *
 * 用于：
 * - 事后调试（为什么这次用了 Pro？）
 * - 成本分析（Flash/Pro 占比）
 * - 路由规则优化（哪些规则触发最多）
 *
 * @interface RouteDecision
 * @property id         唯一标识
 * @property turn       会话内的轮次号
 * @property selected   最终选择的档位
 * @property reason     决策原因（人类可读）
 * @property riskLevel  风险等级
 * @property fallbackFrom 如果是升级而来，记录原档位
 * @property timestamp  决策时间戳
 */
export interface RouteDecision {
  id: string
  turn: number
  selected: ModelTier
  reason: string
  riskLevel: RiskLevel
  fallbackFrom?: ModelTier
  timestamp: number
}

/**
 * 路由配置
 *
 * 可通过 deepcode.json 的 deepcode.routing 段覆盖，此处为默认值。
 */
export interface RoutingConfig {
  /** 高风险文件 glob 模式列表，匹配时强制 Pro */
  highRiskPatterns: string[]
  /** 连续失败多少次后升级 Pro */
  failureUpgradeThreshold: number
  /** 是否允许 Flash 失败后自动 fallback 到 Pro */
  autoFallback: boolean
}

/**
 * 默认路由配置
 *
 * highRiskPatterns 选择理由：
 * - *.sql：数据库操作不可逆
 * - migrations/*：数据库迁移
 * - *.secret.*, .env*：密钥/凭证配置
 * - package.json：依赖变更影响整个项目
 * - tsconfig.json：编译配置
 * - Dockerfile*：部署配置
 * - .github/*：CI/CD 流程
 */
const DEFAULT_CONFIG: RoutingConfig = {
  highRiskPatterns: [
    "*.sql",
    "migrations/*",
    "*.secret.*",
    "*.env*",
    "package.json",
    "tsconfig.json",
    "Dockerfile*",
    ".github/*",
  ],
  failureUpgradeThreshold: 2,
  autoFallback: true,
}

/**
 * 路由决策的输入上下文
 *
 * 调用方（SessionRunner）在每个 Provider Turn 前调用 decide()，传入当前轮次的上下文。
 */
export interface RoutingContext {
  /** 当前轮次号（从 0 开始） */
  turn: number
  /** 即将执行的工具名（如果已知，如 "write"/"read"/"shell"） */
  pendingTool?: string
  /** 意图分类结果（simple/refactor/new/...） */
  intent?: string
  /** 待写入的目标文件路径列表 */
  writeTargets?: string[]
  /** 是否是 checkpoint 审查节点 */
  isCheckpoint?: boolean
  /** 是否在做计划/架构讨论 */
  isPlanning?: boolean
}

// ============================================================
// 服务接口
// ============================================================

export interface Interface {
  /**
   * 根据上下文决定本轮使用 Flash 还是 Pro
   *
   * @param context - 当前轮次的上下文信息
   * @returns 选择的模型档位（"flash" | "pro"）
   */
  readonly decide: (context: RoutingContext) => Effect.Effect<ModelTier>
  /** 记录一次工具调用失败（用于失败计数升级） */
  readonly recordFailure: () => Effect.Effect<void>
  /** 获取完整路由历史 */
  readonly getHistory: () => Effect.Effect<RouteDecision[]>
  /**
   * 用户手动指定档位（override）
   *
   * 调用后所有轮次使用指定档位，直到 clearOverride()
   */
  readonly setOverride: (tier: ModelTier) => Effect.Effect<void>
  /** 清除手动 override，恢复自动路由 */
  readonly clearOverride: () => Effect.Effect<void>
}

/** DI token — 其他模块用 yield* DeepCodeModelRouter.Service 注入 */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeModelRouter",
) {}

// ============================================================
// 路由核心逻辑（纯函数）
// ============================================================

/**
 * 判断文件路径是否匹配高风险模式
 *
 * 简化 glob 匹配（不用完整 glob 库，覆盖 90% 场景）：
 * - pattern 以 "*." 开头 → 文件扩展名匹配
 * - pattern 以 "*斜杠" 结尾（如 "migrations/*"）→ 路径包含该目录
 * - 其他 → 子串包含匹配
 *
 * @param path - 待检查的文件路径
 * @param patterns - 高风险模式列表
 * @returns 是否命中高风险模式
 */
function isHighRiskFile(path: string, patterns: string[]): boolean {
  const pathLower = path.toLowerCase()
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      // migrations/* → 检查路径是否包含 "migrations/"
      const prefix = pattern.slice(0, -2)
      if (pathLower.includes(prefix)) return true
    } else if (pattern.startsWith("*.")) {
      // *.sql → 检查后缀
      const ext = pattern.slice(1) // ".sql"
      if (pathLower.endsWith(ext)) return true
    } else if (pathLower.includes(pattern.toLowerCase())) {
      return true
    }
  }
  return false
}

/** 生成路由决策 ID */
function generateId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 核心路由决策逻辑（纯函数，可单元测试）
 *
 * 按优先级检查规则，第一个匹配的规则决定结果。
 * 这种 if-else 顺序直观、可读、易调试。
 *
 * @param ctx       - 当前轮次上下文
 * @param failures  - 连续失败次数
 * @param config    - 路由配置
 * @param override  - 用户手动 override（如果有）
 * @returns 路由结果（档位 + 原因 + 风险等级）
 */
function decideRoute(
  ctx: RoutingContext,
  failures: number,
  config: RoutingConfig,
  override?: ModelTier,
): {
  tier: ModelTier
  reason: string
  risk: RiskLevel
  fallbackFrom?: ModelTier
} {
  // 规则 1：用户手动 override 优先级最高
  if (override) {
    return { tier: override, reason: `User override: ${override}`, risk: "medium" }
  }

  // 规则 2：Checkpoint / 审查节点 → Pro
  if (ctx.isCheckpoint) {
    return {
      tier: "pro",
      reason: "Checkpoint/review requires Pro for thorough analysis",
      risk: "high",
    }
  }

  // 规则 3：Plan / 架构讨论 → Pro
  if (ctx.isPlanning) {
    return {
      tier: "pro",
      reason: "Planning/architecture discussion requires Pro",
      risk: "high",
    }
  }

  // 规则 4：高风险意图 → Pro
  if (ctx.intent === "architecture" || ctx.intent === "refactor") {
    return {
      tier: "pro",
      reason: `Intent '${ctx.intent}' is high-complexity, routing to Pro`,
      risk: "high",
    }
  }

  // 规则 5：写入高风险文件 → Pro
  if (ctx.writeTargets?.some((p) => isHighRiskFile(p, config.highRiskPatterns))) {
    return {
      tier: "pro",
      reason: "Writing to high-risk file pattern, routing to Pro",
      risk: "high",
    }
  }

  // 规则 6：连续失败升级
  // Magic number: failureUpgradeThreshold 默认 2
  // 理由：1 次失败可能是偶然（网络/临时问题），2 次连续失败大概率是能力不足
  if (failures >= config.failureUpgradeThreshold) {
    return {
      tier: "pro",
      reason: `${failures} consecutive failures, upgrading to Pro for retry`,
      risk: "high",
      fallbackFrom: "flash",
    }
  }

  // 规则 7：中风险意图 → 先 Flash（允许后续升级）
  if (ctx.intent === "new" || ctx.intent === "collaboration") {
    return {
      tier: "flash",
      reason: `Intent '${ctx.intent}', starting with Flash (may upgrade)`,
      risk: "medium",
    }
  }

  // 规则 8：低风险意图 → Flash
  if (ctx.intent === "simple" || ctx.intent === "research") {
    return {
      tier: "flash",
      reason: `Intent '${ctx.intent}' is low-complexity, using Flash`,
      risk: "low",
    }
  }

  // 规则 9：写操作 → 先 Flash（中风险）
  if (
    ctx.pendingTool === "write" ||
    ctx.pendingTool === "edit" ||
    ctx.pendingTool === "apply_patch"
  ) {
    return { tier: "flash", reason: "File modification, starting with Flash", risk: "medium" }
  }

  // 规则 10：读操作 → Flash（低风险）
  if (
    ctx.pendingTool === "read" ||
    ctx.pendingTool === "glob" ||
    ctx.pendingTool === "grep" ||
    ctx.pendingTool === "websearch"
  ) {
    return { tier: "flash", reason: `Read-only tool '${ctx.pendingTool}', using Flash`, risk: "low" }
  }

  // 规则 11：默认 → Flash-first
  return { tier: "flash", reason: "Default: Flash-first policy", risk: "low" }
}

// ============================================================
// Layer 实现
// ============================================================

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 三个 Ref 维护路由状态：
    // failureCount: 连续失败次数（工具调用失败时+1，成功时重置）
    const failureCount = yield* Ref.make(0)
    // history: 完整路由决策记录
    const history = yield* Ref.make<RouteDecision[]>([])
    // override: 用户手动指定的档位（undefined = 自动路由）
    const override = yield* Ref.make<ModelTier | undefined>(undefined)
    const config = DEFAULT_CONFIG

    return Service.of({
      /**
       * decide: 执行路由决策并记录
       *
       * 流程：
       * 1. 读取当前 failures 和 override
       * 2. 调用纯函数 decideRoute
       * 3. 构造 RouteDecision 记录
       * 4. 追加到 history
       * 5. 返回 tier
       */
      decide: Effect.fn("DeepCodeModelRouter.decide")((ctx: RoutingContext) =>
        Effect.gen(function* () {
          const failures = yield* Ref.get(failureCount)
          const ov = yield* Ref.get(override)
          const decision = decideRoute(ctx, failures, config, ov)

          const record: RouteDecision = {
            id: generateId(),
            turn: ctx.turn,
            selected: decision.tier,
            reason: decision.reason,
            riskLevel: decision.risk,
            fallbackFrom: decision.fallbackFrom,
            timestamp: Date.now(),
          }

          yield* Ref.update(history, (h) => [...h, record])
          return decision.tier
        }),
      ),

      /** recordFailure: 失败计数 +1（失败计数用于规则 6 的升级） */
      recordFailure: Effect.fn("DeepCodeModelRouter.recordFailure")(() =>
        Ref.update(failureCount, (n) => n + 1),
      ),

      /** getHistory: 返回路由历史副本 */
      getHistory: Effect.fn("DeepCodeModelRouter.getHistory")(() => Ref.get(history)),

      /** setOverride: 设置用户 override */
      setOverride: Effect.fn("DeepCodeModelRouter.setOverride")((tier: ModelTier) =>
        Ref.set(override, tier),
      ),

      /** clearOverride: 清除 override，恢复自动路由 */
      clearOverride: Effect.fn("DeepCodeModelRouter.clearOverride")(() => Ref.set(override, undefined)),
    })
  }),
)

/** LocationNode 导出 */
export const node = makeLocationNode({
  name: "deepcode-model-router",
  layer,
  deps: [],
})
