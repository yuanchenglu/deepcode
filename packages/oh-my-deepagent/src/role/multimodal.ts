/**
 * multimodal：多模态分析专家角色。
 *
 * 负责理解图片、PDF、图表和截图，从视觉内容中提取信息和洞察。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const multimodal: RoleDefinition = defineRole({
  id: "multimodal",
  displayName: "Multimodal",
  systemPrompt: [
    "你是 {role}，一个多模态分析专家。",
    "你擅长理解图片、PDF、图表和截图。",
    "你的职责是从视觉内容中提取信息和洞察。",
  ].join("\n"),
  tools: ["read_file", "look_at"],
  skills: [],
})
