/**
 * Role 子系统出口。
 */

export { RoleRegistry } from "./role-registry"
export { defineRole, renderSystemPrompt } from "./role-definition"
export { codingAgent, codingAgentMini } from "./coding-agent"
export { builderAgent } from "./builder-agent"
export { knowledgeAgent } from "./knowledge-agent"
export { plannerAgent } from "./planner-agent"
export { systemAgent } from "./system-agent"
export { coordinatorAgent } from "./coordinator-agent"
export { searchAgent } from "./search-agent"

import type { RoleDefinition } from "../types"
import { RoleRegistry } from "./role-registry"
import { codingAgent, codingAgentMini } from "./coding-agent"
import { builderAgent } from "./builder-agent"
import { knowledgeAgent } from "./knowledge-agent"
import { plannerAgent } from "./planner-agent"
import { systemAgent } from "./system-agent"
import { coordinatorAgent } from "./coordinator-agent"
import { searchAgent } from "./search-agent"

/** 默认 5+1 个角色，调用方可一次性注册到 RoleRegistry。 */
export const defaultRoles: Record<string, RoleDefinition> = {
  codingAgent,
  codingAgentMini,
  builderAgent,
  knowledgeAgent,
  plannerAgent,
  systemAgent,
  coordinatorAgent,
  searchAgent,
}

/** 便捷函数：创建一个已注册全部默认角色的 RoleRegistry。 */
export function createDefaultRoleRegistry(): RoleRegistry {
  const registry = new RoleRegistry()
  for (const role of Object.values(defaultRoles)) registry.register(role)
  return registry
}
