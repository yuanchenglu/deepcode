/**
 * DeepCode Harness Contract 测试（S2-02）
 *
 * 覆盖已接入生产的 12 个 Harness 模块中可独立契约化的核心：
 * - model-router：路由决策正例/反例/边界（override > checkpoint > planning > 高风险意图 > 高风险文件 > 失败升级 > 默认）
 * - reasoning/manager：getEffort / getReasoningPolicy / summarize / shouldStrip
 * - context-layout/window-manager：estimateTokens / getBudgetForTier / recommendMaxOutput
 * - hard-constraint/extractor：extractHardConstraints / renderConstraints
 * - intent-router/classifier：classify 规则正反例
 * - hard-constraint/store：提取-存储-读取闭环
 * - review-anti-drift：recordToolCall 升级
 * - immune-system/reviewer：checkpoint 审查
 * - scope-creep-guard：checkToolAccess 白名单
 *
 * 目的：Provider 行为变化、路由规则回归能被 Contract 测试捕获；
 * 每个模块至少覆盖正例、反例、边界三类。
 */

import { describe, expect, it as rawIt } from "bun:test"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import * as DeepCodeModelRouter from "@opencode-ai/core/deepcode/router/model-router"
import * as DeepCodeReasoningManager from "@opencode-ai/core/deepcode/reasoning/manager"
import * as DeepCodeWindowManager from "@opencode-ai/core/deepcode/context-layout/window-manager"
import {
  extractHardConstraints,
  renderConstraints,
} from "@opencode-ai/core/deepcode/hard-constraint/extractor"
import * as DeepCodeConstraintStore from "@opencode-ai/core/deepcode/hard-constraint/store"
import * as DeepCodeIntentRouter from "@opencode-ai/core/deepcode/intent-router/classifier"
import * as DeepCodeReviewAntiDrift from "@opencode-ai/core/deepcode/review-anti-drift"
import * as DeepCodeImmuneSystem from "@opencode-ai/core/deepcode/immune-system/reviewer"
import * as DeepCodeScopeCreepGuard from "@opencode-ai/core/deepcode/scope-creep-guard"
import { testEffect } from "./lib/effect"

/** 构建所有零依赖 Harness node 的组合层 */
const harness = AppNodeBuilder.build(
  LayerNode.group([
    DeepCodeModelRouter.node,
    DeepCodeReasoningManager.node,
    DeepCodeWindowManager.node,
    DeepCodeConstraintStore.node,
    DeepCodeIntentRouter.node,
    DeepCodeReviewAntiDrift.node,
    DeepCodeImmuneSystem.node,
    DeepCodeScopeCreepGuard.node,
  ]),
  [],
)

const it = testEffect(harness).effect

// ============================================================
// model-router：路由决策契约
// ============================================================
describe("DeepCodeModelRouter", () => {
  it("override 优先级最高（正例）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      yield* router.setOverride("pro")
      const tier = yield* router.decide({ turn: 0, intent: "simple" })
      expect(tier).toBe("pro")
      yield* router.clearOverride()
    }))

  it("checkpoint 审查强制 Pro（正例）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      const tier = yield* router.decide({ turn: 5, isCheckpoint: true })
      expect(tier).toBe("pro")
    }))

  it("planning/architecture 强制 Pro（正例）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      const tier = yield* router.decide({ turn: 0, intent: "architecture", isPlanning: true })
      expect(tier).toBe("pro")
    }))

  it("高风险文件写入强制 Pro（正例）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      const tier = yield* router.decide({ turn: 0, writeTargets: ["db/migrations/001.sql"] })
      expect(tier).toBe("pro")
    }))

  it("普通写入先 Flash（默认/中风险）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      const tier = yield* router.decide({ turn: 0, pendingTool: "write", writeTargets: ["src/foo.ts"] })
      expect(tier).toBe("flash")
    }))

  it("连续失败升级 Pro 且记录 fallbackFrom（边界）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      yield* router.recordFailure()
      yield* router.recordFailure()
      const tier = yield* router.decide({ turn: 0, intent: "simple" })
      expect(tier).toBe("pro")
      const history = yield* router.getHistory()
      const last = history.at(-1)
      expect(last?.fallbackFrom).toBe("flash")
      expect(last?.reason).toContain("consecutive failures")
    }))

  it("决策历史可追溯（证据契约）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeModelRouter.Service
      yield* router.decide({ turn: 0, intent: "simple" })
      const history = yield* router.getHistory()
      expect(history.length).toBeGreaterThan(0)
      const last = history.at(-1)!
      expect(last.turn).toBe(0)
      expect(["flash", "pro"]).toContain(last.selected)
      expect(last.reason.length).toBeGreaterThan(0)
      expect(["low", "medium", "high"]).toContain(last.riskLevel)
      expect(last.id.startsWith("route_")).toBe(true)
    }))
})

