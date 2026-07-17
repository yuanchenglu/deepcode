/**
 * =============================================================================
 *                           Scope Creep 防护模块
 *                          （论文编号：I-08 范围蔓延防护）
 * =============================================================================
 *
 * 【设计者视角 Design Perspective】
 * 本模块解决 Coding Agent 的核心行为缺陷：范围蔓延（Scope Creep）。
 *
 * 根因分析：
 * - LLM 在"乐于助人"的训练目标下，缺乏显式的"当前修改边界"概念。
 * - 当模型在长上下文中看到相邻代码的其他问题时，会自发产生"既然都在改X了顺便把Y也改了"
 *   的冲动，导致任务时间膨胀、最终偏离用户原始需求。
 * - 这不是 bug，而是 RLHF/指令微调 的副产品——模型被训练为尽可能多地解决可见问题，
 *   而非严格限定在当前任务范围内。
 *
 * 设计方案：两层分治策略
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ 1. 需求层 Scope 防护                                                      │
 * │    - 检测模式：识别模型输出中的"顺便""也可以""还应该"等扩展信号词            │
 * │    - 响应策略：通过 Question 工具反向追问用户，而非直接执行扩展操作          │
 * │ 2. 技术层 必要依赖分类                                                    │
 * │    - 必要依赖（required）：当前 step 的 acceptance criteria 无法完成，必须改 │
 * │      → 自动纳入计划，无需额外确认                                          │
 * │    - 可选优化（optional）：改善代码质量但不影响验收                          │
 * │      → 默认不做，需用户明确确认                                            │
 * │    - 无关问题（unrelated）：发现的其他独立问题                              │
 * │      → 记录到 deferredFindings，任务结束时统一报告                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 工程化机制：
 * - Tool Guard 拦截：每次 write/edit/patch 工具调用前，检查目标文件是否在已批准范围内
 * - 范围边界维护：记录当前计划允许修改的文件列表（plan 创建时确定，cascade 时更新）
 * - 超范围检测：模型尝试修改未批准文件时，触发分类+用户确认流程
 * - 顺手改检测：在 review tier>=2 时，扫描模型输出文本中的 scope creep 信号词
 *
 * 【使用者视角 Usage Perspective】
 * - 在 plan 创建完成后，调用 setInitialScope() 设置初始允许修改的文件范围
 * - 在 write/edit/patch/apply_patch 等写工具执行前，调用 checkToolAccess() 做 guard 检查
 * - 当 checkToolAccess 返回 needsApproval=true 时，调用 classifyDependency() 进行分类
 * - 在 tier>=2 review 阶段，调用 detectScopeCreepSignals() 扫描消息文本
 * - 任务结束时，调用 getDeferredFindings() 获取"发现但未处理"的问题列表并报告给用户
 * - 需要重置状态时（如新任务开始），调用 reset()
 *
 * 【维护者视角 Maintenance Perspective】
 * - 本模块是纯 Effect 服务，无外部 IO 依赖，状态全部存储在 Ref 中，易于测试
 * - glob 匹配逻辑（isPathAllowed）故意保持简单，避免引入 minimatch 等重依赖
 * - 如需扩展信号词检测，修改 detectScopeCreepSignals 中的 signalPatterns 数组即可
 * - violation 记录用于审计和调优，可据此优化初始 scope 推断逻辑
 * - 注意：readonlyFiles 语义是"允许读但默认不允许写"，触发时仍走必要依赖分类流程
 */

// ─────────────────────────────────────────────────────────────────────────────
// 依赖导入
// ─────────────────────────────────────────────────────────────────────────────

// Effect 框架核心：Context（DI token）、Effect（效应管理）、Layer（依赖注入）、Ref（可变状态）
import { Context, Effect, Layer, Ref } from "effect"
// 应用节点构造器：将本服务注册为 DeepCode 管线中的一个可定位节点
import { makeLocationNode } from "../effect/app-node"

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 依赖分类枚举
 * 用于对模型发现的"计划外工作"进行三分类处理
 */
export type DependencyType =
  | "required"   // 必要依赖：不修改则当前步骤无法完成验收，自动纳入范围
  | "optional"   // 可选优化：改善质量但不影响验收，需用户确认
  | "unrelated"  // 无关问题：与当前任务无关，记录但不处理

