/**
 * DeepAgent 公共类型定义。
 *
 * 本文件定义了 Agent 运行时、工具、技能、记忆、规划、角色等子系统共用的类型。
 * 所有类型均为纯数据结构，不包含业务逻辑。
 */

/** 消息角色。 */
export type MessageRole = "user" | "assistant" | "system" | "tool"

/** 工具调用请求（由 LLM 输出，runtime 负责执行）。 */
export interface ToolCall {
  /** 工具调用唯一 ID，用于将 tool 结果与调用关联。 */
  id: string
  /** 工具名。 */
  name: string
  /** 工具参数，已经被 JSON 解析为对象。 */
  arguments: Record<string, unknown>
}

/** 一条对话消息。 */
export interface Message {
  /** 消息角色。 */
  role: MessageRole
  /** 文本内容。tool 角色的 content 为工具返回结果（可能是 JSON 字符串）。 */
  content: string
  /** assistant 消息可选：LLM 请求的工具调用列表。 */
  toolCalls?: ToolCall[]
  /** tool 消息必填：对应的工具调用 ID。 */
  toolCallId?: string
  /** tool 消息可选：工具名。 */
  name?: string
}

/** LLM 响应。 */
export interface LLMResponse {
  /** 文本内容；若有工具调用可为空字符串。 */
  content: string
  /** 可选工具调用请求。 */
  toolCalls?: ToolCall[]
}

/**
 * LLM 提供者接口。
 *
 * 实现者负责与具体模型对话。DeepAgent 不绑定任何具体 provider，
 * 生产环境由调用方注入（例如 DeepCode 的 `@opencode-ai/llm`），
 * 测试用 `MockLLMProvider`。
 */
export interface LLMProvider {
  /**
   * 发送一轮对话给模型。
   *
   * @param messages - 当前会话消息列表（含 system / 历史 user/assistant/tool）。
   * @param tools - 本次可被模型调用的工具描述列表。
   * @returns 模型响应，可能包含文本和/或工具调用。
   */
  chat(messages: Message[], tools: ToolDescriptor[]): Promise<LLMResponse>
}

/** JSON 原始类型。 */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** 工具参数模式（简化的 JSON-Schema 子集，用于校验与生成 tool descriptor）。 */
export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "object" | "array"
  /** 对 object 类型：字段定义。 */
  properties?: Record<string, ParameterSchema>
  /** 对 object 类型：必填字段。 */
  required?: string[]
  /** 对 array 类型：元素类型。 */
  items?: ParameterSchema
  /** 字段描述。 */
  description?: string
}

/** 交给 LLM 的工具描述。 */
export interface ToolDescriptor {
  name: string
  description: string
  parameters: ParameterSchema
}

/** 工具执行时传入的上下文。 */
export interface ToolExecutionContext {
  /** 工具调用 ID，便于把日志与调用关联。 */
  toolCallId: string
  /** 当前会话 ID。 */
  sessionId: string
  /** 当前角色 ID。 */
  roleId: string
  /** 可用于记录日志的可选 logger。 */
  logger?: { info: (m: string) => void; warn: (m: string) => void }
}

/** 工具定义。 */
export interface Tool {
  name: string
  description: string
  parameters: ParameterSchema
  /**
   * 执行工具。
   * @param args - 已根据 parameters 校验过的参数对象。
   * @param ctx  - 执行上下文。
   * @returns 可 JSON 序列化的结果；DeepAgent 会用 JSON.stringify 写入消息。
   */
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<unknown> | unknown
}

/** 工具执行成功 / 失败后的归一化结果。 */
export interface ToolResult {
  /** 对应的工具调用 ID。 */
  toolCallId: string
  /** 工具名。 */
  name: string
  /** 是否为错误结果。 */
  isError: boolean
  /** 结果内容（已经序列化为字符串）。 */
  content: string
}

/** 技能模块。 */
export interface Skill {
  /** 技能名，全局唯一。 */
  name: string
  /** 一句话描述，供模型和人看。 */
  description: string
  /** 触发关键词（可选），用于 slash 命令或自动匹配。 */
  triggers?: string[]
  /** 技能激活时注册的工具列表；技能卸载时一并注销。 */
  tools?: Tool[]
  /** 激活时回调。 */
  onLoad?: () => Promise<void> | void
  /** 卸载时回调。 */
  onUnload?: () => Promise<void> | void
}

/** 已加载技能的运行时记录。 */
export interface LoadedSkill extends Skill {
  /** 加载来源目录（便于调试）。 */
  sourceDir?: string
}

/** 计划中的一步。 */
export type StepStatus = "pending" | "running" | "done" | "failed"

export interface Step {
  /** 步骤 ID（在同一 Plan 内唯一）。 */
  id: string
  /** 步骤描述。 */
  description: string
  /** 当前状态。 */
  status: StepStatus
  /** 完成后写入的结果摘要（可选）。 */
  result?: string
  /** 失败时的错误信息（可选）。 */
  error?: string
}

/** 执行计划。 */
export interface Plan {
  /** 目标描述（用户的原始诉求）。 */
  goal: string
  /** 拆解后的步骤。 */
  steps: Step[]
  /** 计划状态。 */
  status: "pending" | "running" | "done" | "failed"
}

/** 角色定义。 */
export interface RoleDefinition {
  /** 角色 ID（kebab-case，全局唯一）。 */
  id: string
  /** 给用户看的展示名。 */
  displayName: string
  /** 系统提示词模板。可使用 {role} 占位符。 */
  systemPrompt: string
  /** 该角色默认可用的工具名。 */
  tools: string[]
  /** 该角色默认加载的技能名。 */
  skills: string[]
  /** 偏好的模型标识（仅作元数据，runtime 不直接使用）。 */
  model?: string
}

/** AgentRuntime 构造参数。 */
export interface AgentRuntimeOptions {
  role: RoleDefinition
  llm: LLMProvider
  registry: ToolRegistryLike
  memory: MemoryStoreLike
  skillManager?: SkillManagerLike
  /** 最大工具调用轮次（防止死循环），默认 8。 */
  maxSteps?: number
  /** 日志器（可选）。 */
  logger?: { info: (m: string) => void; warn: (m: string) => void }
  /** 会话 ID（可选），默认 "default"。 */
  sessionId?: string
}

/** chat() 返回结果。 */
export interface ChatResult {
  /** 最终 assistant 文本。 */
  text: string
  /** 本轮累计的工具调用次数。 */
  toolCalls: number
  /** 本轮是否触发了最大步数限制。 */
  stoppedReason: "completed" | "max-steps"
}

// ------- 最小结构类型（避免循环依赖）-------
/* 这些接口只声明 runtime 需要的方法子集，由具体实现类提供。 */

export interface ToolRegistryLike {
  get(name: string): Tool | undefined
  has(name: string): boolean
  list(): Tool[]
  descriptors(): ToolDescriptor[]
}

export interface MemoryStoreLike {
  all(sessionId: string): Message[]
  append(sessionId: string, message: Message): void
  clear(sessionId: string): void
}

export interface SkillManagerLike {
  list(): LoadedSkill[]
  get(name: string): LoadedSkill | undefined
}