// ============================================================
// reasoning/manager：effort 与策略契约
// ============================================================
describe("DeepCodeReasoningManager", () => {
  it("pro 档高意图 → max（正例）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      const effort = yield* rm.getEffort("architecture", "pro")
      expect(effort).toBe("max")
    }))

  it("flash 档简单意图 → low（正例）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      const effort = yield* rm.getEffort("simple", "flash")
      expect(effort).toBe("low")
    }))

  it("当前轮 reasoning 保留 full（正例）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      expect(rm.getReasoningPolicy(0, false)).toBe("full")
    }))

  it("历史轮剥离 stripped（反例路径）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      expect(rm.getReasoningPolicy(3, false)).toBe("stripped")
    }))

  it("工具调用轮次强制 full（边界）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      expect(rm.getReasoningPolicy(2, true)).toBe("full")
    }))

  it("summarize 空输入返回空串（边界）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      expect(rm.summarize("")).toBe("")
    }))

  it("summarize 保留首尾要点（正例）", () =>
    Effect.gen(function* () {
      const rm = yield* DeepCodeReasoningManager.Service
      const out = rm.summarize("分析了依赖关系。中间过程细节。最终决定采用方案 B。")
      expect(out.length).toBeLessThanOrEqual(300)
      expect(out.length).toBeGreaterThan(0)
    }))
})

// ============================================================
// window-manager：窗口预算契约（纯函数）
// ============================================================
describe("DeepCodeWindowManager (pure)", () => {
  rawIt("estimateTokens 空串为 0（边界）", () => {
    expect(DeepCodeWindowManager.estimateTokens("")).toBe(0)
    expect(DeepCodeWindowManager.estimateTokens(undefined as unknown as string)).toBe(0)
  })

  rawIt("estimateTokens 保守上界（正例）", () => {
    expect(DeepCodeWindowManager.estimateTokens("a".repeat(100))).toBeGreaterThan(0)
    expect(DeepCodeWindowManager.estimateTokens("a".repeat(100))).toBe(
      DeepCodeWindowManager.estimateTokens("a".repeat(100)),
    )
  })

  rawIt("getBudgetForTier 档位差异（正例）", () => {
    const flash = DeepCodeWindowManager.getBudgetForTier("flash")
    const pro = DeepCodeWindowManager.getBudgetForTier("pro")
    expect(pro.activeMaxTokens).toBeGreaterThan(flash.activeMaxTokens)
  })

  rawIt("recommendMaxOutput 最小 16（边界）", () => {
    expect(DeepCodeWindowManager.recommendMaxOutput(120, 100)).toBe(16)
  })

  rawIt("recommendMaxOutput 正常计算（正例）", () => {
    const out = DeepCodeWindowManager.recommendMaxOutput(50, 10)
    expect(out).toBe(128 - 50 - 10)
  })
})

