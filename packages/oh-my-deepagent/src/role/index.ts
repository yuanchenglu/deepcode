/**
 * Role 子系统出口。
 */

export { RoleRegistry } from "./role-registry"
export { defineRole, renderSystemPrompt } from "./role-definition"
export { coding, codingMini } from "./coding-agent"
export { builder } from "./builder-agent"
export { knowledge } from "./knowledge-agent"
export { planner } from "./planner-agent"
export { system } from "./system-agent"
export { coordinator } from "./coordinator-agent"
export { search } from "./search-agent"

import type { RoleDefinition } from "../types"
import { RoleRegistry } from "./role-registry"
import { coding, codingMini } from "./coding-agent"
import { builder } from "./builder-agent"
import { knowledge } from "./knowledge-agent"
import { planner } from "./planner-agent"
import { system } from "./system-agent"
import { coordinator } from "./coordinator-agent"
import { search } from "./search-agent"

/** 默认 5+1 个角色，调用方可一次性注册到 RoleRegistry。 */
export const defaultRoles: Record<string, RoleDefinition> = {
  coding,
  codingMini,
  builder,
  knowledge,
  planner,
  system,
  coordinator,
  search,
}

/** 便捷函数：创建一个已注册全部默认角色的 RoleRegistry。 */
export function createDefaultRoleRegistry(): RoleRegistry {
  const registry = new RoleRegistry()
  for (const role of Object.values(defaultRoles)) registry.register(role)
  return registry
}
