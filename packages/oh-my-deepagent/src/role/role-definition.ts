/**
 * 角色定义相关类型别名与工具。
 */

import type { RoleDefinition } from "../types"

/** 创建角色定义的便捷函数。 */
export function defineRole(def: RoleDefinition): RoleDefinition {
  return { ...def, tools: [...def.tools], skills: [...def.skills] }
}

/** 把角色系统提示词中的 {role} 占位符替换为 displayName。 */
export function renderSystemPrompt(role: RoleDefinition): string {
  return role.systemPrompt.replace(/\{role\}/g, role.displayName)
}
