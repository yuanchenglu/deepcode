/**
 * 角色注册表。
 *
 * 管理 RoleDefinition 的注册、查找、列举。默认注册 5 个角色：
 * coding-agent / builder-agent / knowledge-agent / planner-agent / system-agent。
 */

import type { RoleDefinition } from "../types"
import { AlreadyRegisteredError, RoleNotFoundError } from "../errors"

export class RoleRegistry {
  private readonly roles = new Map<string, RoleDefinition>()

  /** 注册一个角色。 */
  register(def: RoleDefinition): this {
    if (this.roles.has(def.id)) {
      throw new AlreadyRegisteredError("角色", def.id)
    }
    this.roles.set(def.id, { ...def, tools: [...def.tools], skills: [...def.skills] })
    return this
  }

  /** 按 ID 获取角色（不存在抛错）。 */
  getStrict(id: string): RoleDefinition {
    const r = this.roles.get(id)
    if (!r) throw new RoleNotFoundError(id)
    return r
  }

  /** 按 ID 获取角色（不存在返回 undefined）。 */
  get(id: string): RoleDefinition | undefined {
    return this.roles.get(id)
  }

  /** 是否存在。 */
  has(id: string): boolean {
    return this.roles.has(id)
  }

  /** 列出所有角色。 */
  list(): RoleDefinition[] {
    return [...this.roles.values()]
  }

  /** 注销一个角色。 */
  unregister(id: string): boolean {
    return this.roles.delete(id)
  }
}
