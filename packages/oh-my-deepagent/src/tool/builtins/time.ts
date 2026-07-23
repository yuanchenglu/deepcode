/**
 * 内置工具：now。
 *
 * 返回当前时间戳与 ISO 字符串。时间通过参数注入，方便测试。
 */

import type { Tool } from "../../types"

export function createNowTool(clock: { now(): Date } = { now: () => new Date() }): Tool {
  return {
    name: "now",
    description: "返回当前服务器时间。",
    parameters: { type: "object", properties: {} },
    async execute() {
      const d = clock.now()
      return {
        epochMs: d.getTime(),
        iso: d.toISOString(),
      }
    },
  }
}

/** 默认实例，使用真实时钟。 */
export const nowTool: Tool = createNowTool()
