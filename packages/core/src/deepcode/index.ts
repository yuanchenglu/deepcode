/**
 * DeepCode Harness — 模块导出索引
 *
 * DeepCode 是为 DeepSeek V4 深度适配的 Coding Agent Harness 层改造，包含九大模块：
 *
 * 1. **Byte-Stable Prefix** (prefix-context)
 *    - System Prompt 启动时组装后冻结为不可变前缀
 *    - 最大化 DeepSeek V4 Prefix Cache 命中率
 *
 * 2. **KV Cache 硬约束前缀注入** (hard-constraint/)
 *    - 从用户 prompt 提取"不能/不要/必须/禁止"硬约束
 *    - 注入 prefix 区（非压缩区），物理隔离防止注意力稀释
 *
 * 3. **Flash/Pro 智能路由** (router/)
 *    - 默认 Flash-first（简单/读取/低风险）
 *    - Checkpoint/高风险/失败重试自动升级 Pro
 *    - Route reason 记录用于分析
 *
 * 4. **Reasoning Content 管理** (reasoning/)
 *    - reasoning_effort 按意图/档位分配
 *    - 工具轮次临时保留完整 reasoning，后续轮次替换为摘要
 *    - 历史轮次剥离 reasoning 节省上下文
 *
 * 5. **7+1 意图路由** (intent-router/)
 *    - Simple/Medium/Refactor/New/Architecture/Research/Collaboration + Spec-Driven
 *    - Code-based 快速规则 + 策略绑定表
 *    - 自动配置面谈深度/Plan 粒度/审查严格度
 *
 * 6. **Agent 免疫系统** (immune-system/)
 *    - Checkpoint 处独立审查约束遵守情况
 *    - 发现违规自动固化为 ImmuneSkill
 *
 * 7. **双向 Agent 原语** (meta-directives/)
 *    - need_more_context: LLM 主动请求更多文件
 *    - request_specialized_model: LLM 主动请求模型升级
 *    - trigger_self_review: LLM 主动触发自我审查
 *    - propose_skill: LLM 提议固化 Skill
 *
 * 8. **滑动窗口对齐 + Token 预算管理** (context-layout/)
 *    - sliding_window=128 感知的上下文布局追踪
 *    - 四区 token 预算（prefix/anchor/active/compressed）
 *    - 输出边界建议：确保关键内容不滑出全密度窗口
 *    - Flash/Pro index_topk 差异感知
 *
 * 9. **Prompt 信号标签** (prompt-signal/)
 *    - 基于 mHC 多通道连接的六类信号分层标签
 *    - MoE 前3层 hash routing 稳定性保障
 *    - 字节稳定标签格式（[SIGNAL:TYPE]...[/SIGNAL]）
 *
 * 使用方式：
 * 在 packages/core/src/location-services.ts 的 locationServices 数组中添加这些 node，
 * LayerNode.group 自动处理依赖拓扑排序。
 *
 * @module
 */

// ============================================================
// 模块一：Byte-Stable Prefix
// ============================================================
export { node as DeepCodePrefixNode } from "./prefix-context"

// ============================================================
// 模块二：硬约束前缀注入
// store 必须先于 context-source 注册（context-source 依赖 store）
// ============================================================
export { node as DeepCodeConstraintStoreNode } from "./hard-constraint/store"
export { node as DeepCodeConstraintContextNode } from "./hard-constraint/context-source"

// ============================================================
// 模块三：Flash/Pro 智能路由
// ============================================================
export { node as DeepCodeModelRouterNode } from "./router/model-router"

// ============================================================
// 模块四：Reasoning Content 管理
// ============================================================
export { node as DeepCodeReasoningManagerNode } from "./reasoning/manager"

// ============================================================
// 模块五：7+1 意图路由
// ============================================================
export { node as DeepCodeIntentRouterNode } from "./intent-router/classifier"

// ============================================================
// 模块六：Agent 免疫系统
// ============================================================
export { node as DeepCodeImmuneSystemNode } from "./immune-system/reviewer"

// ============================================================
// 模块七：双向 Agent 原语
// ============================================================
export { node as DeepCodeMetaDirectivesNode } from "./meta-directives/handlers"

// ============================================================
// 模块八：滑动窗口对齐 + Token 预算管理
// ============================================================
export { node as DeepCodeWindowManagerNode } from "./context-layout/window-manager"

// ============================================================
// 模块九：Prompt 信号标签（mHC/MoE 对齐）
// ============================================================
export { node as DeepCodeSignalTaggerNode } from "./prompt-signal/tagger"
