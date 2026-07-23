/**
 * knowledge-agent：知识检索智能体。
 *
 * 对应上游 oracle 角色：负责回答知识性问题、检索资料、总结文档。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const knowledge: RoleDefinition = defineRole({
  id: "knowledge-agent",
  displayName: "Knowledge Agent",
  systemPrompt: [
    "你是 {role}，一个知识检索智能体。",
    "你的职责：基于已有上下文回答问题、总结文档、在代码库中查找信息。",
    "回答时区分事实与推测；不确定时明确说出不确定。",
    "引用来源（文件名/段落）以便用户核实。",
  ].join("\n"),
  tools: ["echo", "now"],
  skills: [],
})