/**
 * 已批准的修改范围
 * 记录当前任务计划中允许访问和修改的文件边界
 */
export interface ApprovedScope {
  /**
   * 允许修改的文件 glob 模式列表
   * 例如：["src/core/*.ts", "packages/utils/src/"]
   * 匹配规则见 isPathAllowed 方法
   */
  readonly allowedFiles: readonly string[]

  /**
   * 允许读取但默认不允许修改的文件 glob 模式列表
   * 例如配置文件、类型定义文件等——模型可以读取参考，但修改需走必要依赖分类
   */
  readonly readonlyFiles: readonly string[]

  /**
   * 已获用户批准的可选优化路径列表
   * 当 classifyDependency 收到 type=optional 且 userApproved=true 时，路径加入此列表
   * 后续对这些路径的写操作将被允许
   */
  readonly approvedOptionals: readonly string[]

  /**
   * 已发现但延迟处理的无关问题列表
   * 这些问题在当前任务中不修复，任务结束时统一报告给用户
   */
  readonly deferredFindings: readonly {
    /** 问题描述 */
    description: string
    /** 问题位置（文件路径或代码位置） */
    location: string
    /** 严重程度：low=建议, medium=应修复, high=必须修复 */
    severity: "low" | "medium" | "high"
  }[]
}

/**
 * 超范围尝试记录
 * 记录每次模型尝试修改范围外文件的行为，用于审计和调优
 */
export interface ScopeViolation {
  /** 发生在第几轮对话（turn 计数） */
  readonly turn: number
  /** 尝试修改的文件路径 */
  readonly attemptedPath: string
  /** 检测到的修改意图/原因描述 */
  readonly detectedIntent: string
  /** 用户是否批准了此次扩展 */
  readonly userApproved: boolean
  /** 记录时间戳（Unix 毫秒） */
  readonly timestamp: number
}

/** checkToolAccess 的返回结构 */
export interface ToolAccessResult {
  /** 是否直接允许调用 */
  readonly allowed: boolean
  /** 不允许时的原因说明（可展示给用户） */
  readonly reason?: string
  /** 是否需要用户确认 */
  readonly needsApproval?: boolean
  /** 若不允许，建议的依赖分类 */
  readonly dependencyType?: DependencyType
}

/** detectScopeCreepSignals 的返回结构 */
export interface ScopeCreepSignalResult {
  /** 是否检测到信号 */
  readonly hasSignal: boolean
  /** 匹配到的信号短语列表 */
  readonly signals: readonly string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 服务接口定义（从 旧API 迁移到 Context.Service 模式）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ScopeCreepGuard 服务接口
 *
 * 作为 DeepCode 管线中的一个 Effect 服务，提供范围蔓延防护能力。
 * 所有状态通过 Ref 管理，纯内存操作，线程安全（Effect 保证）。
 */
export interface Interface {
  /** 设置初始修改范围（plan 创建阶段调用） */
  readonly setInitialScope: (
    allowedFiles: readonly string[],
    readonlyFiles?: readonly string[],
  ) => Effect.Effect<void>

  /**
   * 工具调用前的 Scope 权限检查
   *
   * @param toolName - 即将调用的工具名称
   * @param filePath - 工具将操作的目标文件路径
   * @returns 检查结果对象
   */
  readonly checkToolAccess: (toolName: string, filePath: string) => Effect.Effect<ToolAccessResult>

  /**
   * 分类计划外依赖并更新 Scope
   *
   * @param path         - 涉及的文件路径
   * @param type         - 依赖分类
   * @param reason       - 修改原因/意图描述
   * @param userApproved - 用户是否已批准
   */
  readonly classifyDependency: (
    path: string,
    type: DependencyType,
    reason: string,
    userApproved: boolean,
  ) => Effect.Effect<void>

  /**
   * 检测文本中的"顺手改"信号词
   *
   * @param text - 待检测的文本
   * @returns 检测结果
   */
  readonly detectScopeCreepSignals: (text: string) => ScopeCreepSignalResult

  /** 获取延迟处理的问题列表 */
  readonly getDeferredFindings: () => Effect.Effect<ApprovedScope["deferredFindings"]>

