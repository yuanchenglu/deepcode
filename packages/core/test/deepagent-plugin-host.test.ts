/**
 * deepagentPlugin 接入 Host 验证（S2-03）
 *
 * 验证：
 * 1. 生产入口加载 deepagentPlugin 后，插件角色注册为 Host Agent
 * 2. 权限为空——Tool 执行由 Host Permission 统一控制，不可绕过
 * 3. 插件关闭（不加载）时 Host 基础能力仍可用
 */
import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { deepagentPlugin } from "@deepcode/oh-my-deepagent"
import { testEffect } from "./lib/effect"
import { agentHost, host } from "./plugin/host"

const it = testEffect(AppNodeBuilder.build(AgentV2.node))

describe("deepagentPlugin 接入 Host（S2-03）", () => {
  it.effect("加载插件后 coding/planner/reviewer 注册为 Host Agent", () =>
    Effect.gen(function* () {
      const agent = yield* AgentV2.Service
      const ctx = host({ agent: agentHost(agent) })
      yield* deepagentPlugin.effect(ctx)

      const codingAgent = yield* agent.get(AgentV2.ID.make("coding-agent"))
      expect(codingAgent).toMatchObject({
        id: AgentV2.ID.make("coding-agent"),
        system: expect.stringContaining("编码智能体"),
        description: "Coding Agent",
      })

      const plannerAgent = yield* agent.get(AgentV2.ID.make("planner-agent"))
      expect(plannerAgent).toMatchObject({
        id: AgentV2.ID.make("planner-agent"),
        system: expect.stringContaining("不要直接写代码"),
      })

      const reviewerAgent = yield* agent.get(AgentV2.ID.make("reviewer"))
      expect(reviewerAgent).toMatchObject({
        id: AgentV2.ID.make("reviewer"),
        system: expect.stringContaining("引用"),
        description: "Reviewer",
      })
    }),
  )

  it.effect("插件注册的 Agent 权限为空——Tool 执行由 Host Permission 统一控制", () =>
    Effect.gen(function* () {
      const agent = yield* AgentV2.Service
      const ctx = host({ agent: agentHost(agent) })
      yield* deepagentPlugin.effect(ctx)

      const codingAgent = yield* agent.get(AgentV2.ID.make("coding-agent"))
      expect(codingAgent?.permissions).toEqual([])
    }),
  )

  it.effect("插件关闭（不加载）时 Host Agent 基础能力仍可用", () =>
    Effect.gen(function* () {
      const agent = yield* AgentV2.Service
      // 未加载任何插件：AgentV2 空启动，无角色注册，但服务可用
      expect(yield* agent.all()).toEqual([])
      const empty = AgentV2.Info.empty(AgentV2.ID.make("build"))
      expect(empty).toMatchObject({
        id: AgentV2.ID.make("build"),
        permissions: [],
      })
    }),
  )
})