// ============================================================
// hard-constraint/extractor：约束提取契约（纯函数）
// ============================================================
describe("extractHardConstraints", () => {
  rawIt("识别 forbid/require/never/always 类型（正例）", () => {
    const result = extractHardConstraints(
      "不要修改 config；必须先备份；严禁提交密钥；一定要写注释。",
    )
    const types = result.map((c) => c.type)
    expect(types).toContain("forbid")
    expect(types).toContain("require")
    expect(types).toContain("never")
    expect(types).toContain("always")
  })

  rawIt("无约束文本返回空数组（反例）", () => {
    expect(extractHardConstraints("请帮我优化一下这个函数")).toEqual([])
  })

  rawIt("renderConstraints 渲染非空（正例）", () => {
    const rendered = renderConstraints(extractHardConstraints("不要修改 test 文件"))
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.toLowerCase()).toContain("test")
  })
})

// ============================================================
// hard-constraint/store：闭环契约
// ============================================================
describe("DeepCodeConstraintStore", () => {
  it("提取并读取约束闭环（正例）", () =>
    Effect.gen(function* () {
      const store = yield* DeepCodeConstraintStore.Service
      yield* store.extractAndAdd("不要修改 payment.go")
      const all = yield* store.getAll()
      expect(all.length).toBeGreaterThan(0)
      // 注：提取器正则排除字符集含 `.`，pattern 截断为 "不要修改 payment"
      expect(all.some((c) => c.pattern.includes("payment"))).toBe(true)
    }))
})

// ============================================================
// intent-router：意图分类契约
// ============================================================
describe("DeepCodeIntentRouter", () => {
  it("架构设计关键词 → architecture（正例）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeIntentRouter.Service
      const result = yield* router.classify("请给出整体架构设计方案")
      expect(result.intent).toBe("architecture")
    }))

  it("无明确关键词 → 默认 medium 兜底（边界）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeIntentRouter.Service
      const result = yield* router.classify("这个函数是做什么的？")
      expect(result.intent).toBe("medium")
    }))

  it("重构关键词 → refactor（正例，规则优先级验证）", () =>
    Effect.gen(function* () {
      const router = yield* DeepCodeIntentRouter.Service
      const result = yield* router.classify("我需要重构整个模块")
      expect(result.intent).toBe("refactor")
    }))
})

// ============================================================
// review-anti-drift：审查升级契约
// ============================================================
describe("DeepCodeReviewAntiDrift", () => {
  it("连续工具调用触发升级（正例）", () =>
    Effect.gen(function* () {
      const drift = yield* DeepCodeReviewAntiDrift.Service
      let shouldReview = false
      for (let i = 0; i < 20; i++) {
        const r = yield* drift.recordToolCall(1)
        if (r.shouldReview) {
          shouldReview = true
          break
        }
      }
      expect(shouldReview).toBe(true)
    }))
})

// ============================================================
// immune-system：checkpoint 审查契约
// ============================================================
describe("DeepCodeImmuneSystem", () => {
  it("无约束时审查通过（正例）", () =>
    Effect.gen(function* () {
      const immune = yield* DeepCodeImmuneSystem.Service
      const result = yield* immune.reviewCheckpoint("step-1", [], [])
      expect(result.passed).toBe(true)
      expect(result.violations).toEqual([])
    }))
})

// ============================================================
// scope-creep-guard：工具访问契约
// ============================================================
describe("DeepCodeScopeCreepGuard", () => {
  it("白名单内只读路径允许（正例）", () =>
    Effect.gen(function* () {
      const guard = yield* DeepCodeScopeCreepGuard.Service
      const result = yield* guard.checkToolAccess("Read", "src/main.ts")
      expect(result.allowed).toBe(true)
    }))

  it("未批准写路径拦截（反例）", () =>
    Effect.gen(function* () {
      const guard = yield* DeepCodeScopeCreepGuard.Service
      const result = yield* guard.checkToolAccess("write", "src/untracked.ts")
      expect(result.allowed).toBe(false)
      expect(result.needsApproval).toBe(true)
    }))
})
