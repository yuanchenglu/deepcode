# DeepCode 产品架构

> 版本：2.2
> 状态：Phase 0 勘误后基线
> 详细版本：[09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md)
> Runtime 勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 1. 产品定义

DeepCode 是一款针对 DeepSeek 深度优化、内置 oh-my-deepagent 插件系统并支持 Gateway 的开源 Coding Agent。

```text
DeepSeek Model
+ DeepCode/OpenCode Host
+ oh-my-deepagent Plugin
+ DeepCode Harness
+ Gateway
= DeepCode
```

## 2. 宿主—插件关系

OpenCode/DeepCode 与 oh-my-OpenAgent/oh-my-deepagent 的目标关系是宿主与插件共生：

- Host 提供基础 Session、Provider、Tool、Permission、Context 和产品 UI。
- Plugin 提供 Role、Skill、Planning、Delegation、Subagent 和 Multi-Agent Orchestration。
- Plugin 可以有自己的编排循环、状态机和工作记忆。
- 是否存在独立 `AgentRuntime` 或 `runMessageLoop`，不能单独证明存在冲突的第二套生产 Runtime。

正确原则：

> **单一宿主治理边界，允许多个 Agent 编排循环。**

## 3. 产品能力地图

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

## 4. v0.1 正式范围

- DeepSeek Provider 和真实代码任务闭环。
- oh-my-deepagent 预装，无需单独安装产品。
- 现有角色按逐角色测试达到发布质量。
- Plan、Build、Review、Subagent 和编排能力保留。
- Gateway Core Stable，飞书 Stable 目标。
- Permission、Workspace、安全、CI 和 Evidence 达到发布门槛。

## 5. 当前未知项

Phase 1 前尚不能确定：

- oh-my-deepagent 的 AgentRuntime 是否为生产路径；
- 独立 Provider、ToolRunner、MemoryStore、Transport 的正式用途；
- 当前移植是否偏离原始插件架构；
- 哪些代码应 Keep、Adapt、Bridge、Replace 或 Remove。

因此不预设删除插件 Runtime 代码。

## 6. 用户价值

- 本地用户可选择专业 Agent 完成代码工作。
- Gateway 用户可在授权平台中继续同一产品任务。
- Agent 编排可利用不同角色和 Subagent，而不牺牲权限与可观察性。
- 开源贡献者可以从调用图、Contract 和测试理解真实边界。

## 7. 成功标准

- 用户只需安装 DeepCode。
- Host 与 Plugin 职责清楚但不互相压扁。
- 插件编排能力完整保留。
- 真实副作用遵守安全契约。
- 角色、Gateway、Provider 和 Harness 均有运行证据。
