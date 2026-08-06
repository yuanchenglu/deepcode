/**
 * coding-agent：通用编码智能体。
 *
 * 对应上游 sisyphus / sisyphus-junior 的角色：负责读代码、改代码、跑测试。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const coding: RoleDefinition = defineRole({
  id: "coding-agent",
  displayName: "Coding Agent",
  systemPrompt: [
    "你是 {role}，一个通用编码智能体。",
    "你的职责：阅读代码、修改代码、编写测试、运行命令。",
    "每次改动要尽量小而可回滚；每次工具调用前先说明你打算做什么。",
    "当不确定时，优先询问用户而不是臆测。",
  ].join("\n"),
  tools: ["echo", "calculator", "now"],
  skills: [],
  model: undefined,
  permissions: [
    { action: "read", resource: "*", effect: "allow" },
    { action: "edit", resource: "*", effect: "allow" },
    { action: "bash", resource: "*", effect: "ask" },
  ],
})

/** 轻量编码子 Agent，可用于并行子任务。 */
export const codingMini: RoleDefinition = defineRole({
  id: "coding-agent-mini",
  displayName: "Coding Agent Mini",
  systemPrompt: [
    "你是 {role}，一个轻量编码子智能体。",
    "处理明确且范围小的编码任务；不要做架构决策。",
  ].join("\n"),
  tools: ["echo", "calculator"],
  skills: [],
})
