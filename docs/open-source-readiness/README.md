# DeepCode 开源准备文档基线

> 分支：`develop`
> 基线日期：2026-07-27
> 目标：以“能够真实、可信、可维护地开源”为唯一迭代目标

## 1. 文档权威性

本目录是 DeepCode 当前唯一的开源准备权威文档集。旧版 `docs/REQUIREMENTS.md`、`docs/ARCHITECTURE.md`、`docs/analysis/*` 保留为历史材料，但其中存在“设计计划被误标为已完成”“验收项缺少运行证据”等问题，不能直接作为当前实现状态依据。

状态统一采用四态：

- **已验证**：有可重复执行的测试或运行证据。
- **已实现未验证**：代码存在，但缺少可重复运行证据。
- **部分实现**：仅完成模块、接口、记录或旁路逻辑，未形成完整产品闭环。
- **未实现**：没有可用实现，或实现未接入主执行路径。

## 2. 文档目录

| 文档 | 用途 |
|---|---|
| [00_CODE_REVIEW.md](./00_CODE_REVIEW.md) | 当前代码审查结论、风险分级和证据 |
| [01_PRODUCT_ARCHITECTURE.md](./01_PRODUCT_ARCHITECTURE.md) | 产品定位、用户、能力域、产品边界和核心流程 |
| [02_TECHNICAL_ARCHITECTURE.md](./02_TECHNICAL_ARCHITECTURE.md) | 系统分层、运行时、数据流、安全边界和部署架构 |
| [03_PRD.md](./03_PRD.md) | 完整产品需求、验收标准、非功能需求和发布门槛 |
| [04_TEST_PLAN_AND_CASES.md](./04_TEST_PLAN_AND_CASES.md) | 测试策略、环境、分层测试和完整用例 |
| [05_FUNCTIONAL_TEST_REPORT.md](./05_FUNCTIONAL_TEST_REPORT.md) | 本轮功能验证报告及未验证项说明 |
| [06_ITERATION_PLAN.md](./06_ITERATION_PLAN.md) | 以开源为目标的收敛式迭代计划 |
| [07_REQUIREMENT_TRACEABILITY.md](./07_REQUIREMENT_TRACEABILITY.md) | 产品主张到代码、测试、证据的追踪矩阵 |

## 3. 当前产品判断

DeepCode 不是从零开发的 Coding Agent，而是：

```text
OpenCode 成熟底座
+ DeepSeek V4 Provider/Protocol 适配
+ DeepCode Harness 控制层
+ oh-my-deepagent 角色/技能运行时
+ 多平台消息网关
```

当前整体处于 **研究型 Alpha / 集成验证阶段**，尚不满足生产或可信开源发布条件。主要原因不是功能数量不足，而是：

1. 若干核心卖点未真正改变主执行路径。
2. Gateway 入站安全边界不完整。
3. 产品文档与代码状态失配。
4. 缺少统一、可重复的测试与发布门禁。
5. 开源安装、配置、贡献、许可证和安全响应闭环尚未完成。

## 4. 开源范围原则

首个可开源版本只承诺以下最小闭环：

1. CLI/TUI 中可稳定使用 DeepSeek OpenAI-compatible API。
2. Session、多轮上下文、Tool Call、权限确认可工作。
3. DeepSeek reasoning content 能正确传输、持久化和回放。
4. 至少一条真实生效的 Harness 差异化能力有端到端证据。
5. 安装、配置、测试、构建、发布可复现。
6. 默认安全，不暴露未经鉴权的远程 Agent 入口。

以下内容不作为首个开源版本承诺：

- 11 个消息平台全部生产可用。
- 13 个角色全部达到产品级质量。
- 14 个 Harness 模块全部同时启用。
- 自动 Skill 自进化。
- 分布式 Session、多节点运行。
- 企业级控制台、计费或云托管。

## 5. 决策规则

后续所有需求、代码和文档变更必须满足：

```text
用户价值明确
AND 主链路真实生效
AND 有自动化测试
AND 有可观察证据
AND 不扩大首发维护面
```

不能满足上述条件的功能，不进入首个开源版本。