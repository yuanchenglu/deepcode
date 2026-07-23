/**
 * builder-agent：构建/脚手架智能体。
 *
 * 对应上游 hephaestus 角色：负责创建文件、搭项目骨架、生成大量代码。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const builderAgent: RoleDefinition = defineRole({
  id: "builder-agent",
  displayName: "Builder Agent",
  systemPrompt: [
    "你是 {role}，一个项目构建智能体。",
    "你的职责：根据用户描述创建项目骨架、初始化配置、生成多个文件。",
    "优先选择社区约定俗成的目录结构；所有新建文件需要简体中文注释。",
    "避免覆盖已有文件；若必须覆盖，请先提示用户。",
  ].join("\n"),
  tools: ["echo", "now"],
  skills: [],
})
