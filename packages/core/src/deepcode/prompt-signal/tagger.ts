/**
 * DeepCode Harness — Prompt 信号标签系统（mHC/MoE 对齐）
 *
 * 模块九：基于 V4 mHC 多通道连接 + MoE Hash Routing 的 Prompt 信号分层
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * DeepSeek V4 有两个物理特性共同指向"prompt 信号分层标签"的优化方向：
 *
 * 1. **mHC (Manifold-Constrained Hyper-Connections)**：
 *    - hc_mult=4：embedding 后将 hidden state 扩展为 4 份 copy
 *    - 每个 Transformer Block 维护多份 hidden state copy
 *    - 通过 Sinkhorn-like 约束（20次迭代）做 pre/post/comb mixing
 *    - 流程：embed → HC-expand(4 copies) → N blocks → HC-head → logits
 *    - 推论：不同语义信号（目标/约束/证据/执行）在分层标签引导下，
 *      可能更高效地通过 mHC 的多副本路径并行传播
 *
 * 2. **MoE Hash Routing（前 3 层）**：
 *    - num_hash_layers=3：前 3 层使用基于 token-id 的 hash routing
 *    - 后续层才使用 learned score-based routing
 *    - hash routing 是确定性的：相同 token ID 序列 → 相同专家分配
 *    - 稳定标签文本 → 稳定 token ID → 稳定专家路径 → 减少路由抖动
 *    - 相反，如果同一语义信号每次用不同措辞（"目标："/"Goal:"/「目标」），
 *      token ID 不同 → hash 到不同专家 → 路由不一致 → 质量抖动
 *
 * 对应约束：C-010（Prompt 标签化）
 *
 * ============================================================
 * 信号类型设计
 * ============================================================
 *
 * 基于 V4 mHC 的 4 副本结构和 Agent 工作流需求，定义六类信号标签：
 *
 * | 标签类型 | 用途 | mHC 通道映射（推论） |
 * |---------|------|---------------------|
 * | GOAL       | 当前目标/任务 | Channel 1 (信号主干) |
 * | CONSTRAINT | 硬约束/禁止项   | Channel 2 (边界约束) |
 * | EVIDENCE   | 文件内容/执行结果 | Channel 3 (事实证据) |
 * | EXECUTION  | 当前操作/工具调用 | Channel 3 (执行流) |
 * | REVIEW     | 审查结果/检查点  | Channel 4 (审查反馈) |
 * | NEXT_ACTION| 下一步行动      | Channel 4 (前瞻信号) |
 *
 * 标签格式：[SIGNAL:TYPE]...内容...[/SIGNAL]
 *
 * 标签格式选择理由：
 * 1. ASCII 方括号在 tokenizer 中通常是单 token（] 可能与中文组合，但稳定）
 * 2. 大写标签文本选择 V4 tokenizer 中已知的单 token 或短 token 序列
 * 3. 关闭标签 [/SIGNAL] 与开始标签对称，形成清晰边界
 * 4. 不使用中文标签（"目标："等），因为中文字符 token 化不稳定
 *
 * ============================================================
 * Hash 路由稳定性原则
 * ============================================================
 *
 * 1. **标签文本绝对稳定**：GOAL 始终写 "GOAL"，不混用 "goal"/"目标"/"Goal"
 * 2. **分隔符一致**：始终使用 `[SIGNAL:TYPE]` 格式，不用 `<tag>` 或 `【TYPE】`
 * 3. **内容排序稳定**：同类型信号按固定顺序排列（如硬约束按添加时间排序）
 * 4. **避免动态内容在标签前**：时间戳、随机 ID、session ID 等不放在标签附近
 *
 * @module
 */

// ============================================================
// 外部依赖
// ============================================================
import { Context, Effect, Layer } from "effect"
import { makeLocationNode } from "../../effect/app-node"

// ============================================================
// 类型定义
// ============================================================

/**
 * 六类信号标签类型
 *
 * - goal:        当前目标/任务（最高语义层级）
 * - constraint:  硬约束/禁止/必须项（边界条件）
 * - evidence:    事实证据（文件内容、命令输出、搜索结果）
 * - execution:   当前执行信息（正在进行的操作、工具调用状态）
 * - review:      审查/检查点结果（免疫系统输出、Pro 审查结论）
 * - next_action: 下一步行动指令（引导模型注意力到即将执行的操作）
 */
export type SignalType = "goal" | "constraint" | "evidence" | "execution" | "review" | "next_action"

/**
 * 信号标签到稳定文本的映射
 *
 * 重要：这些字符串是 hash routing 稳定性的关键，
 * 修改它们会导致前 3 层 hash routing 路径变化，可能短暂影响质量。
 * 选择全大写 ASCII 字符串以确保跨语言 tokenizer 一致行为。
 */
const SIGNAL_LABELS: Readonly<Record<SignalType, string>> = {
  goal: "GOAL",
  constraint: "CONSTRAINT",
  evidence: "EVIDENCE",
  execution: "EXECUTION",
  review: "REVIEW",
  next_action: "NEXT_ACTION",
}

// ============================================================
// 纯函数工具
// ============================================================

/**
 * 将内容包装为带信号标签的文本
 *
 * 格式：`[SIGNAL:TYPE]\n内容\n[/SIGNAL]\n`
 *
 * 使用示例：
 * ```ts
 * tagSignal("goal", "完成用户认证模块重构")
 * // → "[SIGNAL:GOAL]\n完成用户认证模块重构\n[/SIGNAL]\n"
 * ```
 *
 * @param type    - 信号类型
 * @param content - 信号内容文本
 * @returns 带标签的文本
 */
