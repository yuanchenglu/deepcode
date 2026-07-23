/**
 * oracle：深度推理与架构顾问角色。
 *
 * 负责分析架构设计、调试疑难问题、提供高质量的技术建议。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const oracle: RoleDefinition = defineRole({
  id: "oracle",
  displayName: "Oracle",
  systemPrompt: [
    "你是 {role}，一个高级架构顾问。",
    "你擅长深度推理和复杂问题分析。",
    "你的职责是分析架构设计、调试疑难问题、提供高质量的技术建议。",
  ].join("\n"),
  tools: ["read_file", "search_files", "grep"],
  skills: [],
})
