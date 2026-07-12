/**
 * DeepCode Harness — 硬约束会话存储
 *
 * 模块二：KV Cache 硬约束前缀注入 — 存储层
 *
 * ============================================================
 * 职责
 * ============================================================
 *
 * 提供会话级别的硬约束状态管理：
 * - 从用户消息中自动提取约束并添加
 * - 查询当前所有活跃约束
 * - 手动添加约束（免疫系统派生、系统配置注入）
 * - 渲染为 system context 文本
 *
 * 使用 Effect Ref 做内存状态存储（fiber-safe 的原子引用）。
 * 重启丢失可接受：约束是 session-scoped 的，session 重连后可从输入重新提取。
 * DB 持久化标记为 TD-004。
 *
 * @module
 */

// Effect 框架依赖
// Context.Service 用于定义可注入的服务接口
// Layer 用于依赖注入组装
// Ref 是 Effect 的原子可变引用（类似 React useRef，但 Effect 原生）
import { Context, Effect, Layer, Ref } from "effect"
// makeLocationNode 是 OpenCode 的服务注册模式：
// 将 Service + Layer 打包为 LocationNode，可被 location-services.ts 组合
import { makeLocationNode } from "../../effect/app-node"
// 类型和纯函数从 extractor 导入
import type { HardConstraint } from "./extractor"
import { extractHardConstraints, renderConstraints } from "./extractor"

/**
 * 约束存储服务的公开接口
 *
 * 所有方法返回 Effect（副作用描述），调用方用 yield* 组合执行。
 */
export interface Interface {
  /**
   * 从用户消息文本中提取约束并添加到存储
   *
   * @param message - 用户输入原文
   * @returns 本次新增的约束数组（已去重的新约束）
   */
  readonly extractAndAdd: (message: string) => Effect.Effect<HardConstraint[]>
  /** 获取当前所有约束（按添加顺序） */
  readonly getAll: () => Effect.Effect<HardConstraint[]>
  /**
   * 手动批量添加约束（去重后合并）
   *
   * @param constraints - 要添加的约束数组
   */
  readonly add: (constraints: HardConstraint[]) => Effect.Effect<void>
  /** 将当前所有约束渲染为 system context 格式文本 */
  readonly render: () => Effect.Effect<string>
}

/**
 * Context.Service 定义 — DI token
 *
 * 其他模块通过 `yield* DeepCodeConstraintStore.Service` 注入此服务。
 * Tag 字符串 "@opencode/v2/DeepCodeConstraintStore" 在整个 DI 容器中唯一。
 */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeConstraintStore",
) {}

/**
 * Layer 定义：创建服务实例
 *
 * Layer.effect 在依赖注入时执行一次，创建：
 * - Ref<HardConstraint[]>：初始为空数组，用于存储当前 session 的约束
 *
 * Ref.make 是 Effect 操作，所以包装在 Effect.gen 中。
 */
const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 创建可变引用，初始为空约束数组
    const state = yield* Ref.make<HardConstraint[]>([])

    return Service.of({
      /**
       * extractAndAdd：从用户消息提取约束，去重后添加
       *
       * 流程：
       * 1. 调用纯函数 extractHardConstraints 做正则提取
       * 2. 如果有新约束，更新 Ref（用 Ref.update 原子修改）
       * 3. Ref.update 回调中，用 Set 去重（按 id）再追加
       */
      extractAndAdd: Effect.fn("DeepCodeConstraintStore.extractAndAdd")(
        (message: string) =>
          Effect.gen(function* () {
            const extracted = extractHardConstraints(message)
            if (extracted.length > 0) {
              // Ref.update 是原子操作：传入 reducer，返回新状态
              yield* Ref.update(state, (current) => {
                const existingIds = new Set(current.map((c) => c.id))
                const newOnes = extracted.filter((c) => !existingIds.has(c.id))
                return [...current, ...newOnes]
              })
            }
            return extracted
          }),
      ),

      /** getAll：读取 Ref 当前值 */
      getAll: Effect.fn("DeepCodeConstraintStore.getAll")(() => Ref.get(state)),

      /** add：批量添加约束（同 extractAndAdd 的更新逻辑） */
      add: Effect.fn("DeepCodeConstraintStore.add")((constraints: HardConstraint[]) =>
        Ref.update(state, (current) => {
          const existingIds = new Set(current.map((c) => c.id))
          const newOnes = constraints.filter((c) => !existingIds.has(c.id))
          return [...current, ...newOnes]
        }),
      ),

      /**
       * render：读取当前约束，调用纯函数 renderConstraints 格式化
       *
       * 结果是可直接放入 System Context 的 Markdown 文本。
       */
      render: Effect.fn("DeepCodeConstraintStore.render")(() =>
        Effect.gen(function* () {
          const all = yield* Ref.get(state)
          return renderConstraints(all)
        }),
      ),
    })
  }),
)

/** LocationNode 导出，供 location-services.ts 注册 */
export const node = makeLocationNode({
  name: "deepcode-constraint-store",
  layer,
  deps: [], // 无外部依赖（纯内存 Ref）
})
