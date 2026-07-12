/**
 * DeepCode Harness — 双向 Agent 元指令处理器
 *
 * 模块七：LLM ⇄ Harness 协同决策原语
 *
 * ============================================================
 * 设计背景
 * ============================================================
 *
 * 标准 Agent Loop 是单向的：
 * Harness 组装 prompt → LLM 回复 → Harness 执行工具 → 循环
 *
 * 问题：LLM 在推理中可能需要主动声明需求：
 * - "我需要看更多文件才能判断" → 现在只能说"请给我X文件"
 * - "这个问题太复杂了，需要 Pro" → 没有机制让模型自己升级
 * - "我刚完成了一个复杂步骤，想自我审查" → 需要用户手动触发
 * - "这个模式重复出现了，应该固化为 Skill" → 依赖用户注意
 *
 * 论文 I-02（双向 Agent）提出四个元原语：
 * 1. need_more_context        — 请求更多上下文
 * 2. request_specialized_model — 请求切换模型
 * 3. trigger_self_review      — 触发自我审查
 * 4. propose_skill            — 提议固化 Skill
 *
 * ============================================================
 * 实现策略
 * ============================================================
 *
 * 元指令以特殊 tool_call 形式传递：
 * - LLM 调用这些"工具"时，Harness 拦截并不作为普通工具执行
 * - Harness 执行对应的内部操作（读文件、切换模型、触发审查等）
 * - 返回操作结果给 LLM 作为 tool_result
 *
 * 为什么用 tool_call 而不是新增 meta 字段？
 * 1. tool_call 是 LLM 原生支持的结构化输出（无需修改协议）
 * 2. 与现有 Tool Registry 机制兼容
 * 3. 不侵入 @opencode-ai/llm 的协议层
 *
 * 防滥用：每个原语都有使用上限，超过需要用户确认
 *
 * @module
 */

import { Context, Effect, Layer, Ref } from "effect"
import { makeLocationNode } from "../../effect/app-node"

// ============================================================
// 类型定义
// ============================================================

/** 元原语类型 */
export type MetaDirectiveType =
  | "need_more_context"
  | "request_specialized_model"
  | "request_flash_model"
  | "trigger_self_review"
  | "propose_skill"

/** 元指令结构（LLM 发送的 tool_call 参数） */
export interface MetaDirective {
  type: MetaDirectiveType
  params: Record<string, unknown>
}

/** need_more_context 参数 */
export interface NeedMoreContextParams {
  files?: string[]
  search_terms?: string[]
  reason?: string
}

/** request_specialized_model / request_flash_model 参数 */
export interface RequestModelParams {
  target: "flash" | "pro"
  reason: string
}

/** trigger_self_review 参数 */
export interface TriggerReviewParams {
  focus?: string
  depth?: "quick" | "thorough"
}

/** propose_skill 参数 */
export interface ProposeSkillParams {
  name: string
  description: string
  trigger: string
  body: string
}

/** Harness 对元指令的响应 */
export interface DirectiveResponse {
  type: MetaDirectiveType
  success: boolean
  message: string
  data?: unknown
}

/** 防滥用限制 */
interface RateLimits {
  /** 每个 session 最多模型切换次数 */
  modelSwitchPerSession: number
  /** 每次 need_more_context 最多请求文件数 */
  filesPerContextRequest: number
}

const DEFAULT_LIMITS: RateLimits = {
  modelSwitchPerSession: 5,   // Magic: 5次足够应对正常使用，防止死循环切换
  filesPerContextRequest: 10, // 防止一次性请求整个仓库
}

// ============================================================
// 服务接口
// ============================================================

export interface Interface {
  /**
   * 处理 LLM 发送的元指令
   *
   * @param directive - 元指令（类型+参数）
   * @returns Harness 响应（成功/失败+消息+数据）
   */
  readonly handle: (directive: MetaDirective) => Effect.Effect<DirectiveResponse>

  /**
   * 注册文件读取回调
   *
   * Meta 指令处理器不直接依赖文件系统，通过回调解耦：
   * 上层（SessionRunner）注入实际的文件读取逻辑
   */
  readonly setFileReader: (reader: (path: string) => Effect.Effect<string>) => void

  /**
   * 注册模型切换回调
   * 上层注入实际的模型切换逻辑（修改 Session 的 override tier）
   */
  readonly setModelSwitcher: (
    switcher: (tier: "flash" | "pro", reason: string) => Effect.Effect<void>,
  ) => void
}

