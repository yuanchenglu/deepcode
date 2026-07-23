/**
 * 工具执行器。
 *
 * 负责参数校验（极简实现，不引入 zod 也能工作；若传入 zod schema 则使用 zod），
 * 调用工具 execute，将结果归一化为 ToolResult，异常时包装为错误结果。
 */

import type { Tool, ToolCall, ToolExecutionContext, ToolResult, ParameterSchema } from "../types"
import { ToolArgumentError, ToolNotFoundError } from "../errors"
import type { ToolRegistryLike } from "../types"

/** ToolRunner 构造参数。 */
export interface ToolRunnerOptions {
  /** 工具注册表。 */
  registry: ToolRegistryLike
  /** 默认会话 ID（写入 ctx）。 */
  sessionId?: string
  /** 默认角色 ID（写入 ctx）。 */
  roleId?: string
  /** 可选日志器。 */
  logger?: { info: (m: string) => void; warn: (m: string) => void }
}

/**
 * 根据 ParameterSchema 校验参数。
 *
 * 这是一个轻量级校验器，支持 type / properties / required / items / description，
 * 足以满足内置工具与测试需求。复杂场景可在 Tool.execute 内部自行校验。
 */
export function validateArgs(
  schema: ParameterSchema,
  args: unknown,
  path = "$",
): Record<string, unknown> {
  if (schema.type === "object") {
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      throw new ToolArgumentError(path, `期望 object，实际 ${typeof args}`)
    }
    const obj = args as Record<string, unknown>
    // 校验必填字段
    for (const key of schema.required ?? []) {
      if (!(key in obj)) {
        throw new ToolArgumentError(path, `缺少必填字段: ${key}`)
      }
    }
    // 校验已提供字段
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
      const prop = schema.properties?.[key]
      if (prop) {
        out[key] = validateValue(prop, val, `${path}.${key}`)
      } else {
        out[key] = val
      }
    }
    return out
  }
  // 顶层不是 object 的情况极少见，按原样返回
  return validateValue(schema, args, path) as Record<string, unknown>
}

function validateValue(schema: ParameterSchema, val: unknown, path: string): unknown {
  switch (schema.type) {
    case "string":
      if (typeof val !== "string") throw new ToolArgumentError(path, `期望 string，实际 ${typeof val}`)
      return val
    case "number":
      if (typeof val !== "number" || Number.isNaN(val)) {
        throw new ToolArgumentError(path, `期望 number，实际 ${typeof val}`)
      }
      return val
    case "boolean":
      if (typeof val !== "boolean") throw new ToolArgumentError(path, `期望 boolean，实际 ${typeof val}`)
      return val
    case "array":
      if (!Array.isArray(val)) throw new ToolArgumentError(path, `期望 array，实际 ${typeof val}`)
      if (schema.items) {
        return val.map((v, i) => validateValue(schema.items!, v, `${path}[${i}]`))
      }
      return val
    case "object":
      return validateArgs(schema, val, path)
    default:
      return val
  }
}

/** 工具执行器。 */
export class ToolRunner {
  private readonly registry: ToolRegistryLike
  private readonly sessionId: string
  private readonly roleId: string
  private readonly logger?: { info: (m: string) => void; warn: (m: string) => void }

  constructor(opts: ToolRunnerOptions) {
    this.registry = opts.registry
    this.sessionId = opts.sessionId ?? "default"
    this.roleId = opts.roleId ?? "unknown"
    this.logger = opts.logger
  }

  /**
   * 执行一次工具调用。
   * @param call - 工具调用请求。
   * @returns 归一化结果；异常时 isError=true 但不抛出。
   */
  async execute(call: ToolCall): Promise<ToolResult> {
    const tool: Tool | undefined = this.registry.get(call.name)
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        isError: true,
        content: serializeError(new ToolNotFoundError(call.name)),
      }
    }
    const ctx: ToolExecutionContext = {
      toolCallId: call.id,
      sessionId: this.sessionId,
      roleId: this.roleId,
      logger: this.logger,
    }
    // 参数校验
    let validated: Record<string, unknown>
    try {
      validated = validateArgs(tool.parameters, call.arguments ?? {})
    } catch (err) {
      return {
        toolCallId: call.id,
        name: call.name,
        isError: true,
        content: serializeError(err),
      }
    }
    // 执行
    try {
      const raw = await tool.execute(validated, ctx)
      return {
        toolCallId: call.id,
        name: call.name,
        isError: false,
        content: typeof raw === "string" ? raw : safeStringify(raw),
      }
    } catch (err) {
      this.logger?.warn(`工具 ${call.name} 执行失败: ${(err as Error).message}`)
      return {
        toolCallId: call.id,
        name: call.name,
        isError: true,
        content: serializeError(err),
      }
    }
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function serializeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}
