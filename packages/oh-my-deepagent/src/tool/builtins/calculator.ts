/**
 * 内置工具：calculator。
 *
 * 安全地计算一个算术表达式。仅支持 +、-、*、/、括号、数字与小数点；
 * 使用白名单字符过滤，避免任意代码执行。
 */

import type { Tool } from "../../types"
import { ToolArgumentError } from "../../errors"

export const calculatorTool: Tool = {
  name: "calculator",
  description: "计算一个数学表达式（支持 + - * / 和括号）。",
  parameters: {
    type: "object",
    properties: {
      expression: { type: "string", description: "要计算的表达式，如 '1 + 2 * 3'" },
    },
    required: ["expression"],
  },
  async execute({ expression }) {
    if (typeof expression !== "string") {
      throw new ToolArgumentError("calculator", "expression 必须是字符串")
    }
    // 白名单字符：数字、运算符、括号、小数点、空白
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      throw new ToolArgumentError("calculator", "表达式包含非法字符")
    }
    // 使用 Function 构造受限表达式
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = new Function(`"use strict"; return (${expression});`)
    const value = fn()
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ToolArgumentError("calculator", `结果不是有限数值: ${String(value)}`)
    }
    return { expression, result: value }
  },
}
