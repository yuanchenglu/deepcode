# DeepCode 产品架构

> 版本：2.1
> 状态：Phase 0 范围冻结
> 详细冻结版本：[09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md)

## 1. 产品定义

DeepCode 是一款针对 DeepSeek 深度优化、内置多角色 Agent 系统、支持本地和消息平台双入口的开源 Coding Agent。

```text
DeepCode Runtime
+ Built-in DeepAgent
+ DeepCode Gateway
+ DeepSeek-native Harness
= DeepCode
```

## 2. 已确认的产品边界

### DeepCode Runtime

- 唯一生产 Session、Provider、Tool、Permission、Context 和 Harness 运行时。
- CLI、TUI、Gateway 和内置 Agent 共用。

### Built-in DeepAgent

- `oh-my-deepagent` 不作为独立产品发布。
- 13 个现有角色全部随 DeepCode 预装。
- Build、Plan、Review 是核心角色。
- 其他角色作为高级角色正式内置，并按测试证据标记 Stable 或 Beta。
- 角色不能维护第二套 Session、Tool Loop 或 Permission。

### DeepCode Gateway

- Gateway 是 v0.1 一级产品能力，不再只是外围实验。
- Gateway Core 目标 Stable。
- 飞书 Adapter 目标 Stable。
- 至少两个其他 Adapter 目标 Beta，候选为企业微信、Telegram、Slack。
- 其余 Adapter 保留并按实际验证状态标记 Experimental。

## 3. 产品能力地图

```text
DeepCode
├── Local Workspace
│   ├── CLI
│   ├── TUI
│   └── Session / Evidence
├── Built-in DeepAgent
│   ├── 13 Roles
│   ├── Skills
│   ├── Plan / Build / Review
│   └── Role Selection / Switching
├── Gateway
│   ├── Core
│   ├── Authentication
│   ├── Identity / Workspace Policy
│   ├── Session Routing
│   └── Platform Delivery
├── Runtime
│   ├── Provider
│   ├── Context
│   ├── Tool
│   ├── Permission
│   └── Compaction
├── Harness
│   ├── Intent
│   ├── Model Routing
│   ├── Constraints
│   ├── Scope
│   ├── Reasoning
│   ├── Review
│   └── Memory / Plan / Evolution
└── Open-source Operations
    ├── Install
    ├── Test / CI
    ├── Security
    └── Release / Contribution
```

## 4. 核心用户流程

### 本地任务

```text
Workspace
→ Select Role
→ Understand Goal / Constraints
→ Apply Model and Context Policy
→ Permission
→ Tool Execution
→ Test / Review
→ Evidence
```

### Gateway 任务

```text
Platform Auth
→ Identity / Workspace Policy
→ Session Resolution
→ Select or Keep Role
→ Unified Runtime
→ Permission / Tool
→ Source Adapter Delivery
```

### Agent 协作

```text
Plan
→ Build
→ Review
→ User Decision
```

角色切换发生在同一个 Session 中，不复制上下文或创建第二套 Runtime。

## 5. v0.1 产品范围

完整范围以 [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md) 为准。

必须交付：

1. DeepSeek Provider 和真实 Coding Agent 闭环。
2. 13 个预装角色和统一 Role/Skill/Permission 集成。
3. Gateway Core Stable。
4. 飞书 Stable Adapter。
5. 至少两个 Beta Adapter，或通过显式范围变更 ADR 调整。
6. Model Routing、Hard Constraints、Reasoning、Scope、Review 主链路。
7. 安全、测试、安装和开源治理闭环。

## 6. 不作为 v0.1 阻断的能力

- 云托管和商业计费。
- 企业多租户和 SSO。
- 分布式 Session。
- 无监督并行 Multi-Agent 写入。
- 自动创建并启用全局 Role/Skill。
- 所有 Gateway Adapter 同时达到 Stable。

## 7. 产品成熟度

### Stable

需求、主链路、Applied Behavior、自动测试、运行证据、安全审查和文档齐全。

### Beta

核心用户流程可用、无 P0、自动测试通过，仍缺少部分环境或长期验证。

### Experimental

默认关闭或限制明确，不得作为正式支持能力宣传。

## 8. 产品成功指标

- Verified Task Completion Rate。
- Role Scenario Coverage。
- Permission Bypass = 0。
- Gateway Session Cross-talk = 0。
- Stable Adapter E2E Pass Rate = 100%。
- README Claim Evidence Coverage = 100%。
- P0 Security = 0。

## 9. 相关权威文档

- [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md)
- [09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md)
- [11_V0.1_AGENT_INTEGRATION_PLAN.md](./11_V0.1_AGENT_INTEGRATION_PLAN.md)
- [12_V0.1_GATEWAY_PLAN.md](./12_V0.1_GATEWAY_PLAN.md)