/** DI token */
export class Service extends Context.Service<Service, Interface>()(
  "@opencode/v2/DeepCodeMetaDirectives",
) {}

// ============================================================
// Layer 实现
// ============================================================

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 模型切换计数（防滥用）
    const modelSwitchCount = yield* Ref.make(0)
    // 回调函数（由上层 SessionRunner 在初始化时注入）
    let fileReader: ((path: string) => Effect.Effect<string>) | undefined
    let modelSwitcher:
      | ((tier: "flash" | "pro", reason: string) => Effect.Effect<void>)
      | undefined

    return Service.of({
      /**
       * handle：根据 directive.type 分派处理逻辑
       *
       * 每个 case：
       * 1. 解析参数（双重 as 断言避免类型不兼容）
       * 2. 执行防滥用检查
       * 3. 调用对应回调执行操作
       * 4. 返回 DirectiveResponse
       */
      handle: Effect.fn("DeepCodeMetaDirectives.handle")(
        (directive: MetaDirective) =>
          Effect.gen(function* () {
            switch (directive.type) {
              // =============================================
              // need_more_context：读取额外文件
              // =============================================
              case "need_more_context": {
                const params = directive.params as unknown as NeedMoreContextParams
                // 限制文件数量，防止请求整个代码库
                const files = (params.files ?? []).slice(
                  0,
                  DEFAULT_LIMITS.filesPerContextRequest,
                )
                const results: Record<string, string> = {}

                // 通过注入的回调读取每个文件
                if (fileReader) {
                  for (const f of files) {
                    try {
                      results[f] = yield* fileReader(f)
                    } catch {
                      // 文件读取失败不阻断流程，在结果中报告
                      results[f] = `[Error reading file: ${f}]`
                    }
                  }
                }

                return {
                  type: directive.type,
                  success: true,
                  message: `Read ${Object.keys(results).length} files`,
                  data: { files: results, search_terms: params.search_terms },
                }
              }

              // =============================================
              // request_specialized_model / request_flash_model
              // =============================================
              case "request_specialized_model":
              case "request_flash_model": {
                const params = directive.params as unknown as RequestModelParams
                // 确定目标档位（显式 target 或根据指令类型）
                const target =
                  params.target ??
                  (directive.type === "request_flash_model" ? "flash" : "pro")
                const reason = params.reason ?? "Requested by model"

                // 防滥用：检查切换次数
                const count = yield* Ref.get(modelSwitchCount)
                if (count >= DEFAULT_LIMITS.modelSwitchPerSession) {
                  return {
                    type: directive.type,
                    success: false,
                    message: `Model switch limit (${DEFAULT_LIMITS.modelSwitchPerSession}) reached. Manual confirmation required.`,
                  }
                }

                // 计数 +1
                yield* Ref.update(modelSwitchCount, (c) => c + 1)
                // 调用注入的模型切换回调
                if (modelSwitcher) {
                  yield* modelSwitcher(target, reason)
                }

                return {
                  type: directive.type,
                  success: true,
                  message: `Switched to ${target} model`,
                }
              }

              // =============================================
              // trigger_self_review：触发免疫系统审查
              // =============================================
              case "trigger_self_review": {
                // 审查在下次 Checkpoint 时由免疫系统执行
                // 这里只返回确认，实际 review 逻辑在 reviewer.ts
                return {
                  type: directive.type,
                  success: true,
                  message: "Self-review triggered. Review will run at next checkpoint.",
                }
              }

              // =============================================
              // propose_skill：提议固化 Skill
              // =============================================
              case "propose_skill": {
                const params = directive.params as unknown as ProposeSkillParams
                // TODO(阶段三): 验证 Skill 安全性（无危险操作如 rm -rf）后写入磁盘
                // 当前：返回确认，需要用户确认后持久化
                return {
                  type: directive.type,
                  success: true,
                  message: `Skill '${params.name}' proposed. Requires user confirmation before activation.`,
                  data: { skill: params },
                }
              }

              // 未知指令类型
              default:
                return {
                  type: directive.type,
                  success: false,
                  message: `Unknown directive type: ${(directive as any).type}`,
                }
            }
          }),
      ),

      /** 注入文件读取回调 */
      setFileReader: (reader) => {
        fileReader = reader
      },

      /** 注入模型切换回调 */
      setModelSwitcher: (switcher) => {
        modelSwitcher = switcher
      },
    })
  }),
)

/** LocationNode 导出 */
export const node = makeLocationNode({
  name: "deepcode-meta-directives",
  layer,
  deps: [],
})
