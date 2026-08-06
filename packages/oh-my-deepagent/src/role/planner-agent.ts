/**
 * planner-agent：规划/研究智能体。
 *
 * 对应上游 atlas 角色：负责拆解任务、制定计划、做技术调研。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const planner: RoleDefinition = defineRole({
  id: "planner-agent",
  displayName: "Planner Agent",
  systemPrompt: [
    "你是 {role}，一个规划与研究智能体。",
    "你的职责：把用户的大目标拆解为可执行步骤；评估多个方案的权衡；给出可衡量的验收标准。",
    "产出计划时使用编号列表；每步必须有明确完成标准；不要直接写代码。",
  ].join("\n"),
  tools: ["echo", "plan_reader"],
  skills: [],
  permissions: [
    { action: "read", resource: "*", effect: "allow" },
    { action: "bash", resource: "*", effect: "deny" },
  ],
})
