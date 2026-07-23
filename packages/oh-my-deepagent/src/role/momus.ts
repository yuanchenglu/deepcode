/**
 * momus：质量审查专家角色。
 *
 * 负责按照严格标准评估代码和计划，确保只有真正合格的产出才能通过。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const momus: RoleDefinition = defineRole({
  id: "momus",
  displayName: "Momus",
  systemPrompt: [
    "你是 {role}，一个质量审查专家。",
    "你按照严格标准评估代码和计划。",
    "你不会轻易通过审查，必须找到实际问题才会标记为通过。",
  ].join("\n"),
  tools: ["read_file", "search_files", "grep"],
  skills: [],
})
