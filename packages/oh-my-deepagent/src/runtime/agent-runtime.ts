/**
 * AgentRuntime — DeepAgent 的核心入口。
 *
 * 一个 AgentRuntime 实例绑定：角色 + LLM + 工具注册表 + 记忆存储 + 可选技能管理器。
 * 通过 chat() 方法接收用户消息并返回最终文本。
 *
 * 典型流程见 PROJECT_OVERVIEW.md 第四章。
 */

import type {
  AgentRuntimeOptions,
  ChatResult,
  Message,
  RoleDefinition,
} from "../types"
import { runMessageLoop } from "./message-loop"
import { ToolRunner } from "../tool/tool-runner"
import { RoleNotFoundError } from "../errors"

export class AgentRuntime {
  private readonly role: RoleDefinition
  private readonly llm: AgentRuntimeOptions["llm"]
  private readonly registry: AgentRuntimeOptions["registry"]
  private readonly memory: AgentRuntimeOptions["memory"]
  private readonly skillManager?: AgentRuntimeOptions["skillManager"]
  private readonly maxSteps: number
  private readonly logger?: { info: (m: string) => void; warn: (m: string) => void }
  private readonly sessionId: string
  private readonly runner: ToolRunner

  constructor(opts: AgentRuntimeOptions) {
    if (!opts.role) throw new RoleNotFoundError("<none>")
    this.role = opts.role
    this.llm = opts.llm
    this.registry = opts.registry
    this.memory = opts.memory
    this.skillManager = opts.skillManager
    this.maxSteps = opts.maxSteps ?? 8
    this.logger = opts.logger
    this.sessionId = opts.sessionId ?? "default"
    this.runner = new ToolRunner({
      registry: this.registry,
      sessionId: this.sessionId,
      roleId: this.role.id,
      logger: this.logger,
    })
  }

  /** 绑定到一个新的 sessionId，返回共享同一组依赖的新 runtime。 */
  withSession(sessionId: string): AgentRuntime {
    return new AgentRuntime({
      role: this.role,
      llm: this.llm,
      registry: this.registry,
      memory: this.memory,
      skillManager: this.skillManager,
      maxSteps: this.maxSteps,
      logger: this.logger,
      sessionId,
    })
  }

  /**
   * 发起一轮对话。
   *
   * @param userText - 用户消息文本。
   * @returns 最终 assistant 文本与元数据。
   */
  async chat(userText: string): Promise<ChatResult> {
    // 1. 追加用户消息
    const userMsg: Message = { role: "user", content: userText }
    this.memory.append(this.sessionId, userMsg)

    // 2. 组装当前消息列表（从记忆里读完整历史）
    const messages: Message[] = []
    for (const m of this.memory.all(this.sessionId)) {
      messages.push({ ...m })
    }

    // 3. 跑消息循环
    const result = await runMessageLoop({
      role: this.role,
      llm: this.llm,
      registry: this.registry,
      runner: this.runner,
      messages,
      maxSteps: this.maxSteps,
      logger: this.logger,
      sessionId: this.sessionId,
    })

    // 4. 把生成的 assistant/tool 消息追加到记忆（第一条 user 已经追加过）
    // messages 现在是: [system, ...历史(含user), ...generated]
    // 我们只需要追加 generated
    for (const m of result.generated) {
      this.memory.append(this.sessionId, m)
    }

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      stoppedReason: result.stoppedReason,
    }
  }

  /** 清空会话历史。
   * @param sessionId - 可选，指定要清空的会话 ID；不传则清空当前 runtime 的会话。
   */
  resetSession(sessionId?: string): void {
    this.memory.clear(sessionId ?? this.sessionId)
  }

  /** 暴露当前角色定义。 */
  getRole(): RoleDefinition {
    return this.role
  }
}
