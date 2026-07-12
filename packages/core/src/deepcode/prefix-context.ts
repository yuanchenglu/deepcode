/**
 * DeepCode Harness — Byte-Stable Prefix 上下文源
 *
 * 模块一：Byte-Stable Prefix 架构实现
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * DeepSeek V4 API 的 Context Caching 是 best-effort 的 full-prefix-unit 匹配：
 * 只有当发送给 API 的前缀文本 byte-for-byte 完全相同时，KV Cache 才命中。
 * 任何微小变化（多一个空格、时间戳变化）都会导致整个前缀重新计算。
 *
 * OpenCode 的 SystemContext 机制（见 CONTEXT.md）天然支持 byte-stable prefix：
 * - SystemContext.initialize() 生成的 Baseline System Context 持久化到数据库
 * - 整个 Context Epoch 期间 baseline 文本保持 byte-identical
 * - 动态内容通过 Mid-Conversation System Message 追加，不修改 prefix
 * - 跨进程重启也复用存储的 baseline（"reused verbatim across process restarts"）
 *
 * 本模块注册 "deepcode/prefix" ContextSource，将 DeepCode 的核心系统指令
 * 作为稳定的 Baseline prefix 注入到 System Context 中。
 *
 * ============================================================
 * 设计决策
 * ============================================================
 *
 * 1. 为什么用 ContextSource 而不是 experimental.chat.system.transform？
 *    - transform hook 是 legacy API，可以任意篡改 system prompt
 *    - ContextSource 是 V2 一等扩展路径，走标准的 initialize/reconcile/replace 生命周期
 *    - 自动获得 DB 持久化、cross-restart 复用、Mid-Conversation Message 等能力
 *
 * 2. 为什么 prefix 内容硬编码而不是从文件加载？
 *    - 从文件加载会引入 I/O 副作用和文件变更导致 baseline 重建的风险
 *    - prefix 内容是 DeepCode 的"身份标识"，变化应该由版本控制，不由文件系统
 *
 * 3. 为什么不把所有 DeepCode 指令都放在 prefix？
 *    - Skill 索引放入 prefix（节省 cache），但 Skill body 通过 skill tool 按需加载
 *    - 当前意图、约束更新、动态 memory 走独立 ContextSource + Mid-Conversation 路径
 *    - 只有不随 session 变化的"操作系统级"指令才放在 prefix 中
 *
 * @module
 */

// ============================================================
// 外部依赖
// ============================================================

// Effect 是 OpenCode 使用的函数式效应框架，提供 Layer/Effect/Ref 等抽象
// 这里只用到 Effect（效应描述）、Layer（依赖注入层）、Schema（数据编解码）
import { Effect, Layer, Schema } from "effect"
// makeLocationNode 是 OpenCode 的 Location 级服务注册器
// 一个 LocationNode 将 Layer + deps 打包成可被 LocationServices 组合的节点
import { makeLocationNode } from "../effect/app-node"
// SystemContext 提供 Source<A> 类型定义和 make/combine/initialize 等构造器
// 这是 byte-stable prefix 的底层支撑代数
import { SystemContext } from "../system-context/index"
// SystemContextRegistry 是 Location 级的 ContextSource 注册中心
// 通过 register() 方法添加自定义 ContextSource
import { SystemContextRegistry } from "../system-context/registry"

// ============================================================
// 常量
// ============================================================

/**
 * DeepCode Prefix 的稳定 key
 *
 * 命名规则: {插件名}/{语义名}, 必须匹配正则 ^[a-z0-9][a-z0-9._-]star/[a-z0-9][a-z0-9._/-]star$
 * （见 SystemContext.Key 的 Schema 定义）
 *
 * key 在整个系统中必须唯一；重复 key 会在 combine() 时抛出 DuplicateKeyError
 */
const PREFIX_KEY = SystemContext.Key.make("deepcode/prefix")

// ============================================================
// Prefix 渲染函数
// ============================================================

/**
 * 渲染 DeepCode 的 baseline prefix 文本
 *
 * 包含内容：
 * 1. DeepCode 身份标识（"DeepSeek V4 原生 Coding Agent"）
 * 2. 四大核心承诺（Completion-first/Runtime-first/Evidence-first/Cache-aware）
 * 3. 执行原则（理解后行动、小步验证、约束优先）
 * 4. 双向 Agent 元指令使用说明（四个原语的简介）
 * 5. 7+1 意图类型识别指令
 *
 * 注意事项：
 * - 此函数必须是纯函数，不能包含 Date.now()、随机数、session ID 等易变内容
 * - 返回值在整个 Context Epoch 内保持 byte-identical
 * - 任何修改都会导致 Context Epoch 重建和 KV Cache miss
 *
 * @returns 稳定的系统指令文本字符串
 */