  /** 获取当前 Scope 快照 */
  readonly getScope: () => Effect.Effect<ApprovedScope>

  /** 获取超范围尝试的历史记录 */
  readonly getViolations: () => Effect.Effect<readonly ScopeViolation[]>

  /** 重置服务状态（新任务开始前调用） */
  readonly reset: () => Effect.Effect<void>

  /** 路径匹配检查（导出便于测试） */
  readonly isPathAllowed: (path: string, patterns: readonly string[]) => boolean
}

/** DI token — 从 旧API 迁移到 Context.Service */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeScopeCreepGuard",
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 实现
// ─────────────────────────────────────────────────────────────────────────────

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 当前已批准的修改范围（可变状态，通过 Ref 封装）
    const scopeRef = yield* Ref.make<ApprovedScope>({
      allowedFiles: [],
      readonlyFiles: [],
      approvedOptionals: [],
      deferredFindings: [],
    })
    // 超范围尝试的历史记录
    const violationsRef = yield* Ref.make<ScopeViolation[]>([])
    // 对话轮次计数器，用于 violation 记录中的 turn 字段
    const turnRef = yield* Ref.make(0)

    /**
     * 设置初始修改范围
     *
     * 在 plan 创建阶段调用，根据用户任务推断需要修改的文件集合，
     * 建立初始的 allowedFiles 和 readonlyFiles 边界。
     */
    const setInitialScope = (
      allowedFiles: readonly string[],
      readonlyFiles: readonly string[] = [],
    ): Effect.Effect<void> =>
      Ref.set(scopeRef, {
        allowedFiles,
        readonlyFiles,
        approvedOptionals: [], // 初始无已批准的可选优化
        deferredFindings: [],  // 初始无延迟问题
      })

    /**
     * 检查文件路径是否匹配给定的 glob 模式列表
     *
     * 支持三种简单 glob 模式（刻意不引入 minimatch 等重依赖）：
     * 1. 后缀匹配：如 "*.ts" 匹配所有 .ts 文件
     * 2. 前缀匹配：如 "src/" 匹配 src 目录下所有文件
     * 3. 通配符匹配：如 "src/星/test.ts" 转为正则匹配
     * 4. 精确匹配：无通配符时要求完全相等或是该路径下的子路径
     */
    const isPathAllowed = (path: string, patterns: readonly string[]): boolean => {
      // 空模式列表直接拒绝
      if (patterns.length === 0) return false
      return patterns.some((pattern) => {
        // 前缀通配：如 "src/*" → 匹配以 "src/" 开头的路径
        if (pattern.endsWith("*")) {
          return path.startsWith(pattern.slice(0, -1))
        }
        // 后缀通配：如 "*.ts" → 匹配以 ".ts" 结尾的路径
        if (pattern.startsWith("*")) {
          return path.endsWith(pattern.slice(1))
        }
        // 中间通配：将 * 转为 .* 后用正则匹配
        if (pattern.includes("*")) {
          // 将 glob 模式转为正则表达式（* → .*），并添加首尾锚定
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$")
          return regex.test(path)
        }
        // 无通配符：精确匹配或子路径匹配（如 "src/core" 匹配 "src/core/utils.ts"）
        return path === pattern || path.startsWith(pattern + "/")
      })
    }

