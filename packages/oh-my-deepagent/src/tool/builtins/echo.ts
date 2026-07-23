/**
 * 内置工具：echo。
 *
 * 原样返回输入的文本，用于测试和最小化验证。
 */

import type { Tool } from "../../types"

export const echoTool: Tool = {
  name: "echo",
  description: "原样返回输入的文本，用于测试连通性。",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "要回显的文本" },
    },
    required: ["text"],
  },
  async execute({ text }) {
    return { echoed: text }
  },
}