export function tagSignal(type: SignalType, content: string): string {
  const label = SIGNAL_LABELS[type]
  return `[SIGNAL:${label}]\n${content}\n[/SIGNAL]\n`
}

/**
 * 批量包装多个同类型信号
 *
 * 每个信号项用独立标签包装，然后按输入顺序拼接。
 * 顺序稳定性很重要：相同内容相同顺序 → 相同 token 序列 → 稳定 hash routing。
 *
 * @param type    - 信号类型
 * @param items   - 信号内容数组
 * @returns 多个带标签的文本拼接
 */
export function tagSignals(type: SignalType, items: readonly string[]): string {
  if (items.length === 0) return ""
  return items.map((item) => tagSignal(type, item)).join("")
}

/**
 * 构建结构化信号块（多类型信号组合）
 *
 * 按固定顺序排列不同类型信号，确保 session 间字节稳定。
 * 顺序：goal → constraint → evidence → execution → review → next_action
 * 这是 mHC 信号的标准注入顺序。
 *
 * @param signals - 各类型信号内容映射（缺失类型跳过）
 * @returns 结构化信号文本块
 */
export function buildSignalBlock(signals: Partial<Record<SignalType, string | string[]>>): string {
  const order: SignalType[] = [
    "goal",
    "constraint",
    "evidence",
    "execution",
    "review",
    "next_action",
  ]

  const parts: string[] = []
  for (const type of order) {
    const content = signals[type]
    if (!content) continue
    if (Array.isArray(content)) {
      const tagged = tagSignals(type, content)
      if (tagged) parts.push(tagged)
    } else {
      parts.push(tagSignal(type, content))
    }
  }
  return parts.join("")
}

/**
 * 从文本中剥离所有信号标签
 *
 * 用于 display 场景（用户看到的文本不需要标签噪声）。
 * 保留标签内的内容文本。
 *
 * @param text - 带标签的文本
 * @returns 去除标签后的纯内容
 */
export function stripSignalTags(text: string): string {
  // 匹配 [SIGNAL:TYPE] 和 [/SIGNAL] 标签
  return text.replace(/\[SIGNAL:[A-Z_]+\]\n?/g, "").replace(/\[\/SIGNAL\]\n?/g, "")
}

/**
 * 获取指定信号类型的标签文本（稳定字符串）
 *
 * 供其他模块引用标签常量，确保全局一致。
 *
 * @param type - 信号类型
 * @returns 标签文本（如 "GOAL"）
 */
export function getSignalLabel(type: SignalType): string {
  return SIGNAL_LABELS[type]
}

// ============================================================
// 服务接口
// ============================================================

export interface Interface {
  /**
   * 将内容包装为带信号标签的文本
   * @see tagSignal
   */
  readonly tag: (type: SignalType, content: string) => string

  /**
   * 批量包装同类型信号
   * @see tagSignals
   */
  readonly tagMany: (type: SignalType, items: readonly string[]) => string

  /**
   * 构建结构化信号块（固定顺序，字节稳定）
   * @see buildSignalBlock
   */
  readonly buildBlock: (signals: Partial<Record<SignalType, string | string[]>>) => string

  /**
   * 从文本中剥离信号标签（用于用户可见输出）
   * @see stripSignalTags
   */
  readonly strip: (text: string) => string

  /**
   * 获取信号标签的稳定文本
   * @see getSignalLabel
   */
  readonly getLabel: (type: SignalType) => string

  /**
   * 获取所有信号类型的标签映射（用于注册到 prefix 等引用场景）
   */
  readonly getAllLabels: () => Readonly<Record<SignalType, string>>
}

/** DI token */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeSignalTagger",
) {}

// ============================================================
// Layer 实现
// ============================================================

/**
 * Layer 是纯值服务（无状态），所有方法都是引用透明的纯函数。
 * 不需要 Ref 或 Effect.gen，直接 Effect.succeed 返回服务对象。
 */
const layer = Layer.effect(
  Service,
  Effect.succeed(
    Service.of({
      tag: (type: SignalType, content: string) => tagSignal(type, content),
      tagMany: (type: SignalType, items: readonly string[]) => tagSignals(type, items),
      buildBlock: (signals: Partial<Record<SignalType, string | string[]>>) =>
        buildSignalBlock(signals),
      strip: (text: string) => stripSignalTags(text),
      getLabel: (type: SignalType) => getSignalLabel(type),
      getAllLabels: () => SIGNAL_LABELS,
    }),
  ),
)

// ============================================================
// LocationNode 导出
// ============================================================

/**
 * LocationNode 定义，用于集成到 location-services.ts
 *
 * 此模块是纯函数服务（无状态、无副作用），可被以下模块注入使用：
 * - prefix-context: 在 baseline prefix 中注入信号标签格式说明
 * - hard-constraint: 将约束用 CONSTRAINT 标签包装
 * - reasoning/manager: checkpoint 结晶时使用 REVIEW 标签
 * - intent-router: 分类结果用 GOAL 标签声明
 * - meta-directives: 模型主动触发的原语使用 NEXT_ACTION 标签
 */
export const node = makeLocationNode({
  name: "deepcode-signal-tagger",
  layer,
  deps: [],
})