    /**
     * 工具调用前的 Scope 权限检查
     *
     * 在 Tool Guard 中调用，拦截每次写工具操作，判断目标文件是否在已批准范围内。
     * 只读工具（Read/Grep/Glob/WebFetch/WebSearch）直接放行，不做范围检查。
     *
     * 决策流程：
     * 1. 只读工具 → allowed=true
     * 2. 目标文件在 allowedFiles 中 → allowed=true
     * 3. 目标文件在 approvedOptionals 中 → allowed=true
     * 4. 目标文件在 readonlyFiles 中 → allowed=false，标记为需必要依赖确认
     * 5. 其他情况 → allowed=false，需要分类（必要依赖/可选优化/无关）
     */
    const checkToolAccess = (
      toolName: string,
      filePath: string,
    ): Effect.Effect<ToolAccessResult> =>
      Ref.get(scopeRef).pipe(
        Effect.map((scope) => {
          // 只读类工具总是放行——允许模型自由探索代码库
          if (["Read", "Grep", "Glob", "WebFetch", "WebSearch"].includes(toolName)) {
            return { allowed: true }
          }

          // 检查是否在计划内的允许修改列表中
          if (isPathAllowed(filePath, scope.allowedFiles)) {
            return { allowed: true }
          }

          // 检查是否是用户已批准的可选优化路径
          if (scope.approvedOptionals.some((a) => filePath.includes(a))) {
            return { allowed: true }
          }

          // 检查是否在只读列表中——需要按必要依赖流程处理
          if (scope.readonlyFiles.length > 0 && isPathAllowed(filePath, scope.readonlyFiles)) {
            return {
              allowed: false,
              reason: `文件 ${filePath} 在只读范围内。如果这是必要依赖，请解释为什么必须修改；如果是顺手发现的问题，请记录到deferred findings。`,
              needsApproval: true,
              dependencyType: "required", // 触发修改只读文件通常意味着是必要依赖
            }
          }

          // 完全超出范围：需要模型先分类，再决定是否请求用户确认
          return {
            allowed: false,
            reason: `文件 ${filePath} 不在当前计划的修改范围内。请分类：1)必要依赖（不修改则当前step无法完成）2)可选优化（建议用户确认）3)无关（记录不处理）`,
            needsApproval: true,
          }
        }),
      )

    /**
     * 分类计划外依赖并更新 Scope
     *
     * 在 cascade 扩展或用户确认后调用，将新发现的工作按类型纳入管理：
     * - required：自动加入 allowedFiles，后续写操作直接放行
     * - optional + userApproved：加入 approvedOptionals，后续写操作放行
     * - optional + 未批准：不加入任何允许列表，写操作继续被拦截
     * - unrelated：加入 deferredFindings，任务结束时报告
     *
     * 无论哪种类型，都会记录一条 violation 日志用于审计。
     */
    const classifyDependency = (
      path: string,
      type: DependencyType,
      reason: string,
      userApproved: boolean,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        // 递增轮次计数器
        const turn = yield* Ref.updateAndGet(turnRef, (t) => t + 1)

        if (type === "required") {
          // 必要依赖：自动纳入允许修改范围，无需用户额外确认
          yield* Ref.update(scopeRef, (s) => ({
            ...s,
            allowedFiles: [...s.allowedFiles, path],
          }))
        } else if (type === "optional" && userApproved) {
          // 可选优化且用户已批准：加入已批准可选列表
          yield* Ref.update(scopeRef, (s) => ({
            ...s,
            approvedOptionals: [...s.approvedOptionals, path],
          }))
        } else if (type === "unrelated") {
          // 无关问题：记录到延迟处理列表，默认严重程度为 medium
          yield* Ref.update(scopeRef, (s) => ({
            ...s,
            deferredFindings: [...s.deferredFindings, {
              description: reason,
              location: path,
              severity: "medium" as "low" | "medium" | "high", // TODO: 可根据信号词强度动态调整 severity
            }],
          }))
        }
        // optional 但用户未批准时，不更新 scope——写操作继续被拦截

        // 记录此次范围扩展行为（无论是否批准都记录，便于事后审计和策略调优）
        yield* Ref.update(violationsRef, (v) => [...v, {
          turn,
          attemptedPath: path,
          detectedIntent: reason,
          userApproved: type === "required" || userApproved, // 必要依赖视为自动批准
          timestamp: Date.now(),
        }])
      })

    /**
     * 检测文本中的"顺手改"信号词
     *
     * 在 Review 阶段（tier>=2）调用，扫描模型最近输出文本中是否包含
     * 典型的 scope creep 信号短语。支持中英文双语检测。
     */
    const detectScopeCreepSignals = (text: string): ScopeCreepSignalResult => {
      // 信号词正则模式列表——中文和英文的典型 scope creep 表达
      const signalPatterns = [
        /顺便[^。\n]{5,50}/g,                                                    // "顺便把Y也改了"
        /既然(?:都|已经)[^。\n]{5,50}/g,                                         // "既然都改到这里了"
        /也(?:可以|应该|需要|得)[^。\n]{5,50}(?:改|修|加|处理|优化|重构)/g,        // "也可以顺便优化一下"
        /(?:while|since) (?:we|I)('m| am) (?:at|here)[^.]{5,100}/gi,            // "while I'm at it"
        /(?:should|could|might as well) (?:also|fix|clean|refactor|update)[^.]{5,100}/gi, // "might as well also fix"
        /in addition to[^.]{5,100}/gi,                                           // "in addition to fixing X"
      ]
      const signals: string[] = []

      // 遍历所有模式，收集匹配结果
      for (const pattern of signalPatterns) {
        let match: RegExpExecArray | null
        while ((match = pattern.exec(text)) !== null) {
          const signal = match[0].trim()
          // 去重：避免同一片段被多个模式重复匹配（取前20字符做包含判断）
          if (signal.length > 5 && !signals.some((s) => s.includes(signal.slice(0, 20)))) {
            signals.push(signal.slice(0, 120)) // 截断至120字符，避免过长
          }
        }
      }

      return { hasSignal: signals.length > 0, signals }
    }

    /** 获取延迟处理的问题列表 */
    const getDeferredFindings = (): Effect.Effect<ApprovedScope["deferredFindings"]> =>
      Ref.get(scopeRef).pipe(Effect.map((s) => s.deferredFindings))

    /** 获取当前 Scope 快照 */
    const getScope = (): Effect.Effect<ApprovedScope> => Ref.get(scopeRef)

    /** 获取超范围尝试的历史记录 */
    const getViolations = (): Effect.Effect<readonly ScopeViolation[]> =>
      Ref.get(violationsRef)

    /** 重置服务状态（新任务开始前调用） */
    const reset = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.set(scopeRef, { allowedFiles: [], readonlyFiles: [], approvedOptionals: [], deferredFindings: [] })
        yield* Ref.set(violationsRef, [])
        yield* Ref.set(turnRef, 0)
      })

    // 暴露服务的公共方法接口
    return Service.of({
      setInitialScope,        // 设置初始范围
      checkToolAccess,        // 工具权限检查
      classifyDependency,     // 依赖分类
      detectScopeCreepSignals, // 信号词检测
      getDeferredFindings,    // 获取延迟问题
      getScope,               // 获取范围快照
      getViolations,          // 获取违规记录
      reset,                  // 重置状态
      isPathAllowed,          // 路径匹配检查（导出便于测试）
    })
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// 集成 TODO 列表（对应论文 I-08 的后续接入工作）
// ─────────────────────────────────────────────────────────────────────────────

