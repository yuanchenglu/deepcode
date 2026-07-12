/**
 * DeepCode Harness — 硬约束提取器
 *
 * 模块二：KV Cache 硬约束前缀注入 — 核心提取逻辑
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * DeepSeek V4 使用混合注意力架构：
 * - CSA（Compressed Sparse Attention，compress_ratio=4）
 * - HCA（Heavily Compressed Attention，compress_ratio=128）
 * - MQA（Multi-Query Attention，1 个 KV head）
 *
 * 这意味着：放在 System Prompt 前缀区（非压缩区）的 token 始终保持完整注意力；
 * 放在对话历史后部的 token 经过 128x 压缩后注意力极度稀释。
 *
 * 论文 I-04（KV Cache 硬约束前缀注入）核心洞察：
 * "约束不丢是因为约束根本不在被压缩的内容里。"
 *
 * 用户 prompt 中的 "不能改 config 文件"、"必须先备份" 等硬约束如果只出现在用户消息中，
 * 经过多轮对话和 CSA/HCA 压缩后，模型可能"遗忘"这些约束。
 * 解决方案：自动提取硬约束，注入到 Baseline System Context 的前缀区。
 *
 * ============================================================
 * 提取策略
 * ============================================================
 *
 * 使用基于正则的关键词模式匹配：
 * - 禁止类（forbid/never）：不能/不要/禁止/严禁/绝不/不可/不得 + 动作 + 对象
 * - 必须类（require/always）：必须/一定/只能/只许 + 动作
 *
 * 为什么先用正则而不是 LLM 提取？
 * 1. 正则提取是确定性的，零延迟，零 token 成本
 * 2. 硬约束通常有明确的语言标记（否定词/强制词），正则可以覆盖大部分场景
 * 3. LLM 提取可以作为后续增强（高置信度正则结果优先，模糊 case 交给 LLM 判断）
 *
 * @module
 */

// ============================================================
// 类型定义
// ============================================================

/**
 * 约束类型枚举
 *
 * - forbid: "不要/不能/禁止 X" — 明确禁止某项操作
 * - never:  "严禁/绝不 X"     — 比 forbid 更强的禁止（最高优先级）
 * - require: "必须/需要 X"     — 要求执行某项前置条件
 * - always:  "一定/总是 X"     — 通用行为要求
 *
 * 设计考量：
 * forbid 和 require 是主要类型；never 和 always 用于语义强度区分。
 * 后续免疫审查中，never 类型违反会触发更严重的告警。
 */
export type ConstraintType = "forbid" | "require" | "never" | "always"

/**
 * 一条提取的硬约束
 *
 * @interface HardConstraint
 * @property id         基于内容哈希的唯一标识，用于去重和快照比较
 * @property type       约束类型（禁止/必须等）
 * @property pattern    约束原文（从用户输入中提取的原始文本）
 * @property scope      可选的适用范围（文件模式/操作类型），当前版本未使用，预留用于编译为可执行检查
 * @property source     来源：user=用户输入，system=系统配置，derived=免疫审查派生
 * @property confidence 置信度 0-1，正则匹配默认 0.8
 */
export interface HardConstraint {
  id: string
  type: ConstraintType
  pattern: string
  scope?: string
  source: "user" | "system" | "derived"
  confidence: number
}

// ============================================================
// 正则模式定义
// ============================================================

/**
 * 硬约束关键词模式表
 *
 * 每条规则包含：
 * - regex:  正则表达式（g flag 用于多次匹配）
 * - type:   对应的约束类型
 * - scopeHint: 可选的适用范围提示（当前未使用，预留）
 *
 * 模式设计原则：
 * 1. 覆盖中文用户最常用的禁止/强制表达
 * 2. 捕获动作+对象两个核心语义成分（如"修改 config 文件"）
 * 3. 避免过宽匹配导致误提取（如"能不能帮我"中的"能"不触发）
 *
 * 已知局限：
 * - 双重否定（"不要不做备份"）会被错误分类为 forbid
 * - 条件约束（"除非 X，否则不要 Y"）会丢失条件信息
 * - 这些 case 出现频率低，后续可用 LLM 二次审查
 */
