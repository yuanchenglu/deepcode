# DeepCode 开源准备文档基线

> 分支：`develop`
> 基线日期：2026-07-27
> 当前阶段：三阶段执行计划已冻结，第一阶段待进入实现
> 目标：真实、可信、可维护地开源 DeepCode

## 1. 文档权威性

本目录是当前开源准备的权威文档集。[PLAN.md](./PLAN.md) 是唯一跨阶段执行总计划。旧版 `docs/REQUIREMENTS.md`、`docs/ARCHITECTURE.md` 和 `docs/analysis/*` 仅作为历史材料。

发生阶段、任务顺序或门禁冲突时，以 `PLAN.md` 为准；`06_*` 是路线摘要，`11_*`、`12_*`、`15_*` 是专项说明。

Phase 0 曾将 `oh-my-deepagent` 中存在独立可运行代码，过度解释为“当前存在第二套生产 Agent Runtime”。该判断证据不足，已由 [14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md) 正式纠正。

后续统一采用：

> **单一宿主执行边界，允许多个可组合的 Agent 编排循环。**

## 2. 当前实现与目标产品关系

以下是目标架构，不代表 Built-in Plugin 和 Gateway 当前已经进入生产调用链：

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

oh-my-deepagent 的目标定位是 DeepCode 内置插件，并与宿主形成共生关系；当前生产入口尚未完成接入验证。插件可以拥有自己的 Orchestration Loop；真正需要审计的是其执行是否与宿主的权限、工作区和会话契约一致，而不是是否存在名为 `AgentRuntime` 或 `runMessageLoop` 的代码。

## 3. 状态定义

- **Verified**：代码路径、实际行为、自动化测试和运行证据齐全。
- **Implemented-Unverified**：代码存在，缺少当前基线运行证据。
- **Partial**：只完成部分链路。
- **Not Implemented**：不存在或未接入。
- **Blocked**：环境或外部条件阻塞验证。

## 4. 文档目录

| 文档                                                                                 | 用途                                                           |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [PLAN.md](./PLAN.md)                                                                 | 三阶段任务、依赖、实施步骤、验证、证据和 Go/No-Go 的唯一总计划 |
| [00_CODE_REVIEW.md](./00_CODE_REVIEW.md)                                             | 当前代码审查和风险证据                                         |
| [01_PRODUCT_ARCHITECTURE.md](./01_PRODUCT_ARCHITECTURE.md)                           | 产品架构概览                                                   |
| [02_TECHNICAL_ARCHITECTURE.md](./02_TECHNICAL_ARCHITECTURE.md)                       | 技术架构概览                                                   |
| [03_PRD.md](./03_PRD.md)                                                             | v0.1 产品需求和发布门槛                                        |
| [04_TEST_PLAN_AND_CASES.md](./04_TEST_PLAN_AND_CASES.md)                             | 测试策略和用例基线                                             |
| [05_FUNCTIONAL_TEST_REPORT.md](./05_FUNCTIONAL_TEST_REPORT.md)                       | 当前功能验证报告                                               |
| [06_ITERATION_PLAN.md](./06_ITERATION_PLAN.md)                                       | 三阶段路线摘要；不替代任务级总计划                             |
| [07_REQUIREMENT_TRACEABILITY.md](./07_REQUIREMENT_TRACEABILITY.md)                   | 需求—代码—测试—证据矩阵                                        |
| [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md)                                               | v0.1 范围冻结                                                  |
| [09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md)                 | v0.1~v0.3 分阶段产品架构详版                                   |
| [10_V0.1_TECHNICAL_ARCHITECTURE.md](./10_V0.1_TECHNICAL_ARCHITECTURE.md)             | v0.1~v0.3 分阶段技术架构详版                                   |
| [11_V0.1_AGENT_INTEGRATION_PLAN.md](./11_V0.1_AGENT_INTEGRATION_PLAN.md)             | v0.2 oh-my-deepagent 插件集成计划                              |
| [12_V0.1_GATEWAY_PLAN.md](./12_V0.1_GATEWAY_PLAN.md)                                 | v0.3 Gateway 正式交付计划                                      |
| [13_V0.1_MIGRATION_MANIFEST.md](./13_V0.1_MIGRATION_MANIFEST.md)                     | v0.2/v0.3 Keep/Adapt/Bridge/Replace/Remove 清单                |
| [14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)             | Host Runtime 与插件编排勘误                                    |
| [15_V0.1_RELEASE_AND_COEXISTENCE_PLAN.md](./15_V0.1_RELEASE_AND_COEXISTENCE_PLAN.md) | 第一阶段发行身份、官网安装和 OpenCode 共存专项说明             |

## 5. 已确认的三阶段范围

1. 第一阶段交付 CLI-first Alpha/Beta：独立身份、官网安装、DeepSeek 最小任务链和 OpenCode/Oh-my-OpenAgent 共存是发布硬门槛。
2. 第二阶段完成 Provider/Harness、内置 Agent 插件、角色/技能/规划、Subagent/Multi-Agent、Gateway Core 和飞书；每项按证据标记 Experimental/Beta/Stable。
3. 第三阶段先完成 UX 研究、信息架构、原型、`DESIGN.md` 和用户批准，再改造 `packages/app`/`packages/ui`，最后用 `packages/desktop` 发布 Electron。
4. 不删除插件编排、Subagent 或 Multi-Agent 设计；未集成能力不得写成当前 Stable 能力。
5. Desktop 在设计门禁、独立 App ID、协议、目录、更新源、签名和共存验证前不得发布。
6. 安全、Provider Contract、安装、CI、共存和运行证据是第一阶段发布硬门槛。

## 6. 当前判断边界

目前已确认 `packages/oh-my-deepagent` 包含独立组合的 AgentRuntime、消息循环、工具、记忆、Provider 和 Transport 实现；尚未完成：

- 它们是否被当前生产入口调用；
- 它们与原始 oh-my-OpenAgent 插件契约的关系；
- 它们是插件编排、兼容层、测试 Runtime 还是重复实现；
- 哪些应 Keep、Adapt、Bridge、Replace 或 Remove。

因此，v0.2 Agent 集成前必须生成真实调用图和架构来源审计，不得预设删除。v0.1 先完成发行身份、共存隔离和最小运行链。

## 7. 决策规则

```text
用户价值明确
AND 宿主—插件边界清楚
AND 主链路真实生效
AND 权限与工作区不可绕过
AND 有自动化测试
AND 有可观察证据
```
