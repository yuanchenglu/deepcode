/**
 * 工具注册表。
 *
 * 负责工具的注册、注销、查找、列举，以及生成供 LLM 消费的 ToolDescriptor 列表。
 */

import type { Tool, ToolDescriptor, ToolRegistryLike } from "../types"
import { AlreadyRegisteredError } from "../errors"

/** 工具注册表实现。 */
export class ToolRegistry implements ToolRegistryLike {
  /** 以工具名为键的内部 Map。 */
  private readonly tools = new Map<string, Tool>()

  /**
   * 注册一个工具。
   * @param tool - 工具定义。
   * @throws AlreadyRegisteredError 同名工具已存在时抛出。
   */
  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new AlreadyRegisteredError("工具", tool.name)
    }
    this.tools.set(tool.name, tool)
    return this
  }

  /**
   * 注销一个工具。
   * @param name - 工具名。
   * @returns 是否成功注销（不存在时返回 false）。
   */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /** 按名获取工具，不存在返回 undefined。 */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /** 是否已注册某工具。 */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /** 返回所有已注册工具（按注册顺序）。 */
  list(): Tool[] {
    return [...this.tools.values()]
  }

  /** 生成给 LLM 的工具描述列表。 */
  descriptors(): ToolDescriptor[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  /** 清空所有工具（主要用于测试）。 */
  clear(): void {
    this.tools.clear()
  }
}
