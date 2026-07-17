/**
 * DeepCode Harness — 硬约束 ContextSource
 *
 * 模块二：将硬约束注册为 OpenCode System Context Source
 *
 * ============================================================
 * 为什么作为 ContextSource 而不是拼接在用户消息中？
 * ============================================================
 *
 * ContextSource 是 OpenCode V2 的一等扩展点：
 * 1. 自动进入 Baseline System Context（前缀区，KV Cache 命中区域）
 * 2. 变更时自动发射 Mid-Conversation System Message（不破坏 prefix）
 * 3. DB 持久化、跨进程重启复用（SystemContext.Snapshot）
 * 4. 与其他 ContextSource（core/environment、core/date、core/instructions）
 *    一起被 SystemContext.combine 组合
 *
 * 约束文本放在 prefix 区（非压缩区），即使对话进行多轮，注意力也不会稀释。
 *
 * ============================================================
 * 数据流
 * ============================================================
 *
 * 1. 用户输入 → DeepCodeConstraintStore.extractAndAdd() → Ref 更新
 * 2. 每次 Safe Provider-Turn Boundary：
 *    a. SystemContextRegistry.load() → 并发加载所有 source
 *    b. 此 source 的 load() 从 Ref 读取约束 → renderConstraints() → 文本
 *    c. SystemContext.reconcile() 比较 snapshot 与当前值
 *    d. 如果变化 → 发射 Mid-Conversation System Message
 *
 * @module
 */

// Effect 框架（Schema 用于 SystemContext codec）
import { Effect, Layer, Schema } from "effect"
// OpenCode 内部 API
import { makeLocationNode } from "../../effect/app-node"
import { SystemContext } from "../../system-context/index"
import { SystemContextRegistry } from "../../system-context/registry"
// 同模块依赖
import { renderConstraints, type HardConstraint } from "./extractor"
import { Service as ConstraintStore, node as ConstraintStoreNode } from "./store"

/**
 * ContextSource 稳定 key — "deepcode/hard-constraints"
 *
 * 遵循 {plugin}/{semantic} 命名规范，避免与其他插件冲突。
 */
const CONSTRAINTS_KEY = SystemContext.Key.make("deepcode/hard-constraints")

/**
 * Layer：注册硬约束 ContextSource
 *
 * 使用 Schema.String codec（与 core/date、core/environment 一致模式）：
 * - snapshot 存储渲染后的文本字符串
 * - compare 时比较字符串是否相等（简单、可靠）
 * - 不使用结构化 codec（HardConstraint[]）因为：
 *   a. 我们需要的最终产物就是文本（render 后的）
 *   b. 字符串比较足够判断是否有变化
 *   c. 避免 readonly vs mutable 数组的类型兼容问题
 */
const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    // 注入两个依赖服务
    const registry = yield* SystemContextRegistry.Service
    const store = yield* ConstraintStore

    /**
     * 渲染约束文本给 LLM 看
     *
     * 空约束时给出明确提示："No hard constraints have been set."
     * 这样模型知道"没有约束"和"我还没收到约束信息"的区别。
     */
    const renderForLLM = (constraints: readonly HardConstraint[]): string => {
      const text = renderConstraints([...constraints])
      if (text.length === 0) return "No hard constraints have been set."
      return text
    }

    // 构造 SystemContext.Source
    const source = SystemContext.make({
      key: CONSTRAINTS_KEY,
      codec: makeStringCodec(),
      // load Effect：从 store 读取当前约束，渲染为文本
      load: Effect.gen(function* () {
        const constraints = yield* store.getAll()
        return renderForLLM(constraints)
      }),
      // baseline：首次渲染就是文本本身
      baseline: (text: string) => text,
      // update：变更时返回完整新状态（OpenCode 自动包含在 Mid-Conversation Message 中）
      update: (_prev: string, current: string) => {
        if (current.includes("No hard constraints")) return "All hard constraints have been removed."
        return `Hard constraints have been updated. Current constraints:\n\n${current}`
      },
      removed: () => "Hard constraints have been cleared.",
    })

    // 注册到 Registry，使其成为 System Context 的一部分
    yield* registry.register({
      key: CONSTRAINTS_KEY,
      load: Effect.succeed(source),
    })
  }),
)

/**
 * 构造 String codec
 *
 * 使用顶部静态 import 的 Schema.String 创建 JSON codec，用于 SystemContext Source。
 */
function makeStringCodec() {
  return Schema.toCodecJson(Schema.String)
}

/**
 * LocationNode 导出
 *
 * deps 包含：
 * - SystemContextRegistry.node：用于注册 source
 * - ConstraintStoreNode：用于读取约束数据
 *
 * LayerNode.group 会自动按依赖拓扑排序初始化。
 */
export const node = makeLocationNode({
  name: "deepcode-hard-constraints",
  layer,
  deps: [SystemContextRegistry.node, ConstraintStoreNode],
})
