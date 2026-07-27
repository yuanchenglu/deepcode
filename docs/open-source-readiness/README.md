# DeepCode 开源准备文档基线

> 分支：`develop`
> 基线日期：2026-07-27
> 当前阶段：Phase 0 范围冻结完成，Runtime 架构勘误已生效
> 目标：真实、可信、可维护地开源 DeepCode

## 1. 文档权威性

本目录是当前开源准备的权威文档集。旧版 `docs/REQUIREMENTS.md`、`docs/ARCHITECTURE.md` 和 `docs/analysis/*` 仅作为历史材料。

Phase 0 曾将 `oh-my-deepagent` 中存在独立可运行代码，过度解释为“当前存在第二套生产 Agent Runtime”。该判断证据不足，已由 [14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md) 正式纠正。

后续统一采用：

> **单一宿主执行边界，允许多个可组合的 Agent 编排循环。**

## 2. 正确产品关系

```text
DeepCode / OpenCode Host
├── Host Execution Services
│   ├── Session
│   ├── Provider
│   ├── Context / History
│   ├── Tool / Permission
│   └── Harness / Evidence
├── Built-in oh-my-deepagent Plugin
│   ├── Roles
│   ├── Skills
│   ├── Planning
│   ├── Delegation
│   ├── Subagents
│   └── Multi-Agent Orchestration
└── Gateway
    ├── Platform Authentication
    ├── Session Mapping
    ├── Workspace Policy
    └── Message Delivery
```

oh-my-deepagent 是 DeepCode 的内置插件，与宿主是共生关系。插件可以拥有自己的 Orchestration Loop；真正需要审计的是其执行是否与宿主的权限、工作区和会话契约一致，而不是是否存在名为 `AgentRuntime` 或 `runMessageLoop` 的代码。

## 3. 状态定义

- **Verified**：代码路径、实际行为、自动化测试和运行证据齐全。
- **Implemented-Unverified**：代码存在，缺少当前基线运行证据。
- **Partial**：只完成部分链路。
- **Not Implemented**：不存在或未接入。
- **Blocked**：环境或外部条件阻塞验证。

## 4. 文档目录

| 文档 | 用途 |
|---|---|
| [00_CODE_REVIEW.md](./00_CODE_REVIEW.md) | 当前代码审查和风险证据 |
| [01_PRODUCT_ARCHITECTURE.md](./01_PRODUCT_ARCHITECTURE.md) | 产品架构概览 |
| [02_TECHNICAL_ARCHITECTURE.md](./02_TECHNICAL_ARCHITECTURE.md) | 技术架构概览 |
| [03_PRD.md](./03_PRD.md) | v0.1 产品需求和发布门槛 |
| [04_TEST_PLAN_AND_CASES.md](./04_TEST_PLAN_AND_CASES.md) | 测试策略和用例基线 |
| [05_FUNCTIONAL_TEST_REPORT.md](./05_FUNCTIONAL_TEST_REPORT.md) | 当前功能验证报告 |
| [06_ITERATION_PLAN.md](./06_ITERATION_PLAN.md) | 后续迭代顺序 |
| [07_REQUIREMENT_TRACEABILITY.md](./07_REQUIREMENT_TRACEABILITY.md) | 需求—代码—测试—证据矩阵 |
| [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md) | v0.1 范围冻结 |
| [09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md) | v0.1 产品架构详版 |
| [10_V0.1_TECHNICAL_ARCHITECTURE.md](./10_V0.1_TECHNICAL_ARCHITECTURE.md) | v0.1 技术架构详版 |
| [11_V0.1_AGENT_INTEGRATION_PLAN.md](./11_V0.1_AGENT_INTEGRATION_PLAN.md) | oh-my-deepagent 插件集成计划 |
| [12_V0.1_GATEWAY_PLAN.md](./12_V0.1_GATEWAY_PLAN.md) | Gateway 正式交付计划 |
| [13_V0.1_MIGRATION_MANIFEST.md](./13_V0.1_MIGRATION_MANIFEST.md) | Keep/Adapt/Bridge/Replace/Remove 清单 |
| [14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md) | Host Runtime 与插件编排勘误 |

## 5. 已确认的产品范围

1. Gateway 是 v0.1 一级能力，Gateway Core 目标 Stable，飞书为首个 Stable Adapter 目标。
2. 现有 13 个 Agent 角色作为 DeepCode 内置插件能力预装，并逐角色达到发布标准。
3. 不把 oh-my-deepagent 作为独立产品要求用户安装。
4. 不删除插件编排能力、Subagent 或 Multi-Agent 设计。
5. 安全、Provider Contract、安装、CI 和运行证据仍是发布硬门槛。

## 6. 当前判断边界

目前已确认 `packages/oh-my-deepagent` 包含独立组合的 AgentRuntime、消息循环、工具、记忆、Provider 和 Transport 实现；尚未完成：

- 它们是否被当前生产入口调用；
- 它们与原始 oh-my-OpenAgent 插件契约的关系；
- 它们是插件编排、兼容层、测试 Runtime 还是重复实现；
- 哪些应 Keep、Adapt、Bridge、Replace 或 Remove。

因此，Phase 1 必须先生成真实调用图和架构来源审计，不得预设删除。

## 7. 决策规则

```text
用户价值明确
AND 宿主—插件边界清楚
AND 主链路真实生效
AND 权限与工作区不可绕过
AND 有自动化测试
AND 有可观察证据
```
