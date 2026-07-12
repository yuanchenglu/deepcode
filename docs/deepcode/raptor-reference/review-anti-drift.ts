/**
 * Review切换防漂移模块（论文I-07）
 *
 * 核心问题：
 * 注意力稀释物理定律——随着K(tool调用轮次)和P(约束/需求数)增长，
 * 模型对原始目标的注意力权重单调递减。这是CSA+HCA+MQA的物理结果，不是prompt能解决的。
 *
 * 根因：
 * KV Cache中HCA(ratio=128)会将远距离上下文的注意力稀释到1/128，
 * 所以"开头说的不要修改A文件"在20轮后模型基本看不见。
 *
 * 方案核心：
 * 审查深度是f(K,P)的二维动态函数，不是固定"每N步review一次"。
 * 四档梯度补偿：轻量自检→标准review→深度review→原点回拉review，
 * 每档补偿不同程度的注意力衰减。
 *
 * 工程化设计：
 * - K = 当前已完成的tool call轮次（衡量时间距离）
 * - P = 当前已知硬约束数量（衡量认知负荷）
 * - f(K,P) = ceil(log(K) * (1 + P/10)) 决定审查档位
 * - 档位0: 不审查（每步默认）
 * - 档位1: 轻量自检（当前step是否满足关联KR）
 * - 档位2: 标准review（所有进行中/已完成step对照KR）
 * - 档位3: 深度review（所有KR对照原始Objective，检测scope creep）
 * - 档位4: 原点回拉review（重新注入L1硬约束+Objective到当前上下文，对抗最大注意力衰减）
 * - 每档review的prompt强度递增，token预算递增
 */

// Effect生态核心依赖：Effect用于副作用管理，Layer用于依赖注入，Ref用于可变状态引用，Schema用于数据校验
import { Context, Effect, Layer, Ref, Schema } from "effect"
// 引入应用节点工厂函数，用于将Service注册为可定位的系统节点
import { makeLocationNode } from "../effect/app-node"

/**
 * 审查档位枚举类型
 * 0=不审查, 1=轻量自检, 2=标准审查, 3=深度审查, 4=原点回拉审查
 * 数值越高，审查范围越广、回拉力度越大、token消耗越多
 */
export type ReviewTier = 0 | 1 | 2 | 3 | 4

/**
 * 审查结果数据结构
 * 每次审查完成后生成，用于记录漂移检测结果和后续建议
 */
export interface ReviewResult {
  /** 本次审查使用的档位 */
  readonly tier: ReviewTier
  /** 触发审查时的tool call轮次 */
  readonly turn: number
  /** 是否检测到目标漂移 */
  readonly driftDetected: boolean
  /** 漂移的具体描述（仅当driftDetected=true时存在） */
  readonly driftDescription?: string
  /** 修正建议列表，供后续步骤执行 */
  readonly suggestions: readonly string[]
  /** 需要重新注入上下文的硬约束列表（档位4时使用） */
  readonly constraintsToReinject: readonly string[]
}

/**
 * 防漂移审查服务
 *
 * 使用Effect.Service模式定义，支持依赖注入和Layer管理。
 * 内部通过Ref维护可变状态（toolCallCount、constraintCount等），
 * 对外暴露纯函数式API。
 */
export class Service extends Context.Service<Service, Interface>()("@opencode/v2/DeepCode/ReviewAntiDrift") {}

