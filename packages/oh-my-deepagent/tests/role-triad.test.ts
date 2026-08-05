/**
 * 角色三角闭环 Contract 测试（S2-04）
 *
 * 覆盖 PLAN S2-04 步骤 1/2/5：
 * - Coding/Planner/Reviewer 三角角色均有权限定义（允许工具、默认权限）
 * - 每个角色至少一个成功和一个失败场景
 * - 权限最小化：planner/reviewer 只读，不能写代码
 */
import { describe, expect, test } from "bun:test"
import { coding, planner, reviewer } from "../src/role"
import { renderSystemPrompt } from "../src/role"

describe("角色三角闭环（S2-04）", () => {
  test("三角角色齐全：coding / planner / reviewer", () => {
    expect(coding.id).toBe("coding-agent")
    expect(planner.id).toBe("planner-agent")
    expect(reviewer.id).toBe("reviewer")
  })

  test("coding 可读写 + bash 需询问（默认权限）", () => {
    const read = coding.permissions?.find((p) => p.action === "read")
    const edit = coding.permissions?.find((p) => p.action === "edit")
    const bash = coding.permissions?.find((p) => p.action === "bash")
    expect(read?.effect).toBe("allow")
    expect(edit?.effect).toBe("allow")
    expect(bash?.effect).toBe("ask")
  })

  test("planner 只读：bash 拒绝（失败场景：planner 不写代码）", () => {
    const bash = planner.permissions?.find((p) => p.action === "bash")
    expect(bash?.effect).toBe("deny")
    expect(renderSystemPrompt(planner)).toContain("不要直接写代码")
  })

  test("reviewer 只读：edit/bash 拒绝（失败场景：reviewer 不改代码）", () => {
    const edit = reviewer.permissions?.find((p) => p.action === "edit")
    const bash = reviewer.permissions?.find((p) => p.action === "bash")
    expect(edit?.effect).toBe("deny")
    expect(bash?.effect).toBe("deny")
  })

  test("reviewer 结论必须引用证据（成功场景约束）", () => {
    expect(renderSystemPrompt(reviewer)).toContain("引用")
    expect(renderSystemPrompt(reviewer)).toContain("diff")
    expect(renderSystemPrompt(reviewer)).toContain("证据")
  })

  test("planner 产出可执行步骤（成功场景约束）", () => {
    const prompt = renderSystemPrompt(planner)
    expect(prompt).toContain("可执行")
    expect(prompt).toContain("验收标准")
  })

  test("coding 改动小而可回滚（成功场景约束）", () => {
    expect(renderSystemPrompt(coding)).toContain("小而可回滚")
  })

  test("三角角色已注册到默认角色集", () => {
    const { defaultRoles } = require("../src/role") as typeof import("../src/role")
    expect(defaultRoles.coding).toBeDefined()
    expect(defaultRoles.planner).toBeDefined()
    expect(defaultRoles.reviewer).toBeDefined()
  })
})
