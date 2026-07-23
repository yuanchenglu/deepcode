/**
 * DeepAgent 错误类型。
 *
 * 所有错误都继承自 DeepAgentError，便于调用方统一捕获。
 */

/** 基础错误类。 */
export class DeepAgentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DeepAgentError"
  }
}

/** 工具未注册。 */
export class ToolNotFoundError extends DeepAgentError {
  constructor(name: string) {
    super(`工具未注册: ${name}`)
    this.name = "ToolNotFoundError"
  }
}

/** 工具/角色/技能重复注册。 */
export class AlreadyRegisteredError extends DeepAgentError {
  constructor(kind: string, name: string) {
    super(`${kind} 已注册: ${name}`)
    this.name = "AlreadyRegisteredError"
  }
}

/** 工具参数校验失败。 */
export class ToolArgumentError extends DeepAgentError {
  constructor(toolName: string, reason: string) {
    super(`工具 ${toolName} 参数错误: ${reason}`)
    this.name = "ToolArgumentError"
  }
}

/** 技能目录不存在或不可读。 */
export class SkillDirectoryNotFoundError extends DeepAgentError {
  constructor(dir: string) {
    super(`技能目录不存在: ${dir}`)
    this.name = "SkillDirectoryNotFoundError"
  }
}

/** 技能 frontmatter 缺失或不合法。 */
export class SkillFormatError extends DeepAgentError {
  constructor(skillPath: string, reason: string) {
    super(`技能文件 ${skillPath} 格式错误: ${reason}`)
    this.name = "SkillFormatError"
  }
}

/** 规划输入非法。 */
export class InvalidGoalError extends DeepAgentError {
  constructor(reason: string) {
    super(`非法目标: ${reason}`)
    this.name = "InvalidGoalError"
  }
}

/** 角色未找到。 */
export class RoleNotFoundError extends DeepAgentError {
  constructor(id: string) {
    super(`角色未注册: ${id}`)
    this.name = "RoleNotFoundError"
  }
}
