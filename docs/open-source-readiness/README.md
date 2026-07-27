# DeepCode 开源准备文档基线

> 分支：`develop`
> 基线日期：2026-07-27
> 当前阶段：Phase 0 范围与架构冻结完成
> 目标：以“能够真实、可信、可维护地开源”为唯一迭代目标

## 1. 文档权威性

本目录是 DeepCode 当前唯一的开源准备权威文档集。旧版 `docs/REQUIREMENTS.md`、`docs/ARCHITECTURE.md`、`docs/analysis/*` 保留为历史材料，但其中存在“设计计划被误标为已完成”“验收项缺少运行证据”等问题，不能直接作为当前实现状态依据。

状态统一采用四态：

- **已验证**：有可重复执行的测试或运行证据。
- **已实现未验证**：代码存在，但缺少可重复运行证据。
- **部分实现**：仅完成模块、接口、记录或旁路逻辑，未形成完整产品闭环。
- **未实现**：没有可用实现，或实现未接入主执行路径。

产品成熟度另采用：

- **Stable**：需求、主链路、Applied Behavior、自动测试、运行证据、安全审查和文档齐全。
- **Beta**：主流程可用且无 P0，仍缺少部分环境或长期验证。
- **Experimental**：默认关闭或限制明确，不作为正式支持承诺。

## 2. 已确认的 v0.1 产品决策

1. Gateway 是 v0.1 一级产品能力，Gateway Core 目标 Stable。
2. 飞书是第一个 Stable Adapter 目标。
3. `oh-my-deepagent` 正式内置到 DeepCode，13 个角色全部预装。
4. oh-my-deepagent 不作为独立产品、独立 CLI 或第二套生产 Runtime。
5. CLI、TUI、Gateway 和 Built-in DeepAgent 共享唯一 Session、Provider、Tool、Permission、Context 和 Harness Runtime。
6. v0.1 不通过删除 Gateway 或角色降低目标，而通过统一架构、安全修复、成熟度分级和测试门禁完成收敛。

## 3. 文档目录

### 审计与基础文档

| 文档 | 用途 |
|---|---|
| [00_CODE_REVIEW.md](./00_CODE_REVIEW.md) | 当前代码审查结论、风险分级和证据 |
| [01_PRODUCT_ARCHITECTURE.md](./01_PRODUCT_ARCHITECTURE.md) | 产品架构权威入口，引用 Phase 0 决策 |
| [02_TECHNICAL_ARCHITECTURE.md](./02_TECHNICAL_ARCHITECTURE.md) | 技术架构权威入口，引用唯一 Runtime 架构 |
| [03_PRD.md](./03_PRD.md) | 完整产品需求、验收标准、非功能需求和发布门槛 |
| [04_TEST_PLAN_AND_CASES.md](./04_TEST_PLAN_AND_CASES.md) | 测试策略、环境、分层测试和完整用例 |
| [05_FUNCTIONAL_TEST_REPORT.md](./05_FUNCTIONAL_TEST_REPORT.md) | 当前功能验证报告及未验证项说明 |
| [06_ITERATION_PLAN.md](./06_ITERATION_PLAN.md) | 修订后的 v0.1 执行阶段和里程碑 |
| [07_REQUIREMENT_TRACEABILITY.md](./07_REQUIREMENT_TRACEABILITY.md) | 产品主张到代码、测试、证据的追踪矩阵 |

### Phase 0 冻结文档

| 文档 | 用途 |
|---|---|
| [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md) | 已确认的 v0.1 范围、成熟度、删除原则和 Go/No-Go |
| [09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md) | Runtime、Built-in DeepAgent、Gateway 的统一产品架构 |
| [10_V0.1_TECHNICAL_ARCHITECTURE.md](./10_V0.1_TECHNICAL_ARCHITECTURE.md) | 唯一 Runtime API、Tool 链、Agent 与 Gateway 技术边界 |
| [11_V0.1_AGENT_INTEGRATION_PLAN.md](./11_V0.1_AGENT_INTEGRATION_PLAN.md) | 13 角色正式预装及 oh-my-deepagent 合并计划 |
| [12_V0.1_GATEWAY_PLAN.md](./12_V0.1_GATEWAY_PLAN.md) | Gateway Core、飞书 Stable 和 Adapter 分级计划 |
| [13_V0.1_MIGRATION_MANIFEST.md](./13_V0.1_MIGRATION_MANIFEST.md) | 保留、集成、替换、迁移后删除和归档清单 |

## 4. 当前产品判断

DeepCode 的目标产品结构是：

```text
DeepCode Runtime
+ Built-in DeepAgent（13 Roles）
+ DeepCode Gateway
+ DeepSeek-native Provider / Harness
= DeepCode v0.1
```

当前整体仍处于 **研究型 Alpha / 集成验证阶段**，尚不满足正式开源发布条件。主要原因：

1. 若干核心卖点未真正改变主执行路径。
2. Gateway 入站安全、Session、Queue 和 Runtime Bridge 尚未闭环。
3. oh-my-deepagent 仍需移除重复 Runtime 并接入统一 Tool/Permission。
4. 13 个角色缺少完整 Runtime 场景验证。
5. 缺少统一、可重复的测试与发布门禁。
6. 开源安装、配置、贡献和安全响应闭环尚未完成。

## 5. Phase 0 完成定义

Phase 0 只完成文档和架构冻结，不修改业务代码。

已完成：

- v0.1 产品范围确认。
- Gateway 正式产品定位。
- 13 角色正式预装目标。
- 唯一 Runtime 原则。
- 产品和技术目标架构。
- Agent 集成计划。
- Gateway 交付计划。
- 迁移与删除清单。

下一阶段进入代码前，必须先按迁移清单完成准确仓库盘点，生成真实 13 角色、Gateway Adapter、独立 Runtime 和调用方清单。

## 6. 决策规则

后续所有需求、代码和文档变更必须满足：

```text
用户价值明确
AND 符合已冻结 v0.1 范围
AND 使用唯一生产 Runtime
AND 主链路真实生效
AND 有自动化测试
AND 有可观察证据
AND 安全边界可验证
```

任何缩减 Gateway、13 角色或唯一 Runtime 目标的变更，必须新增 ADR 并经产品确认，不得在代码整改中隐式改变。
