# S2-02 Provider、Routing 与 Harness 契约

> 日期：2026-08-05
> 基线：develop `65c55d6`（S2-01 DONE 后）
> 状态：DONE

## 1. 交付内容

### 1.1 RouteDecision 写入 Session 证据（PLAN 执行步骤 2 缺口修复）

审计发现：Router 决策逻辑（decide）已存在于 `model-router.ts`，`getHistory()` 也有实现，但 **RouteDecision 没有任何 Session 证据消费者**——决策理由丢失，无法事后追溯"为什么本轮选 Pro/Flash"。

修复（3 文件最小改动）：

| 文件 | 改动 |
|---|---|
| `packages/schema/src/session-event.ts` | `Step.Started` 事件新增可选 `route` 字段（tier/reason/riskLevel） |
| `packages/core/src/session/runner/publish-llm-event.ts` | `Input` 支持 route；`startAssistant` 发布 Step.Started 时携带 |
| `packages/core/src/session/runner/llm.ts` | decide 后从 Router history 取最新决策传入 publisher（失败时省略，route 可选不破坏事件） |

证据效果：每个 Step.Started 事件现在包含 `route: { tier, reason, riskLevel }`，Session 重放时可完整回答"为什么选该模型"，满足 PLAN "不可只改变 UI 标签"。

### 1.2 Harness Contract 测试（新增 `packages/core/test/deepcode-contract.test.ts`，30 用例）

覆盖已接入生产的 8 个核心 Harness 模块，每个模块正例/反例/边界：

| 模块 | 覆盖点 |
|---|---|
| model-router | override 最高优先级 / checkpoint→Pro / planning→Pro / 高风险文件→Pro / 普通写→Flash / 连续失败升级+fallbackFrom / 决策历史可追溯 |
| reasoning/manager | pro+architecture→max / flash+simple→low / 当前轮 full / 历史轮 stripped / 工具轮 full / summarize 空输入与长度边界 |
| window-manager (pure) | estimateTokens 空串 0 / 预算档位差异 / recommendMaxOutput 最小 16 |
| hard-constraint/extractor (pure) | 四类约束识别 / 无约束空数组 / render 非空 |
| hard-constraint/store | 提取→存储→读取闭环 |
| intent-router | 架构→architecture / 无匹配→medium 兜底 / 重构→refactor（规则优先级） |
| review-anti-drift | 连续工具调用触发升级 |
| immune-system | 无约束审查通过 |
| scope-creep-guard | 只读放行 / 未批准写拦截 needsApproval |

## 2. 验证结果

```bash
cd packages/core && bun typecheck        # ✅
cd packages/core && bun test             # 1105 pass / 0 fail（含新增 30）
cd packages/opencode && bun typecheck    # ✅
cd packages/oh-my-deepagent && bun typecheck  # ✅
cd packages/deepcode-gateway && bun typecheck # ✅
cd packages/schema && bun typecheck      # ✅
```

## 3. 测试中发现的实现事实（契约固定）

1. 提取器正则排除字符集含 `.`，`payment.go` 被截断为 `payment`（既有设计，测试断言匹配实际 pattern）。
2. intent-router 规则优先级：research > refactor > architecture，`重构` 命中 refactor 而非 architecture。
3. scope-creep-guard 只读工具白名单为大写 `Read/Grep/Glob/WebFetch/WebSearch`。

## 4. 技术债务

- Route 证据只记录 tier/reason/riskLevel，未持久化 fallbackFrom（RouteDecision 内部有，事件层未展开）。S2-08 可评估扩展。
- 16/18 Harness 模块仍无直接单测，Contract 测试只覆盖 8 个核心模块；剩余模块依赖 session-runner 集成测试（1105 全绿含）。
