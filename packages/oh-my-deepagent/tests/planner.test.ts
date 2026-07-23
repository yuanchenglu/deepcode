/**
 * Planner + PlanExecutor 单元测试。
 */
import { describe, expect, test } from "bun:test"
import { Planner, PlanExecutor, tally, stepsFromDescriptions } from "../src/planning"
import { InvalidGoalError } from "../src/errors"
import { MockLLMProvider } from "../src/llm"
import type { Plan } from "../src/types"

describe("Planner.createPlanFromList", () => {
  test("正常构造 Plan", () => {
    const p = new Planner()
    const plan = p.createPlanFromList("做一个网站", ["需求分析", "写代码", "测试"])
    expect(plan.goal).toBe("做一个网站")
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps[0]!.id).toBe("s1")
    expect(plan.steps[0]!.status).toBe("pending")
    expect(plan.status).toBe("pending")
  })

  test("空 goal 抛 InvalidGoalError", () => {
    const p = new Planner()
    expect(() => p.createPlanFromList("", ["a"])).toThrow(InvalidGoalError)
    expect(() => p.createPlanFromList("   ", ["a"])).toThrow(InvalidGoalError)
  })

  test("空 steps 抛 InvalidGoalError", () => {
    const p = new Planner()
    expect(() => p.createPlanFromList("g", [])).toThrow(InvalidGoalError)
  })

  test("空白步骤被过滤", () => {
    const p = new Planner()
    const plan = p.createPlanFromList("g", ["a", "  ", "b"])
    expect(plan.steps).toHaveLength(2)
  })
})

describe("Planner.parseStepsFromText", () => {
  test("解析 1. 2. 3.", () => {
    const p = new Planner()
    const steps = p.parseStepsFromText("1. 第一步\n2. 第二步\n3. 第三步")
    expect(steps).toEqual(["第一步", "第二步", "第三步"])
  })

  test("解析 1) 2) 3)", () => {
    const p = new Planner()
    expect(p.parseStepsFromText("1) a\n2) b")).toEqual(["a", "b"])
  })

  test("解析 - 与 *", () => {
    const p = new Planner()
    expect(p.parseStepsFromText("- a\n- b\n* c")).toEqual(["a", "b", "c"])
  })

  test("非编号开头的首行被忽略", () => {
    const p = new Planner()
    expect(p.parseStepsFromText("下面是步骤:\n1. a\n2. b")).toEqual(["a", "b"])
  })

  test("超过 maxSteps 截断", () => {
    const p = new Planner({ maxSteps: 2 })
    const out = p.parseStepsFromText("1. a\n2. b\n3. c")
    expect(out).toHaveLength(2)
  })
})

describe("Planner.createPlan (LLM)", () => {
  test("通过 MockLLM 拆解 goal", async () => {
    const llm = new MockLLMProvider([
      { content: "1. 分析\n2. 编码\n3. 测试" },
    ])
    const p = new Planner({ llm })
    const plan = await p.createPlan("做一个 CLI")
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps[0]!.description).toBe("分析")
  })

  test("未配置 LLM 调 createPlan 抛 InvalidGoalError", async () => {
    const p = new Planner()
    await expect(p.createPlan("g")).rejects.toThrow(InvalidGoalError)
  })

  test("模型输出无编号时兜底为单步", async () => {
    const llm = new MockLLMProvider([{ content: "随便写点什么" }])
    const p = new Planner({ llm })
    const plan = await p.createPlan("g")
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]!.description).toBe("随便写点什么")
  })
})

describe("PlanExecutor", () => {
  test("runAll 顺序执行所有步骤到 done", async () => {
    const plan: Plan = { goal: "g", status: "pending", steps: stepsFromDescriptions(["a", "b", "c"]) }
    const exec = new PlanExecutor({ plan, handler: async (s) => `done:${s.description}` })
    const result = await exec.runAll()
    expect(result.status).toBe("done")
    expect(result.steps.every((s) => s.status === "done")).toBe(true)
    expect(result.steps[0]!.result).toBe("done:a")
  })

  test("handler 抛错后 fail-fast", async () => {
    const plan: Plan = { goal: "g", status: "pending", steps: stepsFromDescriptions(["a", "b"]) }
    const exec = new PlanExecutor({
      plan,
      handler: async (s) => {
        if (s.description === "a") throw new Error("a failed")
        return "ok"
      },
    })
    await expect(exec.runAll()).rejects.toThrow("a failed")
    expect(plan.status).toBe("failed")
    expect(plan.steps[0]!.status).toBe("failed")
    expect(plan.steps[1]!.status).toBe("pending")
  })

  test("continueOnError 继续执行并完成", async () => {
    const plan: Plan = { goal: "g", status: "pending", steps: stepsFromDescriptions(["a", "b"]) }
    const exec = new PlanExecutor({
      plan,
      continueOnError: true,
      handler: async (s) => {
        if (s.description === "a") throw new Error("a failed")
        return "ok"
      },
    })
    const result = await exec.runAll()
    expect(result.steps[0]!.status).toBe("failed")
    expect(result.steps[1]!.status).toBe("done")
    expect(result.status).toBe("done")
  })

  test("snapshot 返回深拷贝", async () => {
    const plan: Plan = { goal: "g", status: "pending", steps: stepsFromDescriptions(["a"]) }
    const exec = new PlanExecutor({ plan, handler: () => "ok" })
    const snap1 = exec.snapshot()
    await exec.advance(0)
    expect(snap1.steps[0]!.status).toBe("pending")
    expect(exec.snapshot().steps[0]!.status).toBe("done")
  })
})

describe("tally", () => {
  test("统计各状态计数", () => {
    const plan: Plan = {
      goal: "g",
      status: "running",
      steps: [
        { id: "1", description: "a", status: "done" },
        { id: "2", description: "b", status: "running" },
        { id: "3", description: "c", status: "pending" },
        { id: "4", description: "d", status: "failed" },
      ],
    }
    expect(tally(plan)).toEqual({ pending: 1, running: 1, done: 1, failed: 1 })
  })
})