function renderPrefix(): string {
  return [
    "# DeepCode — DeepSeek V4 原生 Coding Agent",
    "",
    "你是 DeepCode，一个为 DeepSeek V4 模型量身定制的编码助手 Harness 层。",
    "你的核心承诺：",
    "- Completion-first：优先完成用户任务，而非反复询问",
    "- Runtime-first：充分利用工具和运行时验证，不凭记忆猜测",
    "- Evidence-first：所有结论基于实际文件内容和执行结果",
    "- Cache-aware：注意上下文布局，核心指令在前，动态内容在后",
    "",
    "## 执行原则",
    "",
    "1. 行动前先理解：读取相关文件，理解现有代码结构再动手",
    "2. 小步验证：每完成一个逻辑步骤就验证，不攒大改动",
    "3. 约束优先：用户的硬约束（不能/不要/必须/禁止）优先级最高",
    "4. 工具使用：通过工具读取文件、执行命令、搜索代码",
    "",
    "## 元指令（双向 Agent 原语）",
    "",
    "你可以在回复中通过工具调用来主动控制执行流程：",
    "- need_more_context: 当你需要查看更多文件或搜索更多信息时使用",
    "- request_specialized_model: 当你遇到复杂推理需要更强模型时使用",
    "- trigger_self_review: 当你完成一段重要工作想自我审查时使用",
    "- propose_skill: 当你发现一个重复模式可以固化为技能时使用",
    "",
    "## 任务类型识别",
    "",
    "首个交互中，评估用户任务的类型：",
    "- Simple: 简单任务（排序import、修typo、格式化），直接执行，无需详细计划",
    "- Medium: 中等任务（添加小功能、修bug），简单确认后执行",
    "- Refactor: 重构任务，确认范围后制定计划，分步骤执行",
    "- New: 新建项目/功能，深度澄清需求后制定完整计划",
    "- Architecture: 架构设计，深度分析后给出方案对比",
    "- Research: 调研任务，搜索分析后给出报告",
    "- Collaboration: 跨文件/多模块协作，分模块处理",
    "",
    "如果工作目录中存在 openspec/ 配置，遵循 Spec-Driven 流程。",
  ].join("\n")
}

// ============================================================
// ContextSource 构造
// ============================================================

/**
 * DeepCode Prefix 的 ContextSource 定义
 *
 * Source<A> 参数解释：
 * - key: PREFIX_KEY — 稳定标识符 "deepcode/prefix"
 * - codec: Schema.toCodecJson(Schema.String) — 值是字符串，用 JSON 编码做 snapshot 比较
 *   （与 core/date、core/environment 等内置 source 使用相同模式）
 * - load: Effect.succeed(renderPrefix()) — 纯值加载，无 I/O 副作用
 * - baseline: (text) => text — baseline 渲染就是文本本身（首次渲染完整 prefix）
 * - update: () => "" — 更新时返回空字符串：prefix 不应被更新
 *   设计理由：核心身份指令不变；任何变化应该通过 replace（新 Epoch）处理，
 *   而不是 Mid-Conversation Message 追加空内容
 *
 * 为什么 update 返回空字符串？
 * renderPrefix() 是硬编码常量，load 永远返回相同值，reconcile 时比较 codec 编码
 * 的值发现 Unchanged，根本不会调用 update。这里提供空函数是满足 Source<A> 接口
 * 完整性要求。
 */
const prefixSource = SystemContext.make({
  key: PREFIX_KEY,
  codec: Schema.toCodecJson(Schema.String),
  load: Effect.succeed(renderPrefix()),
  baseline: (text: string) => text,
  update: (_previous: string, _current: string) => "",
})

// ============================================================
// Layer 定义
// ============================================================

/**
 * Layer: 将 DeepCode Prefix 注册到 SystemContextRegistry
 *
 * Layer.effectDiscard 创建一个不产生公开服务的 Layer（只做副作用注册）
 * 这与 SystemContextBuiltIns.node 使用相同模式。
 *
 * 执行流程：
 * 1. yield* SystemContextRegistry.Service — 获取 Registry 服务实例
 * 2. registry.register({...}) — 注册 prefixSource
 *
 * 注册时机：Location 初始化时（buildLocationServiceMap 中 LayerNode.hoist 处理依赖）
 * 注册后，SystemContextRegistry.load() 会并发加载所有已注册 source，
 * combine 到完整 SystemContext 中，initialize 生成 baseline。
 */
const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    // 获取当前 Location 的 SystemContextRegistry 服务
    const registry = yield* SystemContextRegistry.Service
    // 注册 deepcode/prefix ContextSource
    yield* registry.register({
      key: PREFIX_KEY,
      load: Effect.succeed(prefixSource),
    })
  }),
)

// ============================================================
// LocationNode 导出
// ============================================================

/**
 * LocationNode 定义，用于集成到 location-services.ts 的 LayerNode.group 中
 *
 * makeLocationNode 参数：
 * - name: 节点名，用于调试和 tracing
 * - layer: 上面定义的注册 Layer
 * - deps: 依赖的其他节点 — SystemContextRegistry.node 是唯一依赖
 *   （SystemContextBuiltIns.node 也依赖它，但 deps 是直接依赖，传递依赖自动解析）
 *
 * 在 packages/core/src/location-services.ts 中：
 *   DeepCodePrefixNode 被添加到 locationServices 数组，
 *   LayerNode.group/hoist 自动处理依赖排序，确保 Registry 先启动
 */
export const node = makeLocationNode({
  name: "deepcode-prefix",
  layer,
  deps: [SystemContextRegistry.node],
})
