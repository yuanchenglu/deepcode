import {
  LLM,
  LLMClient,
  LLMError,
  LLMEvent,
  Message,
  SystemPart,
  isContextOverflowFailure,
  type ProviderErrorEvent,
} from "@opencode-ai/llm"
import { Cause, DateTime, Effect, FiberSet, Layer, Option, Semaphore, Stream } from "effect"
import { AgentV2 } from "../../agent"
import { Config } from "../../config"
import { Database } from "../../database/database"
import { EventV2 } from "../../event"
import { Location } from "../../location"
import { ModelV2 } from "../../model"
import { PermissionV2 } from "../../permission"
import { ProviderV2 } from "../../provider"
import { QuestionV2 } from "../../question"
import { SystemContext } from "../../system-context/index"
import { SystemContextRegistry } from "../../system-context/registry"
import { SkillGuidance } from "../../skill/guidance"
import { ReferenceGuidance } from "../../reference/guidance"
import { ToolRegistry } from "../../tool/registry"
import { ToolOutputStore } from "../../tool-output-store"
import { SessionContextEpoch } from "../context-epoch"
import { SessionCompaction } from "../compaction"
import { SessionEvent } from "../event"
import { SessionHistory } from "../history"
import { SessionInput } from "../input"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { type RunError, Service } from "./index"
import { SessionRunnerModel } from "./model"
import { createLLMEventPublisher } from "./publish-llm-event"
import { toLLMMessages } from "./to-llm-message"
import { MAX_STEPS_PROMPT } from "./max-steps"
import { Snapshot } from "../../snapshot"
import { makeLocationNode } from "../../effect/app-node"
import { llmClient } from "../../effect/app-node-platform"
// === DeepCode 模块 — 命名空间导入，与现有 AgentV2/ToolRegistry 等风格一致 ===
import * as DeepCodeIntentRouter from "../../deepcode/intent-router/classifier"
import * as DeepCodeModelRouter from "../../deepcode/router/model-router"
import * as DeepCodeReasoningManager from "../../deepcode/reasoning/manager"
import * as DeepCodeWindowManager from "../../deepcode/context-layout/window-manager"
import * as DeepCodeMetaDirectives from "../../deepcode/meta-directives/handlers"
import * as DeepCodeImmuneSystem from "../../deepcode/immune-system/reviewer"
import * as DeepCodeConstraintStore from "../../deepcode/hard-constraint/store"
import * as DeepCodeOKRPlan from "../../deepcode/okr-plan"
import * as DeepCodeReviewAntiDrift from "../../deepcode/review-anti-drift"
import * as DeepCodeScopeCreepGuard from "../../deepcode/scope-creep-guard"
import * as DeepCodeMemoryGranularity from "../../deepcode/memory-granularity"
// === T05: FileSystem / FileSystemSearch — MetaDirectives 真实回调依赖 ===
// 注意：FileSystem.node / FileSystemSearch.node 不加入 deps（测试环境无 /project 目录会导致 Layer 初始化失败）
// 改用 Node.js fs 模块 + location.directory 直接实现文件读取和搜索
import { readFileSync, readdirSync } from "fs"
import path from "path"

