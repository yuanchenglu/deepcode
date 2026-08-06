/**
 * S2-08 可关联 Event ID 契约测试
 *
 * PLAN S2-08 步骤 1：建立可关联的 Session/turn/agent/tool/gateway event ID。
 *
 * 验证事件链可关联性（schema 层）：
 * - 所有 Session 事件带 sessionID（同一 Session 可聚合）
 * - Step/Text/Reasoning/Tool 事件带 assistantMessageID（同一 turn 可聚合）
 * - Step.Started 带 agent + route（同一 agent 可聚合 + 路由证据可关联）
 * - 全局事件 ID 唯一（Event.ID 类型）
 */
import { describe, it, expect } from "bun:test"
import { SessionEvent } from "@opencode-ai/schema/session-event"

describe("Session 事件可关联性（S2-08）", () => {
  it("Step.Started 事件结构：sessionID + assistantMessageID + agent + route", () => {
    const event = SessionEvent.Step.Started
    const fields = Object.keys(event.data.fields)
    expect(fields).toContain("sessionID")
    expect(fields).toContain("assistantMessageID")
    expect(fields).toContain("agent")
    expect(fields).toContain("model")
    expect(fields).toContain("route") // S2-02 证据
  })

  it("Step.Ended 事件带 finish + cost + tokens（可关联结算）", () => {
    const fields = Object.keys(SessionEvent.Step.Ended.data.fields)
    expect(fields).toContain("sessionID")
    expect(fields).toContain("assistantMessageID")
    expect(fields).toContain("finish")
    expect(fields).toContain("cost")
    expect(fields).toContain("tokens")
  })

  it("Tool 事件链：called/success/failed 均带 callID + sessionID", () => {
    for (const def of [
      SessionEvent.Tool.Called,
      SessionEvent.Tool.Success,
      SessionEvent.Tool.Failed,
    ]) {
      const fields = Object.keys(def.data.fields)
      expect(fields).toContain("sessionID")
      expect(fields).toContain("callID")
      expect(fields).toContain("assistantMessageID")
    }
  })

  it("事件类型全局唯一（inventory 无冲突）", () => {
    const types = new Set<string>()
    for (const def of [
      SessionEvent.AgentSwitched,
      SessionEvent.ModelSwitched,
      SessionEvent.Moved,
      SessionEvent.Prompted,
      SessionEvent.PromptAdmitted,
      SessionEvent.ContextUpdated,
      SessionEvent.Synthetic,
      SessionEvent.Shell.Started,
      SessionEvent.Shell.Ended,
      SessionEvent.Step.Started,
      SessionEvent.Step.Ended,
      SessionEvent.Step.Failed,
      SessionEvent.Text.Started,
      SessionEvent.Text.Delta,
      SessionEvent.Text.Ended,
      SessionEvent.Reasoning.Started,
      SessionEvent.Reasoning.Delta,
      SessionEvent.Reasoning.Ended,
      SessionEvent.Tool.Input.Started,
      SessionEvent.Tool.Input.Delta,
      SessionEvent.Tool.Input.Ended,
      SessionEvent.Tool.Called,
      SessionEvent.Tool.Progress,
      SessionEvent.Tool.Success,
      SessionEvent.Tool.Failed,
    ]) {
      expect(types.has(def.type)).toBe(false)
      types.add(def.type)
    }
    expect(types.size).toBeGreaterThan(20)
  })
})
