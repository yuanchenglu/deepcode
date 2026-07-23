/**
 * 内置工具单元测试。
 */
import { describe, expect, test } from "bun:test"
import { echoTool, calculatorTool, createNowTool, createPlanReader } from "../src/tool"
import { ToolArgumentError } from "../src/errors"

describe("echo tool", () => {
  test("原样返回输入文本", async () => {
    const out = await echoTool.execute({ text: "hello" }, { toolCallId: "1", sessionId: "s", roleId: "r" })
    expect(out).toEqual({ echoed: "hello" })
  })
})

describe("calculator tool", () => {
  test("合法表达式返回数值", async () => {
    const out = (await calculatorTool.execute({ expression: "1+2*3" }, {
      toolCallId: "1",
      sessionId: "s",
      roleId: "r",
    })) as { result: number }
    expect(out.result).toBe(7)
  })

  test("非法字符被拒", async () => {
    await expect(
      calculatorTool.execute({ expression: "process.exit()" }, { toolCallId: "1", sessionId: "s", roleId: "r" }),
    ).rejects.toThrow(ToolArgumentError)
  })

  test("除零返回 Infinity 被拒", async () => {
    await expect(
      calculatorTool.execute({ expression: "1/0" }, { toolCallId: "1", sessionId: "s", roleId: "r" }),
    ).rejects.toThrow(ToolArgumentError)
  })

  test("括号表达式正确", async () => {
    const out = (await calculatorTool.execute({ expression: "(2+3)*4" }, {
      toolCallId: "1",
      sessionId: "s",
      roleId: "r",
    })) as { result: number }
    expect(out.result).toBe(20)
  })
})

describe("now tool", () => {
  test("通过注入时钟返回固定时间", async () => {
    const fixed = new Date("2026-07-22T00:00:00.000Z")
    const tool = createNowTool({ now: () => fixed })
    const out = (await tool.execute({}, { toolCallId: "1", sessionId: "s", roleId: "r" })) as {
      epochMs: number
      iso: string
    }
    expect(out.epochMs).toBe(fixed.getTime())
    expect(out.iso).toBe("2026-07-22T00:00:00.000Z")
  })
})

describe("plan reader", () => {
  test("返回当前计划", async () => {
    let plan: { goal: string; steps: Array<{ id: string; description: string; status: string }>; status: string } | undefined = {
      goal: "g",
      status: "running",
      steps: [{ id: "s1", description: "d1", status: "done" }],
    }
    const tool = createPlanReader(() => plan as any)
    const out = (await tool.execute({}, { toolCallId: "1", sessionId: "s", roleId: "r" })) as { hasPlan: boolean }
    expect(out.hasPlan).toBe(true)
    plan = undefined
    const out2 = (await tool.execute({}, { toolCallId: "1", sessionId: "s", roleId: "r" })) as { hasPlan: boolean }
    expect(out2.hasPlan).toBe(false)
  })
})