/**
 * Runs one durable coding-agent Session until it settles.
 *
 * Keep this as orchestration over smaller collaborators rather than rebuilding the legacy
 * `SessionPrompt` monolith. Implement the unchecked items in small reviewed slices:
 *
 * - Session ownership and controls
 *   - [x] Coordinate one local active drain per Session; explicit resumes join and prompt wakeups coalesce.
 *   - [ ] Replace local ownership with durable multi-node ownership when clustered.
 *   - [ ] Mark busy, retrying, idle, interrupted, or terminal-failure status durably.
 *   - [ ] Honor interruption and reject stale work after runtime attachment replacement.
 *   - [x] Honor optional agent step limits.
 *   - [ ] Bound provider retries and repeated identical tool calls.
 *
 * - Runtime context assembly
 *   - Track V1 runtime-context parity canonically in `specs/v2/session.md`.
 *
 * - One provider turn
 *   - [x] Translate every projected V2 Session message variant into canonical
 *     `@opencode-ai/llm` messages.
 *   - [ ] Resolve policy-filtered built-in, MCP, plugin, and structured-output tool definitions.
 *   - [x] Stream exactly one `llm.stream(request)` provider turn.
 *   - [x] Persist assistant text and usage events incrementally as they arrive.
 *   - [ ] Persist snapshots, patches, and retry notices incrementally as they arrive.
 *   - [x] Persist reasoning, provider errors, and tool-call events incrementally as they arrive.
 *
 * - Tool settlement and continuation
 *   - [x] Durably record each tool call before side effects begin.
 *   - [x] Authorize and execute recorded local calls through a core-owned registry hook.
 *   - [x] Persist typed success, failure, and provider-executed tool outcomes.
 *   - [x] Start each recorded local call eagerly and await all settlements before continuation.
 *   - [ ] Add scoped runtime context, progress updates, attachment normalization,
 *     plugins, and cancellation settlement.
 *   - [x] Reload projected history and start the next explicit provider turn after local tool results.
 *   - [x] Continue for durable user steering accepted during an active provider turn.
 *   - [ ] Continue for compaction or another continuation condition when required.
 *
 * - Post-run maintenance
 *   - [ ] Settle final status and expose durable output events to replayable consumers.
 *   - [ ] Coalesce streamed deltas and add covering projected-history indexes.
 *   - [ ] Update title, summaries, compaction state, and cleanup in bounded background work.
 *
 * Use `llm.stream(request)` for each provider turn. Keep tool execution and continuation here.
 * Durable continuation recovery remains a separate future slice with an explicit retry policy.
 *
 * The current slice loads V2 history, translates it, resolves a model through a core service, and persists one
 * provider turn. Registry definitions are advertised, local tool calls are settled durably, and an
 * explicit loop starts the next provider turn after local settlement. Configured agent step limits bound the loop.
 */

/**
 * 从 session message 提取纯文本
 *
 * Session message 的 content 可能是：
 * - string：直接返回（User/Synthetic 消息的 text 字段）
 * - 其他类型：返回空字符串
 */
