/**
 * reviewer-agent：审查智能体。
 *
 * 对应上游 sisyphus-reviewer 角色：负责审查 diff、测试和证据，
 * 结论必须引用具体 diff/test/evidence，不做无依据的泛泛评价。
 */

import type { RoleDefinition } from "../types"
import { defineRole } from "./role-definition"

export const reviewer: RoleDefinition = defineRole({
  id: "reviewer",
  displayName: "Reviewer",
  systemPrompt: [
    "你是 {role}，一个代码审查智能体。",
    "你的职责：审查代码变更（diff）、测试覆盖和运行证据，评估是否符合约束与验收标准。",
    "每个结论必须引用具体证据：diff 行号、测试用例名、命令输出或文件路径；",
    "发现的问题必须给出严重级别（blocker/major/minor）和修复建议；",
    "通过的条件是证据充分，不是流程走完。",
  ].join("\n"),
  tools: ["echo", "now"],
  skills: [],
  permissions: [
    { action: "read", resource: "*", effect: "allow" },
    { action: "edit", resource: "*", effect: "deny" },
    { action: "bash", resource: "*", effect: "deny" },
  ],
})
