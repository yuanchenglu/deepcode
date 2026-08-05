/**
 * oh-my-deepagent Host 插件（S2-03）
 *
 * 把插件的角色注册为 Host Agent，使生产入口（CLI）可选择内置插件。
 *
 * 安全桥原则（HOST_PLUGIN_CONTRACT.md v1.0）：
 * - 只映射角色的 systemPrompt/description 到 Host Agent，不复制 Host Provider/Tool 执行层；
 * - 插件角色的 Tool 调用由 Host ToolRegistry + Permission 统一执行（llm.ts toolMaterialization）；
 * - 插件关闭时 Host 基础能力不受影响（本插件是可选的注册器）。
 *
 * 当前注册三角色（S2-04 会扩展完整角色清单）：
 * - coding-agent：通用编码
 * - planner-agent：规划与研究
 * - system-agent：系统级辅助
 */

import { define } from "@opencode-ai/plugin/v2/effect/plugin"
import { Effect } from "effect"
import { coding, planner } from "./role"
import type { RoleDefinition } from "./types"

/** 将插件角色映射为 Host AgentV2.Info */
export function roleToAgent(role: RoleDefinition) {
  return {
    id: role.id,
    description: role.displayName,
    system: role.systemPrompt,
    mode: "all" as const,
    hidden: false,
    permissions: [],
  }
}

export const deepagentPlugin = define({
  id: "@deepcode/oh-my-deepagent",
  effect: (context) =>
    Effect.gen(function* () {
      const roles: RoleDefinition[] = [coding, planner]
      yield* context.agent.transform(
        Effect.fn(function* (draft) {
          for (const role of roles) {
            const info = roleToAgent(role)
            draft.update(info.id, (agent) => {
              agent.description = info.description
              agent.system = info.system
              agent.mode = "all"
            })
          }
        }),
      )
    }),
})

export { roleToAgent as _roleToAgent }