function extractMessageText(message: { readonly type: string; readonly text?: string }): string {
  if ((message.type === "user" || message.type === "synthetic") && typeof message.text === "string") {
    return message.text
  }
  return ""
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    const llm = yield* LLMClient.Service
    const agents = yield* AgentV2.Service
    const tools = yield* ToolRegistry.Service
    const models = yield* SessionRunnerModel.Service
    const store = yield* SessionStore.Service
    const location = yield* Location.Service
    const systemContext = yield* SystemContextRegistry.Service
    const skillGuidance = yield* SkillGuidance.Service
    const referenceGuidance = yield* ReferenceGuidance.Service
    const config = yield* Config.Service
    const snapshots = yield* Snapshot.Service
    const db = (yield* Database.Service).db
    // ============================================================
    // DeepCode Service 注入（T01）
    // 在 Layer.effect 顶部获取 10 个 DeepCode Service 实例
    // OKRPlan 也 import 但暂不接入 deps（需 Plan tool 配合，推迟 T05）
    // ============================================================
    const intentRouter = yield* DeepCodeIntentRouter.Service
    const modelRouter = yield* DeepCodeModelRouter.Service
    const reasoningManager = yield* DeepCodeReasoningManager.Service
    const windowManager = yield* DeepCodeWindowManager.Service
    const metaDirectives = yield* DeepCodeMetaDirectives.Service
    const immuneSystem = yield* DeepCodeImmuneSystem.Service
    const constraintStore = yield* DeepCodeConstraintStore.Service
    const reviewAntiDrift = yield* DeepCodeReviewAntiDrift.Service
    const scopeCreepGuard = yield* DeepCodeScopeCreepGuard.Service
    const memoryGranularity = yield* DeepCodeMemoryGranularity.Service

    // ============================================================
    // MetaDirectives 回调注入（T05：真实实现）
    // setFileReader：用 Node.js fs 模块读取文件内容（相对于 location.directory）
    // setModelSwitcher：调用 modelRouter.setOverride 影响下一轮模型选择
    // setSearcher：用 Node.js fs 模块遍历目录搜索匹配文件，读取 top-3 内容
    // 注意：不使用 FileSystem.Service（加入 deps 会导致测试环境的 Layer 初始化失败）
    // ============================================================
    metaDirectives.setFileReader((filePath: string) =>
      Effect.sync(() => {
        try {
          const fullPath = path.resolve(location.directory, filePath)
          if (!fullPath.startsWith(location.directory)) return "" // 安全：防止路径逃逸
          return readFileSync(fullPath, "utf-8")
        } catch {
          return ""
        }
      }),
    )
    metaDirectives.setModelSwitcher((tier: "flash" | "pro", _reason: string) =>
      modelRouter.setOverride(tier),
    )
    metaDirectives.setSearcher((terms: string[]) =>
      Effect.gen(function* () {
        const results: Record<string, string> = {}
        for (const term of terms) {
          // 简化搜索：遍历目录树，按文件名模糊匹配，取 top-3
          const matches = yield* Effect.sync(() => {
            try {
              const found: string[] = []
              const walkDir = (dir: string, depth: number) => {
                if (depth > 3 || found.length >= 3) return // 限制深度和数量
                let entries
                try {
                  entries = readdirSync(dir, { withFileTypes: true })
                } catch {
                  return // 目录不可读则跳过
                }
                for (const entry of entries) {
                  const entryName = String(entry.name)
                  if (entryName.startsWith(".") || entryName === "node_modules") continue
                  const fullPath = path.join(dir, entryName)
                  if (entry.isDirectory()) {
                    walkDir(fullPath, depth + 1)
                  } else if (entryName.toLowerCase().includes(term.toLowerCase())) {
                    found.push(path.relative(location.directory, fullPath))
                    if (found.length >= 3) return
                  }
                }
              }
              walkDir(location.directory, 0)
              return found
            } catch {
              return [] as string[]
            }
          })
          for (const matchPath of matches) {
            const content = yield* Effect.sync(() => {
              try {
                return readFileSync(path.resolve(location.directory, matchPath), "utf-8")
              } catch {
                return ""
              }
            })
            results[matchPath] = content
          }
        }
        return results
      }),
    )
    const compaction = SessionCompaction.make({ events, llm, config: yield* config.entries() })
    const getSession = Effect.fn("SessionRunner.getSession")(function* (sessionID: SessionSchema.ID) {
      const session = yield* store.get(sessionID)
      if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
      return session
    })

    const getContext = Effect.fn("SessionRunner.getContext")(function* (sessionID: SessionSchema.ID) {
      return yield* store.context(sessionID)
    })
    const failInterruptedTools = Effect.fn("SessionRunner.failInterruptedTools")(function* (
      sessionID: SessionSchema.ID,
    ) {
      for (const message of yield* getContext(sessionID)) {
        if (message.type !== "assistant") continue
        for (const tool of message.content) {
          if (tool.type !== "tool" || (tool.state.status !== "pending" && tool.state.status !== "running")) continue
          yield* events.publish(SessionEvent.Tool.Failed, {
            sessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID: message.id,
            callID: tool.id,
            error: { type: "unknown", message: "Tool execution interrupted" },
            provider: {
              executed: tool.provider?.executed === true,
              ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
            },
          })
        }
      }
    })

    const awaitToolFibers = (fibers: FiberSet.FiberSet<void, ToolOutputStore.Error>) =>
      Effect.raceFirst(FiberSet.join(fibers), FiberSet.awaitEmpty(fibers))

    // Match V1: declining a user prompt halts the loop instead of becoming model-facing tool output.
    const isUserDeclined = (cause: Cause.Cause<unknown>) =>
      cause.reasons.some(
        (reason) =>
          Cause.isDieReason(reason) &&
          (reason.defect instanceof PermissionV2.DeclinedError || reason.defect instanceof QuestionV2.RejectedError),
      )

    type TurnTransition =
      // Automatic compaction completed; rebuild the request from compacted history.
      | { readonly _tag: "ContinueAfterCompaction"; readonly step: number }
      // Overflow compaction completed; rebuild once through the path without overflow recovery.
      | { readonly _tag: "ContinueAfterOverflowCompaction"; readonly step: number }

    class TurnTransitionError extends Error {
      constructor(readonly transition: TurnTransition) {
        super()
      }
    }

    const continueAfterCompaction = (step: number) => new TurnTransitionError({ _tag: "ContinueAfterCompaction", step })
    const continueAfterOverflowCompaction = (step: number) =>
      new TurnTransitionError({ _tag: "ContinueAfterOverflowCompaction", step })

    const loadSystemContext = (agent: AgentV2.Selection) =>
      Effect.all([systemContext.load(), skillGuidance.load(agent), referenceGuidance.load()], {
        concurrency: "unbounded",
      }).pipe(Effect.map(SystemContext.combine))

    const runTurnAttempt = Effect.fn("SessionRunner.runTurn")(function* (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      step: number,
      recoverOverflow?: typeof compaction.compactAfterOverflow,
    ) {
      const session = yield* getSession(sessionID)
      if (session.location.directory !== location.directory || session.location.workspaceID !== location.workspaceID)
        return yield* Effect.interrupt
      const agent = yield* agents.select(session.agent)
      const initialized = yield* SessionContextEpoch.initialize(db, loadSystemContext(agent), session.id)
      const toolFibers = yield* FiberSet.make<void, ToolOutputStore.Error>()
      let needsContinuation = false
      let currentStep = step
      if (promotion) {
        const cutoff = yield* EventV2.latestSequence(db, session.id)
        let promoted = 0
        if (promotion === "steer") promoted = yield* SessionInput.promoteSteers(db, events, session.id, cutoff)
        if (promotion === "queue") {
          promoted += Number(yield* SessionInput.promoteNextQueued(db, events, session.id))
          promoted += yield* SessionInput.promoteSteers(db, events, session.id, cutoff)
        }
        if (promoted > 0) currentStep = 1
      }
      const system =
        initialized ?? (yield* SessionContextEpoch.prepare(db, events, loadSystemContext(agent), session.id))
      const model = yield* models.resolve(session)

      const entries = yield* SessionHistory.entriesForRunner(db, session.id, system.baselineSeq)
      const context = entries.map((entry) => entry.message)

      // ============================================================
      // DeepCode 深接入 Hook 点 1：Turn 开始决策链（T02）
      // 意图分类 → 约束提取 → 模型路由记录 → reasoning_effort → 窗口状态
      // 每个 yield* 包裹 Effect.catch，失败不阻断主流程
      // ============================================================

      // --- 1a. 提取最后一条用户消息文本 ---
      const lastUserEntry = [...entries].reverse().find((e) => e.message.type === "user")
      const userMessageText = lastUserEntry
        ? extractMessageText(lastUserEntry.message)
        : ""

      // --- 1b. 硬约束提取（从用户消息中提取硬约束，存入 ConstraintStore）---
      if (userMessageText.length > 0) {
        yield* constraintStore.extractAndAdd(userMessageText).pipe(
          Effect.catch(() => Effect.void), // 约束提取失败不阻断主流程
        )
      }

      // --- 1c. 意图分类（Code-based 快速规则，零 LLM 成本）---
      const intentResult = yield* intentRouter.classify(userMessageText).pipe(
        Effect.catch(() =>
          Effect.succeed({
            intent: "medium" as const,
            confidence: 0.3,
            reason: "Classification failed, defaulting to medium",
          }),
        ),
      )
      yield* intentRouter.setCurrent(intentResult)
      const strategy = intentRouter.getStrategy(intentResult.intent)

      // --- 1d. 模型路由记录 ---
      // 注意：model 已在上方 resolve，此处仅记录决策，不改变当前轮模型。
      // 模型切换通过 setOverride 影响下一轮的 resolve。
      const tier = yield* modelRouter
        .decide({
          turn: currentStep,
          intent: intentResult.intent,
          isCheckpoint: strategy.checkpointFrequency === "high" && currentStep > 1,
          isPlanning: intentResult.intent === "architecture",
        })
        .pipe(Effect.catch(() => Effect.succeed("flash" as const)))

      // --- 1e. reasoning_effort 设置 ---
      const reasoningEffort = yield* reasoningManager
        .getEffort(intentResult.intent, tier)
        .pipe(Effect.catch(() => Effect.succeed("low" as const)))

      // --- 1f. 窗口状态查询 ---
      const windowStatus = yield* windowManager
        .getWindowStatus(tier)
        .pipe(
          Effect.catch(() =>
            Effect.succeed({
              snapshot: {
                prefixTokens: 0,
                anchorTokens: 0,
                activeTokens: 0,
                compressedTokens: 0,
                tailTokens: 0,
                totalTokens: 0,
              },
              tier,
              activeOverflow: false,
              compressionNeeded: false,
              recommendedMaxOutputTokens: 4096, // 安全默认值
              criticalInWindow: true,
              budget:
                tier === "flash"
                  ? { anchorMaxTokens: 128, activeMaxTokens: 256, compressedSoftLimit: 512, outputReserveTokens: 64 }
                  : { anchorMaxTokens: 256, activeMaxTokens: 640, compressedSoftLimit: 1024, outputReserveTokens: 128 },
            }),
          ),
        )

      const isLastStep = agent.info?.steps !== undefined && currentStep >= agent.info.steps
      const toolMaterialization = isLastStep ? undefined : yield* tools.materialize(agent.info?.permissions)
      const promptCacheKey = /^ses_[0-9a-f]{64}$/.test(session.id) ? session.id.slice(4) : session.id
      const request = LLM.request({
        model,
        providerOptions: {
          openai: {
            promptCacheKey,
            // DeepSeek V4 thinking mode：reasoning_effort 控制推理深度
            // TODO: 查 DeepSeek V4 API 文档确认实际 key
            ...(reasoningEffort !== "none" ? { reasoning_effort: reasoningEffort } : {}),
          },
        },
        system: [agent.info?.system, system.baseline]
          .filter((part): part is string => part !== undefined && part.length > 0)
          .map(SystemPart.make),
        messages: [...toLLMMessages(context, model), ...(isLastStep ? [Message.assistant(MAX_STEPS_PROMPT)] : [])],
        tools: toolMaterialization?.definitions ?? [],
        toolChoice: isLastStep ? "none" : undefined,
        // 窗口管理器建议的输出限制（如果窗口溢出则限制输出）
        ...(windowStatus.activeOverflow && windowStatus.recommendedMaxOutputTokens > 0
          ? { generation: { maxTokens: windowStatus.recommendedMaxOutputTokens } }
          : {}),
      })
      if (yield* compaction.compactIfNeeded({ sessionID: session.id, entries, model, request }))
        return yield* Effect.die(continueAfterCompaction(currentStep))
      const startSnapshot = yield* snapshots.capture()
      const publisher = createLLMEventPublisher(events, {
        sessionID: session.id,
        agent: agent.id,
        model: {
          id: ModelV2.ID.make(model.id),
          providerID: ProviderV2.ID.make(model.provider),
          ...(session.model?.variant === undefined ? {} : { variant: session.model.variant }),
        },
        snapshot: startSnapshot,
      })
      const withPublication = Semaphore.makeUnsafe(1).withPermit
      const publish = (event: LLMEvent, outputPaths: ReadonlyArray<string> = []) =>
        withPublication(publisher.publish(event, outputPaths))
      let overflowFailure: ProviderErrorEvent | undefined
      const providerStream = llm.stream(request).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            if (overflowFailure || publisher.hasProviderError()) return
            if (LLMEvent.is.providerError(event)) {
              if (isContextOverflowFailure(event) && !publisher.hasAssistantStarted()) {
                overflowFailure = event
                return
              }
            }
            yield* publish(event)
            if (event.type !== "tool-call" || event.providerExecuted) return
            // ============================================================
            // DeepCode 深接入 Hook 点 2：Tool call 拦截（T03）
            // 元指令拦截 → 范围守卫检查
            // 元指令用精确白名单匹配（5个工具名），不误拦截正常工具
            // 范围检查失败默认允许（不阻断工具执行）
            // ============================================================

            // --- 2a. 元指令拦截 ---
            // 检查是否为 DeepCode 元指令工具调用（精确白名单匹配）
            const META_DIRECTIVE_TYPES = [
              "need_more_context",
              "request_specialized_model",
              "request_flash_model",
              "trigger_self_review",
              "propose_skill",
            ] as const

            const isMetaDirective = META_DIRECTIVE_TYPES.includes(
              event.name as (typeof META_DIRECTIVE_TYPES)[number],
            )

            if (isMetaDirective) {
              // 构造 MetaDirective 并交给处理器
              const directive = {
                type: event.name as DeepCodeMetaDirectives.MetaDirectiveType,
                params: (event.input ?? {}) as Record<string, unknown>,
              }
              const directiveResponse = yield* metaDirectives.handle(directive).pipe(
                Effect.catch(() =>
                  Effect.succeed({
                    type: directive.type,
                    success: false,
                    message: "Directive handling failed",
                  }),
                ),
              )

              // 将处理结果作为 tool_result 发布，跳过正常工具执行
              yield* withPublication(
                publisher.publish(
                  LLMEvent.toolResult({
                    id: event.id,
                    name: event.name,
                    result: { type: "json" as const, value: { success: directiveResponse.success } },
                  }),
                ),
              )
              return // 跳过后续的正常工具执行
            }

            // --- 2b. 范围守卫检查 ---
            // 仅对写操作工具进行检查（read/glob/grep 等读操作跳过）
            const WRITE_TOOLS = ["write", "edit", "apply_patch", "bash"]
            if (WRITE_TOOLS.includes(event.name)) {
              // 从 tool call 参数中提取文件路径
              const toolInput = (event.input ?? {}) as Record<string, unknown>
              const filePath =
                (toolInput.filePath as string) ??
                (toolInput.path as string) ??
                (toolInput.file_path as string) ??
                ""

              if (filePath.length > 0) {
                const accessResult = yield* scopeCreepGuard
                  .checkToolAccess(event.name, filePath)
                  .pipe(
                    Effect.catch(() =>
                      Effect.succeed({
                        allowed: true,
                        reason: "Scope check failed, allowing by default",
                      }),
                    ),
                  )

                if (!accessResult.allowed) {
                  // 阻止工具执行，返回拒绝原因作为 tool_result
                  yield* withPublication(
                    publisher.publish(
                      LLMEvent.toolResult({
                        id: event.id,
                        name: event.name,
                        result: {
                          type: "json" as const,
                          value: { success: false, denied: true },
                        },
                      }),
                    ),
                  )
                  return // 跳过工具执行
                }
              }
            }
            if (!toolMaterialization) {
              yield* withPublication(publisher.failUnsettledTools("Tools are disabled after the maximum agent steps"))
              return
            }
            needsContinuation = true
            const assistantMessageID = yield* publisher.assistantMessageID(event.id)
            yield* Effect.uninterruptibleMask((restore) =>
              restore(
                toolMaterialization.settle({
                  sessionID: session.id,
                  agent: agent.id,
                  assistantMessageID,
                  call: event,
                }),
              ).pipe(
                Effect.flatMap((settlement) =>
                  publish(
                    LLMEvent.toolResult({
                      id: event.id,
                      name: event.name,
                      result: settlement.result,
                      output: settlement.output,
                    }),
                    settlement.outputPaths ?? [],
                  ),
                ),
              ),
            ).pipe(FiberSet.run(toolFibers))
          }),
        ),
        Effect.ensuring(withPublication(publisher.flush())),
      )

      return yield* Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const stream = yield* restore(providerStream).pipe(Effect.exit)
          const failure =
            stream._tag === "Failure" ? Option.getOrUndefined(Cause.findErrorOption(stream.cause)) : undefined
          if (
            recoverOverflow &&
            !publisher.hasAssistantStarted() &&
            isContextOverflowFailure(overflowFailure ?? failure) &&
            (yield* restore(recoverOverflow({ sessionID: session.id, entries, model, request })))
          )
            return yield* Effect.die(continueAfterOverflowCompaction(currentStep))
          if (overflowFailure) yield* publish(overflowFailure)
          const llmFailure = failure instanceof LLMError ? failure : undefined
          if (llmFailure && !publisher.hasProviderError()) {
            yield* withPublication(publisher.failUnsettledTools("Provider did not return a tool result", true))
            yield* withPublication(publisher.failAssistant(llmFailure.reason.message))
          }
          if (stream._tag === "Failure" && Cause.hasInterrupts(stream.cause)) yield* FiberSet.clear(toolFibers)
          const settled = yield* restore(awaitToolFibers(toolFibers)).pipe(Effect.exit)
          if (settled._tag === "Failure" && isUserDeclined(settled.cause)) {
            yield* FiberSet.clear(toolFibers)
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
            return yield* Effect.interrupt
          }
          if (
            (stream._tag === "Failure" && Cause.hasInterrupts(stream.cause)) ||
            (settled._tag === "Failure" && Cause.hasInterrupts(settled.cause))
          ) {
            yield* FiberSet.clear(toolFibers)
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
            if (publisher.hasActiveAssistant())
              yield* withPublication(publisher.failAssistant("Provider turn interrupted"))
          }
          if (settled._tag === "Failure" && !Cause.hasInterrupts(settled.cause)) {
            const failure = Cause.squash(settled.cause)
            const message = failure instanceof Error ? failure.message : String(failure)
            yield* withPublication(publisher.failUnsettledTools(`Tool execution failed: ${message}`))
          }
          const stepSettlement = publisher.stepSettlement()
          // ============================================================
          // DeepCode 深接入 Hook 点 3：Turn 结束审查链（T04）
          // 免疫审查 → 防漂移记录 → 记忆衰减
          // 所有 yield* 包裹 Effect.catch，绝不阻断主流程
          // ============================================================
          if (stepSettlement && !publisher.hasProviderError()) {
            const endSnapshot = yield* snapshots.capture()
            const files =
              startSnapshot && endSnapshot
                ? yield* snapshots
                    .files({ from: startSnapshot, to: endSnapshot })
                    .pipe(Effect.catch(() => Effect.succeed(undefined)))
                : undefined

            // --- 3a. 免疫系统审查 ---
            // 从 ConstraintStore 获取当前硬约束列表
            const constraints = yield* constraintStore.getAll().pipe(
              Effect.catch(() => Effect.succeed([])),
            )

            // 从 files diff 提取产出物描述
            const artifacts: string[] = []
            if (files) {
              for (const file of files) {
                artifacts.push(`Modified: ${file}`)
              }
            }

            // 执行 Checkpoint 审查（仅在有意图且策略要求审查时）
            const shouldReview = strategy?.reviewStrictness !== "none" && constraints.length > 0
            if (shouldReview) {
              const reviewResult = yield* immuneSystem
                .reviewCheckpoint(`step-${currentStep}`, constraints, artifacts)
                .pipe(
                  Effect.catch(() =>
                    Effect.succeed({
                      checkpointId: `step-${currentStep}`,
                      timestamp: Date.now(),
                      violations: [],
                      suggestedSkills: [],
                      passed: true,
                    }),
                  ),
                )

              // 如果发现违规，记录日志（不阻断流程）
              if (!reviewResult.passed) {
                yield* Effect.logWarning("DeepCode ImmuneSystem detected violations", {
                  checkpointId: reviewResult.checkpointId,
                  violationCount: reviewResult.violations.length,
                  violations: reviewResult.violations.map((v) => v.violationDescription),
                })
              }
            }

            // --- 3b. 防漂移记录 ---
            const antiDriftResult = yield* reviewAntiDrift
              .recordToolCall(constraints.length)
              .pipe(
                Effect.catch(() =>
                  Effect.succeed({
                    shouldReview: false,
                    tier: 0 as DeepCodeReviewAntiDrift.ReviewTier,
                  }),
                ),
              )

            // 如果防漂移建议立即审查，记录日志
            if (antiDriftResult.shouldReview) {
              yield* Effect.logInfo("DeepCode AntiDrift suggests review", {
                tier: antiDriftResult.tier,
                step: currentStep,
              })
            }

            // --- 3c. 记忆衰减 ---
            yield* memoryGranularity.endStep().pipe(Effect.catch(() => Effect.void))

            yield* withPublication(
              events.publish(SessionEvent.Step.Ended, {
                sessionID: session.id,
                timestamp: yield* DateTime.now,
                assistantMessageID: yield* publisher.startAssistant(),
                finish: stepSettlement.finish,
                cost: 0,
                tokens: stepSettlement.tokens,
                snapshot: endSnapshot,
                files,
              }),
            )
          }
          if (publisher.hasProviderError())
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
          if (stream._tag === "Success" && !publisher.hasProviderError())
            yield* withPublication(publisher.failUnsettledTools("Provider did not return a tool result", true))
          if (stream._tag === "Failure") return yield* Effect.failCause(stream.cause)
          if (settled._tag === "Failure" && Cause.hasInterrupts(settled.cause))
            return yield* Effect.failCause(settled.cause)
          return { needsContinuation: !publisher.hasProviderError() && needsContinuation, step: currentStep }
        }),
      )
    }, Effect.scoped)
    type RunTurn = (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      step: number,
    ) => Effect.Effect<{ readonly needsContinuation: boolean; readonly step: number }, RunError>

    const runAfterOverflowCompaction: RunTurn = Effect.fnUntraced(function* (sessionID, promotion, step) {
      return yield* runTurnAttempt(sessionID, promotion, step).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* Effect.die("Post-compaction provider attempt cannot recover another overflow")
            yield* Effect.yieldNow
            return yield* runAfterOverflowCompaction(sessionID, undefined, defect.transition.step)
          }),
        ),
      )
    })

    const runTurn: RunTurn = Effect.fnUntraced(function* (sessionID, promotion, step) {
      return yield* runTurnAttempt(sessionID, promotion, step, compaction.compactAfterOverflow).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            yield* Effect.yieldNow
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* runAfterOverflowCompaction(sessionID, undefined, defect.transition.step)
            return yield* runTurn(sessionID, undefined, defect.transition.step)
          }),
        ),
      )
    })

    const run = Effect.fn("SessionRunner.run")(function* (input: {
      readonly sessionID: SessionSchema.ID
      readonly force: boolean
    }) {
      const hasSteer = yield* SessionInput.hasPending(db, input.sessionID, "steer")
      const hasQueue = hasSteer ? false : yield* SessionInput.hasPending(db, input.sessionID, "queue")
      if (!input.force && !hasSteer && !hasQueue) return
      yield* failInterruptedTools(input.sessionID)
      let promotion: SessionInput.Delivery | undefined = hasSteer ? "steer" : hasQueue ? "queue" : undefined
      let shouldRun = input.force || hasSteer || hasQueue
      while (shouldRun) {
        let needsContinuation = true
        let step = 1
        while (needsContinuation) {
          const result = yield* runTurn(input.sessionID, promotion, step)
          needsContinuation = result.needsContinuation
          step = result.step + 1
          promotion = "steer"
          if (!needsContinuation) needsContinuation = yield* SessionInput.hasPending(db, input.sessionID, "steer")
        }
        shouldRun = yield* SessionInput.hasPending(db, input.sessionID, "queue")
        promotion = shouldRun ? "queue" : undefined
      }
    })

    return Service.of({
      run,
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [
    // === 现有 13 个依赖（不变）===
    EventV2.node,
    llmClient,
    AgentV2.node,
    ToolRegistry.node,
    SessionRunnerModel.node,
    SessionStore.node,
    Location.node,
    SystemContextRegistry.node,
    SkillGuidance.node,
    ReferenceGuidance.node,
    Config.node,
    Snapshot.node,
    Database.node,
    // === DeepCode 模块依赖（新增，T01）===
    DeepCodeIntentRouter.node,
    DeepCodeModelRouter.node,
    DeepCodeReasoningManager.node,
    DeepCodeWindowManager.node,
    DeepCodeMetaDirectives.node,
    DeepCodeImmuneSystem.node,
    DeepCodeConstraintStore.node,
    DeepCodeReviewAntiDrift.node,
    DeepCodeScopeCreepGuard.node,
    DeepCodeMemoryGranularity.node,
    // P1 暂缓：DeepCodeOKRPlan.node（需要 Plan tool 配合）
    // T05: FileSystem.node / FileSystemSearch.node 不加入 deps
    //   原因：测试环境 Location.directory="/project" 不存在，FileSystem 层初始化会失败
    //   替代方案：MetaDirectives 回调直接用 Node.js fs 模块 + location.directory
  ],
})
