# DeepCode 技术架构

> 版本：3.0
> 状态：分阶段目标技术架构；v0.1 发行隔离优先
> 详细版本：[10_V0.1_TECHNICAL_ARCHITECTURE.md](./10_V0.1_TECHNICAL_ARCHITECTURE.md)
> Runtime 勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 新增发行身份/共存边界；Plugin/Gateway Contract 改为 v0.2/v0.3 目标 | 开源准备复核与用户确认 |

## 1. 核心原则

1. v0.1 用户可见和持久化边界必须使用 DeepCode 独立命名空间，不得默认读取 OpenCode 状态。
2. Host 对真实副作用、权限、工作区和正式证据保持治理权。
3. v0.2 oh-my-deepagent 可拥有 Role、Subagent 和 Multi-Agent Orchestration Loop。
4. “存在独立 Runtime 类”不等于“存在第二套生产 Runtime”。
5. 先做调用图和上游插件契约审计，再做迁移或删除。
6. Enforcement fail-closed，Advisory 必须可观察。
7. Provider、Tool、Reasoning 和 Gateway 必须验证 Applied Behavior。

## 2. 目标技术边界

下图是 v0.1~v0.3 目标拓扑，不代表 Plugin/Gateway 已进入当前生产链：

```text
CLI/TUI/Gateway
       ↓
DeepCode/OpenCode Host
├── Session / Task Identity
├── Provider / Context / History
├── Tool / Permission / Workspace
├── Harness / Evidence
└── Plugin Contract
       ↓
oh-my-deepagent
├── Role / Skill
├── Planning / Delegation
├── Subagents
├── Multi-Agent Orchestration
└── Compatibility/Test Components
```

## 3. Host 与 Plugin 的状态关系

必须区分：

- Canonical Session/Task；
- Plugin Orchestration State；
- Parent/Child Agent State；
- Scratch Memory；
- Durable Memory；
- Test Fixture Memory。

插件拥有 MemoryStore 并不天然冲突。只有两个状态源同时对同一事实自称权威、恢复语义不一致时，才属于架构缺陷。

## 4. Tool 和 Permission

插件可以使用 ToolRunner 或 Tool Adapter。生产副作用必须满足：

```text
Role/Skill Policy
→ Permission
→ Workspace/Sandbox
→ Execute
→ Settlement
→ Evidence
```

具体由 Host 直接执行、Plugin Bridge 执行还是 Adapter 执行，需依据原始插件契约和当前调用图决定。

## 5. Provider

插件 Provider 可能属于：

- Host Provider Adapter；
- Compatibility Layer；
- Subagent Provider；
- Test Runtime；
- Transitional Code。

在 Contract 和调用方审计前，不预设删除。

## 6. Gateway（v0.3）

Gateway 负责平台 Auth、Identity、Workspace/Session Mapping、Queue 和 Delivery。Gateway 进入 Host/Plugin 产品链路，但不能复制或绕过 Permission 和 Workspace 语义。

## 7. 分阶段技术交付

### v0.1

- CLI/help、配置、数据、数据库、环境变量和 install/upgrade/uninstall 独立命名空间；
- DeepSeek Provider/Permission 最小任务链；
- Release、CI 和 OpenCode/Oh-my-OpenAgent 共存测试。

### v0.2/v0.3

- 原始 OpenCode/oh-my-OpenAgent 插件契约报告。
- 当前生产入口调用图。
- oh-my-deepagent Runtime/Loop/Provider/Tool/Memory/Transport 分类。
- Host-Plugin Session、Tool、Provider、Memory Contract。
- Gateway 调用图。
- Keep/Adapt/Bridge/Replace/Remove 建议。

## 8. 删除门槛

不允许仅以以下理由删除代码：

- 类名包含 Runtime；
- 存在 Message Loop；
- Host 有类似功能；
- 希望架构看起来只有一条 Loop。

必须有调用图、原始职责、替代路径和回归测试证据。