const CONSTRAINT_PATTERNS: Array<{
  regex: RegExp
  type: ConstraintType
  scopeHint?: string
}> = [
  // --- 禁止类模式 ---
  // "不要修改 config" / "别动数据库" — 最常用的禁止表达
  { regex: /不要?\s*(修改|改|动|删|删除|移动|重命名|触碰|碰)\s*([^\s,.;，。；！!？?]+)/g, type: "forbid" },
  // "不能用 any 类型" / "不能删除测试" — 带能力否定的禁止
  { regex: /不能\s*(修改|改|动|删|删除|移动|重命名|触碰|碰|使用|用|引入|加|添加)\s*([^\s,.;，。；！!？?]+)/g, type: "forbid" },
  // "禁止删除数据" / "禁止执行 rm" — 命令式禁止
  { regex: /禁止\s*(修改|改|删|删除|使用|用|执行|运行)\s*([^\s,.;，。；！!？?]+)/g, type: "forbid" },
  // "严禁提交密钥" — 最高强度禁止
  { regex: /严禁\s*([^\s,.;，。；！!？?]+)/g, type: "never" },
  // "绝不允许" — 类似严禁
  { regex: /绝不\s*([^\s,.;，。；！!？?]+)/g, type: "never" },
  // "不可删除日志" — 书面语禁止
  { regex: /不可\s*(修改|改|删|删除|动)\s*([^\s,.;，。；！!？?]+)/g, type: "forbid" },
  // "不得泄露密钥" — 正式用语禁止
  { regex: /不得\s*(修改|改|删|删除|动|使用)\s*([^\s,.;，。；！!？?]+)/g, type: "forbid" },

  // --- 必须类模式 ---
  // "必须先备份再修改" — 前置条件要求
  // 正则：必须 [先/要/将/把]? <内容> [再/才能/然后/之后/，/。]
  { regex: /必须\s*(先|要|将|把)?\s*([^\s,.;，。；！!？?][^,.;，。；！!？?]{0,30}?)(?:再|才能|然后|之后|，|。|；|$)/g, type: "require" },
  // "一定要写注释" — 强调性要求
  { regex: /一定\s*(要|得)?\s*([^\s,.;，。；！!？?][^,.;，。；！!？?]{0,30}?)(?:，|。|；|$)/g, type: "always" },
  // "只能用 Python" — 限制选项的要求
  { regex: /只能\s*([^\s,.;，。；！!？?][^,.;，。；！!？?]{0,20})/g, type: "require" },
  // "只许用函数式" — 同只能
  { regex: /只许\s*([^\s,.;，。；！!？?][^,.;，。；！!？?]{0,20})/g, type: "require" },
]

// ============================================================
// 公开函数
// ============================================================

/**
 * 从用户 prompt 文本中提取硬约束
 *
 * 遍历所有正则模式，收集匹配项，去重后返回约束数组。
 * 去重使用完整 pattern 文本作为 key，避免同一约束被多个模式重复提取。
 *
 * @param text - 用户输入的原始文本
 * @returns 提取到的硬约束数组（按出现顺序排列，已去重）
 *
 * @example
 * ```ts
 * const constraints = extractHardConstraints("帮我重构，不要修改 config 文件，必须先备份")
 * // 返回：
 * // [
 * //   { id: "hc_xxx", type: "forbid", pattern: "不要修改 config", source: "user", confidence: 0.8 },
 * //   { id: "hc_yyy", type: "require", pattern: "必须先备份", source: "user", confidence: 0.8 },
 * // ]
 * ```
 */
export function extractHardConstraints(text: string): HardConstraint[] {
  const constraints: HardConstraint[] = []
  // 用 Set 去重：同一 pattern 文本不重复添加
  const seen = new Set<string>()

  for (const { regex, type } of CONSTRAINT_PATTERNS) {
    // 重要：因为正则带 /g flag，多次调用必须重置 lastIndex
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      // match[0] 是完整匹配文本（如"不要修改 config"）
      const pattern = match[0].trim()
      // 去重：已见过的 pattern 跳过
      if (seen.has(pattern)) continue
      seen.add(pattern)

      constraints.push({
        id: generateConstraintId(pattern),
        type,
        pattern,
        source: "user",
        confidence: 0.8, // 正则匹配的默认置信度
      })
    }
  }

  return constraints
}

/**
 * 基于约束文本生成唯一 ID
 *
 * 使用简单的 32-bit FNV-1a 风格哈希转换为 base36 字符串。
 * ID 确定性：相同 pattern 始终生成相同 ID，用于 snapshot 比较和去重。
 *
 * @param pattern - 约束原文
 * @returns base36 编码的短 ID，格式 "hc_{hash}"
 */
function generateConstraintId(pattern: string): string {
  let hash = 0
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charCodeAt(i)
    // FNV-1a 风格：hash * 33 XOR char（33 是 32-bit 偏移量）
    hash = ((hash << 5) - hash) + char
    // 强制 32-bit 整数（JavaScript bitwise ops 自动处理）
    hash = hash & hash
  }
  return `hc_${Math.abs(hash).toString(36)}`
}

/**
 * 将约束列表渲染为注入到 System Context 的格式化文本
 *
 * 输出格式：
 * ```
 * ## 用户硬约束（必须严格遵守）
 *
 * ### 禁止事项：
 * - ❌ 不要修改 config
 *
 * ### 必须事项：
 * - ✅ 必须先备份
 *
 * 以上约束优先级最高，违反任何一条都视为任务失败。
 * ```
 *
 * 使用 ❌/✅ emoji 让模型在快速扫描时能通过视觉标记区分类型。
 * 分离"禁止"和"必须"两个列表，降低模型漏读概率。
 *
 * @param constraints - 约束数组
 * @returns 格式化文本（空约束列表返回空字符串）
 */
export function renderConstraints(constraints: HardConstraint[]): string {
  if (constraints.length === 0) return ""

  // 按类型分组
  const forbidList = constraints.filter((c) => c.type === "forbid" || c.type === "never")
  const requireList = constraints.filter((c) => c.type === "require" || c.type === "always")

  const lines: string[] = ["## 用户硬约束（必须严格遵守）", ""]

  if (forbidList.length > 0) {
    lines.push("### 禁止事项：")
    for (const c of forbidList) {
      lines.push(`- ❌ ${c.pattern}`)
    }
    lines.push("")
  }

  if (requireList.length > 0) {
    lines.push("### 必须事项：")
    for (const c of requireList) {
      lines.push(`- ✅ ${c.pattern}`)
    }
    lines.push("")
  }

  // 尾部强调：违反约束=任务失败，强化模型遵守
  lines.push("以上约束优先级最高，违反任何一条都视为任务失败。")

  return lines.join("\n")
}
