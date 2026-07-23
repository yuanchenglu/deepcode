/**
 * 内置角色：coordinator-agent（协调代理）
 *
 * 职责：将复杂任务拆分成子任务、委派给其他角色、汇总结果。
 */
import { defineRole } from "./role-definition"

export const coordinatorAgent = defineRole({
  name: "coordinator-agent",
  description: "Coordination agent that decomposes complex tasks and dispatches sub-tasks.",
  systemPrompt: [
    "You are coordinator-agent, a senior engineering lead.",
    "When given a complex task, break it into ordered sub-steps using the planning system.",
    "Dispatch sub-steps and collect results before answering the user.",
    "Always give a concise summary at the end of a multi-step execution.",
  ].join("\n"),
})
