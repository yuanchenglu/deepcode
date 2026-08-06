# DeepCode 产品架构

> 版本：3.0
> 状态：分阶段目标架构；v0.1 CLI-first Alpha 已修订
> 详细版本：[09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md)
> Runtime 勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 区分 v0.1 当前交付与 v0.2/v0.3 目标架构，新增发行/共存边界 | 开源准备复核与用户确认 |

## 1. 产品定义

DeepCode 的近期产品是与 OpenCode 用户状态隔离的 DeepSeek-native CLI Coding Agent；目标产品再逐步内置 oh-my-deepagent 插件系统并支持 Gateway。

```text
DeepSeek Model
+ Isolated DeepCode CLI/Host                         [v0.1]
+ oh-my-deepagent Plugin / Orchestration             [v0.2]
+ Gateway Core / Feishu                              [v0.3]
+ Independent Desktop Identity                       [later]
= DeepCode Product Roadmap
```

## 2. 宿主—插件关系

OpenCode/DeepCode 与 oh-my-OpenAgent/oh-my-deepagent 的目标关系是宿主与插件共生：

- Host 提供基础 Session、Provider、Tool、Permission、Context 和产品 UI。
- Plugin 提供 Role、Skill、Planning、Delegation、Subagent 和 Multi-Agent Orchestration。
- Plugin 可以有自己的编排循环、状态机和工作记忆。
- 是否存在独立 `AgentRuntime` 或 `runMessageLoop`，不能单独证明存在冲突的第二套生产 Runtime。

正确原则：

> **单一宿主治理边界，允许多个 Agent 编排循环。**

## 3. 目标产品能力地图

下图是分阶段目标，不代表所有节点已接入当前生产入口：

```text
DeepCode
├── User Entry
│   ├── CLI/TUI
│   └── Gateway
├── Host Execution
│   ├── Session/Task
│   ├── Provider
│   ├── Context/History
│   ├── Tool/Permission
│   └── Evidence
├── Built-in Agent Plugin
│   ├── Roles/Skills
│   ├── Plan/Build/Review
│   ├── Delegation/Subagents
│   └── Multi-Agent Orchestration
├── Harness
│   ├── Routing/Reasoning
│   ├── Constraints/Scope
│   └── Review/Memory
└── Gateway
    ├── Auth/Identity
    ├── Workspace/Session Mapping
    └── Adapter Delivery
```

## 4. v0.1 Alpha 正式范围

- DeepSeek Provider 和真实代码任务闭环。
- 一个默认 Coding/Build Agent。
- 独立 CLI、配置、数据、数据库、环境变量和安装生命周期。
- 不读取或修改 OpenCode/Oh-my-OpenAgent 默认状态。
- Permission、Workspace、安全、CI、Release 和 Evidence 达到发布门槛。
- `oh-my-deepagent`、Gateway、Desktop 不进入 v0.1 Stable 主张。

## 5. 当前未知项

v0.2 Agent 审计前尚不能确定：

- oh-my-deepagent 的 AgentRuntime 是否为生产路径；
- 独立 Provider、ToolRunner、MemoryStore、Transport 的正式用途；
- 当前移植是否偏离原始插件架构；
- 哪些代码应 Keep、Adapt、Bridge、Replace 或 Remove。

因此不预设删除插件 Runtime 代码。

## 6. 用户价值

- v0.1 本地用户可从官方制品安装并完成最小代码任务，不干扰现有 OpenCode/Oh-my-OpenAgent。
- v0.2 用户可选择专业 Agent、Subagent 和编排流程。
- v0.3 用户可在授权消息平台中继续同一产品任务。
- 开源贡献者可以从调用图、Contract 和测试理解真实边界。

## 7. 成功标准

- 用户只需安装 DeepCode。
- DeepCode 与 OpenCode/Oh-my-OpenAgent 可共存。
- v0.2 Host 与 Plugin 职责清楚但不互相压扁。
- 插件编排目标能力完整保留。
- 真实副作用遵守安全契约。
- 每个版本只对具有运行证据的能力作公开主张。
