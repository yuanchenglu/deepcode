# DeepCode Phase 0 架构勘误：Host Runtime 与 Agent Orchestration

> 日期：2026-07-27
> 分支：`develop`
> 状态：架构原则继续生效；旧 Phase 1 编号已由迭代计划 v3.0 重新编排
> 影响范围：Phase 0 中关于“唯一生产 Runtime”“第二套生产 Agent Loop”“oh-my-deepagent 独立 Runtime”的判断

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 保留 Runtime 勘误结论；原 Phase 1 审计后移为 v0.2 Agent 审计，避免与新版发行隔离 Phase 1 重名 | 开源准备复核与用户确认 |

## 1. 勘误结论

Phase 0 文档此前将以下事实：

- `packages/oh-my-deepagent` 中存在 `AgentRuntime`、`runMessageLoop`、`ToolRunner`、`MemoryStore`、Provider 和 Transport 等可独立组合的实现；

过度推导为：

- DeepCode 当前已经存在两套相互竞争的生产 Agent Runtime；
- oh-my-deepagent 的 Agent Loop 应当被合并或删除。

该推导证据不足，现予以撤销。

源码存在一套可独立运行的实现，只能证明其具备独立执行能力，不能证明它已经被生产入口使用，也不能证明它与 OpenCode/DeepCode 的插件关系冲突。

## 2. 正确产品关系

DeepCode 与 oh-my-deepagent 的目标关系是宿主与插件的共生关系：

```text
DeepCode / OpenCode Host
├── Session、Provider、Tool、Permission、Context、History
└── Plugin API / Hooks
    └── oh-my-deepagent
        ├── Roles
        ├── Skills
        ├── Planning
        ├── Delegation
        ├── Subagents
        └── Multi-Agent Orchestration
```

oh-my-deepagent 不替代宿主，但可以在宿主之上实现自己的编排逻辑。

## 3. 必须区分的三类循环

### 3.1 Host Execution Loop

宿主负责基础模型与工具执行：

```text
LLM Request
→ Tool Call
→ Permission / Workspace Policy
→ Tool Execute
→ Tool Result
→ Next LLM Request
```

### 3.2 Plugin Orchestration Loop

oh-my-deepagent 可以负责：

- Role 选择与切换；
- Plan → Build → Review；
- 主 Agent 与 Subagent 委派；
- 多 Agent 编排；
- 失败重试与结果聚合；
- 专业 Agent 的阶段性工作流。

该类循环属于插件价值，不应因为“只有一个宿主 Runtime”而被删除。

### 3.3 Compatibility / Test Runtime

`AgentRuntime`、`runMessageLoop`、独立 Provider、ToolRunner、MemoryStore 和 Transport 可能承担：

- 插件独立测试；
- 兼容层；
- 参考实现；
- 尚未接入宿主的过渡实现；
- 独立开发和回归测试工具。

其最终定位必须通过调用图、生产入口、原始项目架构和测试用途审计后确定。

## 4. 修正后的架构原则

此前的“唯一生产 Runtime”改为：

> **单一宿主执行边界，允许多个可组合的 Agent 编排循环。**

含义：

1. 宿主对真实工作区副作用、权限和正式会话保持最终治理权。
2. 插件可以维护编排状态、Subagent 状态和角色工作记忆。
3. 插件可以实现自己的 Orchestration Loop。
4. 插件不得无意绕过宿主的 Permission、Workspace Policy 和审计机制。
5. 插件直接调用模型、工具或存储是否合理，必须依据原始插件契约和具体场景判断，不能预先禁止。
6. 不以文件名称或类名称认定“重复生产 Runtime”。

## 5. 撤销的预设删除结论

在 v0.2 Agent 审计完成前，不再预设删除：

- `AgentRuntime`；
- `runMessageLoop`；
- `ToolRunner`；
- `MemoryStore`；
- OpenAI/Anthropic Compatible Provider；
- InProcess/HTTP/CLI Transport；
- 任何 Subagent 或 Multi-Agent 编排循环。

只有同时满足下列条件，才能进入删除清单：

```text
生产调用图已确认
+ 原始插件契约已核对
+ 功能用途已分类
+ 替代路径已实现
+ 回归测试已通过
+ 删除不会损失插件能力
```

## 6. v0.2 Agent 审计调整

原 Phase 1 的 Runtime 审计任务后移至 v0.2，内容保持为：

1. 还原 OpenCode 与原始 oh-my-OpenAgent 的宿主—插件契约。
2. 生成当前 DeepCode 与 oh-my-deepagent 的真实调用图。
3. 标记 Host Execution、Plugin Orchestration、Compatibility/Test 三类代码。
4. 确认 Gateway 如何选择 Role、创建 Session 和调用插件。
5. 再决定 Keep、Adapt、Bridge、Replace 或 Remove。

## 7. 文档优先级

本勘误高于此前 Phase 0 中所有与下列措辞相关的结论：

- “禁止第二套生产 Agent Loop”；
- “oh-my-deepagent 不应有独立消息循环”；
- “必须删除独立 AgentRuntime”；
- “所有 Tool/Memory/Provider 实现都必须合并到宿主”。

后续文档统一使用：

> **Host Runtime Governance + Plugin Orchestration**
