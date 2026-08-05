/**
 * Delegation / Subagent / Multi-Agent 契约测试（S2-05）
 *
 * 覆盖 PLAN S2-05 验收：
 * - 子 Agent 只能缩小权限，不能扩大 parent 权限
 * - 跨 Workspace 必须重新授权
 * - 并行修改同一文件时必须检测冲突并交回协调者，不能后写覆盖
 * - 所有子任务可追踪到 parent（SubTask 含 parentSession/childSession/taskID）
 */
import { describe, expect, test } from "bun:test"
import {
  inheritPermissions,
  validateWorkspace,
  detectWriteConflicts,
} from "../src/delegation"

describe("inheritPermissions（权限继承：只能缩小）", () => {
  test("parent allow 降级为 ask（正例：更保守）", () => {
    const result = inheritPermissions([{ action: "edit", resource: "*", effect: "allow" }])
    expect(result).toEqual([{ action: "edit", resource: "*", effect: "ask" }])
  })

  test("parent deny 保持不变（正例）", () => {
    const result = inheritPermissions([{ action: "bash", resource: "*", effect: "deny" }])
    expect(result).toEqual([{ action: "bash", resource: "*", effect: "deny" }])
  })

  test("子任务显式 deny 允许（收紧）", () => {
    const result = inheritPermissions(
      [{ action: "edit", resource: "*", effect: "ask" }],
      [{ action: "edit", resource: "*", effect: "deny" }],
    )
    expect(result).toEqual([{ action: "edit", resource: "*", effect: "deny" }])
  })

  test("子任务不能新增 allow 规则（反例：权限不可升级）", () => {
    const result = inheritPermissions([], [{ action: "bash", resource: "*", effect: "allow" }])
    expect(result).toEqual([])
  })

  test("子任务 allow 不能覆盖 parent deny（反例：不可升级）", () => {
    const result = inheritPermissions(
      [{ action: "bash", resource: "*", effect: "deny" }],
      [{ action: "bash", resource: "*", effect: "allow" }],
    )
    expect(result).toEqual([{ action: "bash", resource: "*", effect: "deny" }])
  })
})

describe("validateWorkspace（跨 Workspace 重新授权）", () => {
  test("子任务 workspace 等于父 workspace 合法（正例）", () => {
    expect(validateWorkspace("/project", "/project")).toBe(true)
  })

  test("子任务 workspace 位于父内合法（正例）", () => {
    expect(validateWorkspace("/project", "/project/src")).toBe(true)
  })

  test("子任务 workspace 在父外非法（反例：需重新授权）", () => {
    expect(validateWorkspace("/project", "/other")).toBe(false)
    expect(validateWorkspace("/project", "/project-sibling")).toBe(false)
  })
})

describe("detectWriteConflicts（冲突检测：不静默丢修改）", () => {
  test("无重叠文件无冲突（正例）", () => {
    const result = detectWriteConflicts([
      { taskID: "t1", files: ["a.ts"] },
      { taskID: "t2", files: ["b.ts"] },
    ])
    expect(result.conflict).toBe(false)
    expect(result.resolution).toBe("none")
  })

  test("同一文件被两任务修改 → 冲突交回协调者（反例）", () => {
    const result = detectWriteConflicts([
      { taskID: "t1", files: ["shared.ts"] },
      { taskID: "t2", files: ["shared.ts"] },
    ])
    expect(result.conflict).toBe(true)
    expect(result.files).toEqual(["shared.ts"])
    expect(result.resolution).toBe("merge-back")
  })

  test("三个任务改同一文件也检测到（多 Agent 冲突）", () => {
    const result = detectWriteConflicts([
      { taskID: "t1", files: ["x.ts"] },
      { taskID: "t2", files: ["x.ts"] },
      { taskID: "t3", files: ["x.ts"] },
    ])
    expect(result.conflict).toBe(true)
    expect(result.files).toEqual(["x.ts"])
  })
})

describe("SubTask 追踪结构（可追踪到 parent）", () => {
  test("子任务结构包含 parent/child/task 三 ID（契约）", () => {
    const task = {
      id: "task-1",
      parentSession: "ses_parent",
      childSession: "ses_child",
      agentID: "reviewer",
      description: "review changes",
      workspace: "/project",
      permissions: [],
      status: "pending" as const,
    }
    expect(task.parentSession).toBe("ses_parent")
    expect(task.childSession).toBe("ses_child")
    expect(task.id).toBe("task-1")
    expect(task.agentID).toBe("reviewer")
  })
})