// TODO(I-08): [P0] 在 plan 创建完成后调用 setInitialScope()，根据任务推断设置初始文件范围
//             - 需要 plan 模块提供"预计修改文件列表"的输出
// TODO(I-08): [P0] 在 write/edit/patch/apply_patch 工具执行前调用 checkToolAccess() guard
//             - 需要在工具调度层（tool runner）集成前置检查钩子
//             - 当 needsApproval=true 时，暂停执行并触发用户确认流程
// TODO(I-08): [P1] 在 tier>=2 review 阶段，扫描最近 assistant 消息中的 scope creep 信号词
//             - 当 detectScopeCreepSignals 返回 hasSignal=true 时，在 review 中提示范围扩展风险
// TODO(I-08): [P1] 任务结束时将 deferredFindings 作为"发现但未处理的问题"报告给用户
//             - 格式建议：按 severity 分组，high 置顶，low 可折叠
// TODO(I-08): [P2] 根据 violation 历史自动优化初始 scope 推断——高频超范围路径模式可预加入 allowedFiles
// TODO(I-08): [P2] 为 detectScopeCreepSignals 添加更多语言支持（日文、韩文等）和领域特定信号词

// ─────────────────────────────────────────────────────────────────────────────
// 应用节点注册
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DeepCode 应用节点定义
 * 将 ScopeCreepGuard 服务注册到 DeepCode 管线中，作为独立的可定位节点。
 * 无外部服务依赖（deps 为空）。
 */
export const node = makeLocationNode({
  name: "deepcode-scope-creep-guard",
  layer,
  deps: [],
})
