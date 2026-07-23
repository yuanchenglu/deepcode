/**
 * DeepAgent — DeepCode 自有的 Agent 系统。
 *
 * 顶层出口：一站式导入所有子系统。
 */

export * from "./types"
export * from "./errors"

export { AgentRuntime, runMessageLoop } from "./runtime"
export type { MessageLoopInput, MessageLoopResult } from "./runtime"

export {
  ToolRegistry,
  ToolRunner,
  validateArgs,
  echoTool,
  calculatorTool,
  nowTool,
  createNowTool,
  createPlanReader,
  builtinTools,
} from "./tool"
export type { ToolRunnerOptions } from "./tool"

export {
  SkillManager,
  parseSkillFromDir,
  parseSkillMarkdown,
  scanSkillDirs,
  toSkill,
} from "./skill"
export type { SkillManagerOptions, ParsedSkill } from "./skill"

export {
  MemoryStore,
  FileMemoryPersistence,
  InMemoryPersistence,
  SessionMemory,
} from "./memory"
export type { MemoryStoreOptions, MemoryPersistence, PersistedSession } from "./memory"

export {
  Planner,
  PlanExecutor,
  emptyPlan,
  stepsFromDescriptions,
  makeStepId,
  tally,
} from "./planning"
export type { PlannerOptions, PlanExecutorOptions, StepHandler } from "./planning"

export {
  RoleRegistry,
  defineRole,
  renderSystemPrompt,
  codingAgent,
  codingAgentMini,
  builderAgent,
  knowledgeAgent,
  plannerAgent,
  systemAgent,
  defaultRoles,
  createDefaultRoleRegistry,
} from "./role"

export { MockLLMProvider } from "./llm"
export type { ScriptStep, MockLLMOptions } from "./llm"

export {
  OpenAICompatibleProvider,
  AnthropicCompatibleProvider,
  messagesToOpenAI,
  descriptorsToOpenAI,
  parseOpenAIResponse,
  messagesToAnthropic,
  descriptorsToAnthropic,
  parseAnthropicResponse,
  LLMError,
  LLMAuthError,
  LLMRateLimitError,
  LLMTimeoutError,
} from "./llm"
export type { OpenAICompatibleOptions, AnthropicCompatibleOptions } from "./llm"

export {
  InProcessTransport,
  HTTPTransport,
  CLITransport,
  ErrorCodes,
} from "./transport"
export type {
  InProcessTransportOptions,
  HTTPTransportOptions,
  CLITransportOptions,
  CommandResult,
  ChatRequestEnvelope,
  ChatResponseEnvelope,
  StreamEvent,
  StreamEventType,
  ErrorEnvelope,
  ErrorCode,
} from "./transport"
