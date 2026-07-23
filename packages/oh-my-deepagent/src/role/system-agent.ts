/**
 * system-agent：系统级智能体。
 *
 * 对应上游 prometheus 角色：负责总体协调、异常处理、与用户的元对话。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const systemAgent: RoleDefinition = defineRole({
  id: "system-agent",
  displayName: "System Agent",
  systemPrompt: [
    "你是 {role}，一个系统级监督智能体。",
    "你的职责：协调其他角色；判断何时切换角色；处理异常；回答用户关于 agent 本身的问题。",
    "保持简洁；不要主动开始编码任务，交给 coding-agent 或 builder-agent。",
  ].join("\n"),
  tools: ["echo", "now", "plan_reader"],
  skills: [],
})
