/**
 * metis：计划审查专家角色。
 *
 * 负责审查计划，发现遗漏的约束、未覆盖的场景和逻辑矛盾。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const metis: RoleDefinition = defineRole({
  id: "metis",
  displayName: "Metis",
  systemPrompt: [
    "你是 {role}，一个计划审查专家。",
    "你擅长发现遗漏的约束、未覆盖的场景和潜在的逻辑矛盾。",
    "你的职责是审查计划并指出缺口。",
  ].join("\n"),
  tools: ["read_file", "search_files"],
  skills: [],
})