// Layer: 服务实现
const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // 可变状态引用，存储在Ref中以保证Effect的纯函数式并发安全
    const stateRef = yield* Ref.make({
      toolCallCount: 0,      // 已完成的tool call总轮次（K值）
      constraintCount: 0,    // 当前已知硬约束数量（P值），取历史最大值
      lastReviewTier: 0 as ReviewTier,  // 上一次审查的档位，用于判断是否需要升档审查
      reviews: [] as ReviewResult[],    // 审查历史记录，最多保留最近20条
    })

    /**
     * 计算审查深度f(K,P)
     *
     * 公式：tier = min(4, floor(ln(K+1) * (1 + P/12)))
     *
     * 设计理由：
     * - ln(K+1)：轮次增长是对数效应，10轮需要1档，50轮需要2档，200轮需要3档，1000轮需要4档
     * - (1+P/12)：每12个约束增加一档审查深度
     * - min(4, ...)：最多4档
     * - 这是物理补偿，不是可调参数——HCA ratio=128对应K>128时注意力严重稀释
     *
     * @param K - 当前tool call轮次（时间距离指标）
     * @param P - 当前硬约束数量（认知负荷指标）
     * @returns 计算出的审查档位 (0-4)
     */
    const computeTier = (K: number, P: number): ReviewTier => {
      // 前3步任务刚启动，上下文信息新鲜，无需审查
      if (K < 3) return 0
      // 基础值：自然对数使轮次增长呈亚线性，约束因子使多约束任务更早触发深度审查
      const base = Math.log(K + 1) * (1 + P / 12)
      // 向下取整得到整数档位
      const tier = Math.floor(base)
      // 钳位到[0,4]范围，确保不超出定义的档位
      return Math.min(4, Math.max(0, tier)) as ReviewTier
    }

    /**
     * 记录一次tool call（在tool execute完成后调用）
     *
     * 每次tool执行完毕后调用此函数更新内部状态，
     * 并根据f(K,P)计算结果判断是否需要触发审查。
     * 只有当档位提升或已达最高档(4)时才触发审查，避免同档位重复审查浪费token。
     *
     * @param constraintCount - 当前已知的硬约束数量
     * @returns shouldReview表示是否需要立即触发审查，tier表示应使用的审查档位
     */
    const recordToolCall = (
      constraintCount: number,
    ): Effect.Effect<{ shouldReview: boolean; tier: ReviewTier }> =>
      Ref.updateAndGet(stateRef, (s) => ({
        ...s,
        // tool call轮次+1
        toolCallCount: s.toolCallCount + 1,
        // 约束数取历史最大值（约束只增不减，已发现的硬约束不会消失）
        constraintCount: Math.max(s.constraintCount, constraintCount),
      })).pipe(
        Effect.map((s) => {
          // 根据最新的K和P计算当前应处档位
          const tier = computeTier(s.toolCallCount, s.constraintCount)
          // 触发条件：档位升高（需要更强审查）或已达4档（持续最高级监控）
          // 档位降低时不触发，因为降档意味着注意力充足无需额外审查
          const shouldReview = tier > s.lastReviewTier || tier === 4
          return { shouldReview, tier }
        }),
      )

    /**
     * 生成对应档位的审查prompt
     *
     * 不同档位生成不同强度的审查指令：
     * - Tier1: 聚焦当前步骤，轻量快速
     * - Tier2: 覆盖所有步骤，对照KR检查
     * - Tier3: 从Objective出发全局检查，检测scope creep
     * - Tier4: 强制原点回拉，重新注入原始信息
     *
     * @param tier - 审查档位
     * @param currentStep - 当前正在执行的步骤描述（可选）
     * @returns 拼接好的审查prompt字符串，档位0返回空字符串
     */
    const buildReviewPrompt = (tier: ReviewTier, currentStep?: string): string => {
      switch (tier) {
        case 0:
          // 档位0不审查，返回空字符串
          return ""
        case 1:
          // 轻量自检：仅检查当前步骤方向是否正确，token开销最小
          return `[轻量自检-Tier1] 当前步骤"${currentStep ?? "当前工作"}"是否正在朝正确方向进行？是否满足关联的验收标准？如有偏差立即修正。`
        case 2:
          // 标准审查：检查所有步骤与KR的对应关系，检测步骤级偏离
          return `[标准审查-Tier2] 检查所有已完成和进行中的步骤：
1. 每个步骤的结果是否满足其验收条件(acceptance)？
2. 是否有步骤偏离了对应的Key Result？
3. 当前正在做的事情是否属于计划内的步骤？
如发现问题，立即通过级联修正(cascade)调整后续步骤。`
        case 3:
          // 深度审查：从原始Objective出发全局检查，检测scope creep和KR遗漏
          return `[深度审查-Tier3] 从原始Objective出发做全局检查：
1. 所有已完成的工作是否都在为Objective服务？
2. 是否存在Scope Creep（做了计划外的事情）？
3. 是否有KR被遗忘或绕过？
4. 硬约束列表是否都在被遵守？
5. 是否有假设发生了变化，需要cascade更新计划？
如发现漂移，必须：a)停止当前无效工作 b)cascade修正计划 c)重新聚焦Objective。`
        case 4:
          // 原点回拉审查：最高级别，警告可能的严重漂移，强制重新加载原始信息
          // 这是对抗HCA 128x注意力稀释的最后手段
          return `[原点回拉审查-Tier4⚠️] 警告：你已经进行了大量操作，由于注意力稀释，你很可能已经偏离了原始目标！
立即执行以下操作：
1. 重新阅读原始Objective和所有硬约束（不要依赖记忆！重新加载！）
2. 逐项对照KR检查：哪些完成了？哪些被完全忽略了？
3. 列出你最近5步做了什么——它们是否真的在推进Objective？
4. 如果发现你在做与原始目标无关的事情，立即停止
5. 通过need_more_context重新获取原始任务描述
这是对抗HCA注意力128x稀释的强制回拉机制，不是建议。`
      }
    }

    /**
     * 记录审查结果
     *
     * 在审查执行完毕后调用，更新lastReviewTier并追加审查记录。
     * 审查历史最多保留20条，防止内存无限增长。
     *
     * @param result - 审查结果对象
     */
    const recordReview = (result: ReviewResult): Effect.Effect<void> =>
      Ref.update(stateRef, (s) => ({
        ...s,
        // 更新上一次审查档位，用于后续判断是否需要升档
        lastReviewTier: result.tier,
        // 保留最近20次审查记录（slice(-19) + 新记录 = 最多20条）
        reviews: [...s.reviews.slice(-19), result],
      }))

    /**
     * 档位4原点回拉：生成需要重新注入上下文的内容
     *
     * 这是物理性对抗HCA稀释的最后手段——把关键信息（Objective、硬约束、未完成KR）
     * 重新放到最近的上下文位置，利用注意力的局部性特性让模型"重新看见"原始目标。
     *
     * 注入的内容被包裹在<attention-reinjection>标签中，便于识别和解析。
     *
     * @param objective - 原始任务目标描述
     * @param constraints - 必须遵守的硬约束列表
     * @param pendingKRs - 尚未完成的Key Result列表
     * @returns 格式化后的注入内容字符串
     */
    const getReinjectionContent = (
      objective: string,
      constraints: readonly string[],
      pendingKRs: readonly string[],
    ): string => {
      const lines = ["<attention-reinjection>"]
      // 顶部警告：明确告知模型以下信息是重新注入的，必须严格遵守
      lines.push("【注意：以下信息因注意力稀释已被重新注入，请严格遵守】")
      // 注入原始目标
      lines.push(`\n原始目标: ${objective}`)
      // 注入硬约束列表（如果有）
      if (constraints.length > 0) {
        lines.push("\n必须遵守的硬约束:")
        for (const c of constraints) lines.push(`- ${c}`)
      }
      // 注入尚未完成的KR列表（如果有），带编号便于对照
      if (pendingKRs.length > 0) {
        lines.push("\n尚未完成的验收标准:")
        for (let i = 0; i < pendingKRs.length; i++) lines.push(`- KR${i}: ${pendingKRs[i]}`)
      }
      // 底部提示：要求模型确认当前工作方向
      lines.push("\n请对照以上信息，确认你当前的工作没有偏离目标。")
      lines.push("</attention-reinjection>")
      return lines.join("\n")
    }

    /**
     * 获取最近的审查结果列表
     *
     * @returns 只读的审查结果数组（最近20条以内）
     */
    const getRecentReviews = (): Effect.Effect<readonly ReviewResult[]> =>
      Ref.get(stateRef).pipe(Effect.map((s) => s.reviews))

    /**
     * 重置状态（新任务开始时调用）
     *
     * 将所有计数器和历史记录清零，用于开始一个全新的任务时避免旧状态干扰。
     */
    const reset = (): Effect.Effect<void> =>
      Ref.set(stateRef, { toolCallCount: 0, constraintCount: 0, lastReviewTier: 0, reviews: [] })

    /**
     * 获取当前状态统计
     *
     * 用于调试和监控，返回当前的K值、P值和计算出的审查档位。
     *
     * @returns 包含K(toolCallCount)、P(constraintCount)、currentTier的对象
     */
    const getStats = (): Effect.Effect<{ K: number; P: number; currentTier: ReviewTier }> =>
      Ref.get(stateRef).pipe(
        Effect.map((s) => ({
          K: s.toolCallCount,
          P: s.constraintCount,
          currentTier: computeTier(s.toolCallCount, s.constraintCount),
        })),
      )

    // 组装并返回Service对象，暴露所有公共方法
    return Service.of({
      computeTier,            // 计算审查档位（纯函数，可独立调用）
      recordToolCall,         // 记录tool call并判断是否需要审查
      buildReviewPrompt,      // 生成审查prompt
      recordReview,           // 记录审查结果
      getReinjectionContent,  // 获取原点回拉注入内容
      getRecentReviews,       // 获取审查历史
      reset,                  // 重置状态
      getStats,               // 获取状态统计
    })
  }),
)
),
}) {}

// TODO(I-07): 在每次tool execute完成后调用recordToolCall
//   - 集成点：tool执行生命周期的afterExecute钩子
//   - 需要传入当前constraintCount（从计划/约束管理器获取）
// TODO(I-07): 当shouldReview=true时，将buildReviewPrompt结果作为Mid-Conversation Message注入
//   - 集成点：消息流中插入审查消息，触发模型自省
//   - 位置应在当前tool result之后、下一个assistant turn之前
// TODO(I-07): tier=4时，通过System Context reinjection机制把约束重新注入最近上下文
//   - 集成点：调用getReinjectionContent生成内容，作为system reminder或高优先级user message注入
//   - 注入后应要求模型先完成回拉审查再继续任务执行

/**
 * 模块导出节点定义
 *
 * 使用makeLocationNode将Service注册为系统中可定位的节点，
 * name用于服务发现和日志追踪，layer默认使用layer（即Live实现），
 * deps为空表示该服务无外部依赖（内部状态自包含）。
 */
export const node = makeLocationNode({
  name: "deepcode-review-anti-drift",  // 节点唯一标识名称
  service: Service,                    // 服务类引用
  layer: layer,              // 默认使用Live层（生产实现）
  deps: [],                            // 无外部服务依赖
})
