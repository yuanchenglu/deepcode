# DeepCode 产品需求文档（PRD）

> 版本：2.2
> 状态：Phase 0 勘误后范围冻结
> 产品阶段：Research Alpha → Open-source v0.1
> 第一目标：发布一个可安装、可执行、可验证、默认安全，内置 oh-my-deepagent 并支持 Gateway 的 DeepSeek-native Coding Agent
> 架构勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 1. 文档目的

本 PRD 定义 v0.1 正式产品范围。完成度以用户闭环、Applied Behavior、自动化测试和运行证据衡量。

## 2. 产品定义

```text
DeepCode/OpenCode Host
+ Built-in oh-my-deepagent Plugin
+ DeepCode Harness
+ DeepCode Gateway
= DeepCode v0.1
```

用户只需安装 DeepCode；oh-my-deepagent 作为内置插件直接可用。

## 3. 核心架构约束

### PRD-ADR-001 Host Runtime Governance

DeepCode/OpenCode Host 对以下产品级能力保持最终治理或明确 Contract：

- Workspace 和真实副作用；
- Permission 和用户确认；
- 正式 Session/Task Identity；
- Provider/Tool 调用审计；
- Context、History 和 Evidence。

### PRD-ADR-002 Plugin Orchestration

oh-my-deepagent 可以正式实现：

- Role/Skill；
- Planning；
- Delegation；
- Subagents；
- Multi-Agent Orchestration；
- 独立编排循环和插件工作状态。

不得再使用“禁止第二套生产 Agent Loop”作为需求。正确要求是：

> 插件编排不得无意绕过宿主的安全、工作区和审计契约。

### PRD-ADR-003 Runtime 代码审计

当前 `AgentRuntime`、`runMessageLoop`、`ToolRunner`、`MemoryStore`、Provider 和 Transport 的最终定位未确认。

Phase 1 前不得预设其必须删除或必须全部合并。应通过原始插件契约、生产调用图和测试用途分类。

### PRD-ADR-004 Gateway

- Gateway 是 v0.1 一级能力。
- Gateway Core 目标 Stable。
- 飞书 Adapter 目标 Stable。
- 其他 Adapter 按证据分级。

## 4. 用户画像

- 本地 DeepSeek 开发者。
- 消息平台用户。
- 高级 Agent/Subagent 用户。
- 开源贡献者和 Harness 研究者。

## 5. v0.1 目标

1. 干净环境可安装启动。
2. 正确连接 DeepSeek OpenAI-compatible API。
3. 完成真实仓库读取、修改、Shell 和测试任务。
4. Permission、Workspace、Reasoning、Tool Call 和 Compaction 正确。
5. oh-my-deepagent 角色和 Skill 随 DeepCode 预装。
6. Plan、Build、Review、Subagent 和编排流程可运行。
7. Gateway Core 和飞书达到发布门槛。
8. Model Routing、Constraints、Scope、Review 真实生效。
9. 所有公开主张有证据。

## 6. 非目标

- 云托管和商业计费。
- 企业多租户、SSO 和管理后台。
- 所有 Gateway Adapter 同时 Stable。
- 无监督高风险多 Agent 写入。
- 未经调用图审计的大规模 Runtime 删除。

## 7. 核心用户故事

### US-001 本地任务

用户安装 DeepCode，选择 Role，完成代码修改并获得测试证据。

### US-002 Agent 编排

用户可使用 Plan → Build → Review，或由主 Agent 委派 Subagent，并在同一产品任务中聚合结果。

### US-003 Gateway

授权用户可在飞书中选择 Workspace 和 Role，继续任务并收到结果。

### US-004 安全

无论任务来自 Host Loop 还是 Plugin Orchestration，deny、Workspace 和 Secret 规则都不可绕过。

## 8. 安装需求

### FR-INSTALL-001

至少提供一种经验证的安装方式：npm/bun Package 或 GitHub Release Binary。

验收：

- macOS/Linux 干净环境安装成功；
- `deepcode --version`、`deepcode --help` 正常；
- 包含 Host、内置插件、Gateway Core 和发布 Adapter；
- 不要求单独安装 oh-my-deepagent 产品。

### FR-INSTALL-002 Doctor

检查 Runtime、Workspace、Provider、Role/Skill Registry、Gateway 和 Secret 配置。

## 9. Host Session 与 Task

### FR-SESSION-001

正式任务具有 Host Session/Task ID、Workspace、Role、Model、Permission 和 Evidence。

### FR-SESSION-002 Plugin Mapping

插件可维护 Orchestration ID、Parent/Child Task 和工作记忆，但必须可映射到正式任务。

### FR-SESSION-003 Resume/Cancel

本地、Gateway、Parent Agent 和 Subagent 的恢复与取消语义必须明确。

### FR-SESSION-004 State Authority

必须记录 Canonical History、Orchestration State、Scratch Memory 和 Durable Memory 各自的权威范围。

## 10. DeepSeek Provider

- API Key、Base URL、Model、Context/Output Limit 可配置。
- Text、Reasoning、Tool Call、Usage、Cache、Abort 和 Error 可处理。
- Wire Body 和 SSE 必须通过 Contract Test。
- Plugin Provider Adapter 的保留或桥接方案由 Phase 1 审计决定。

## 11. Built-in oh-my-deepagent

### FR-AGENT-001 预装

仓库现有角色全部随 DeepCode 安装。准确清单从 Registry 和源码生成。

### FR-AGENT-002 Role/Skill

每个角色必须定义 ID、说明、Prompt、Tools、Skills、Risk、Maturity 和测试场景。

### FR-AGENT-003 Orchestration

正式支持：

- 用户显式选 Role；
- Plan → Build → Review；
- Role 切换；
- Parent → Subagent；
- 结果聚合；
- 失败和取消传播。

### FR-AGENT-004 Multi-Agent Safety

- 子 Agent 默认不能扩大父任务权限。
- 并行写入需要冲突控制。
- 所有真实副作用可追踪到 Agent/Task。

### FR-AGENT-005 Runtime Classification

对 AgentRuntime、Message Loop、ToolRunner、MemoryStore、Provider、Transport 分别标记 Host Integration、Plugin Orchestration、Compatibility、Test Runtime、Transitional 或 Unused。

## 12. Tool 与 Permission

生产副作用必须满足：

```text
Role/Skill Policy
→ Permission
→ Workspace/Sandbox
→ Execute
→ Settlement
→ Evidence
```

允许插件存在 ToolRunner/Adapter；只有绕过上述契约时才属于缺陷。

要求：

- allow/ask/deny 正确；
- deny 不进入 preapproved；
- Symlink 逃逸阻止；
- Shell 有 cwd、Timeout、Abort、输出和环境限制；
- Subagent 权限继承/收缩规则明确。

## 13. Harness

- Model Decision 必须 Applied。
- Reasoning Lifecycle 不破坏 Tool Continuation。
- Hard Constraints 在压缩后保留。
- Scope/Review 区分 Enforcement 和 Advisory。
- Agent/Role/Model/Tool 决策有事件证据。

## 14. Gateway

### FR-GW-001 Core

Gateway Core 提供 Server、Adapter Registry、Auth、Replay、Idempotency、Rate Limit、Queue、Session Mapping、Workspace Policy 和 Delivery。

### FR-GW-002 安全

默认关闭、默认本地地址；公网启用必须有 Auth、Workspace Allowlist 和 User Policy。

### FR-GW-003 Plugin Integration

Gateway 可选择 Role 并调用 Agent 编排。它不能复制或绕过 Permission/Workspace 语义。

### FR-GW-004 Feishu

飞书完成 Auth、Parser、私聊/群聊、多轮、幂等、分段、重连和真机 E2E。

## 15. 测试需求

必须覆盖：

- Host Execution Loop；
- Plugin Orchestration Loop；
- Parent/Subagent；
- State Authority；
- Host-Plugin Tool/Permission Contract；
- Provider Contract；
- Gateway Core 和飞书；
- Install/CI/Security。

不得使用“只有一条 Loop”作为测试成功条件。

## 16. Phase 1 必备产出

1. 原始 OpenCode/oh-my-OpenAgent 插件契约报告。
2. Host/Plugin/Gateway 调用图。
3. Runtime 组件分类表。
4. State Authority Matrix。
5. Tool/Permission Path Matrix。
6. 更新后的 Keep/Adapt/Bridge/Replace/Remove 计划。

## 17. 发布门槛

- P0 安全问题为 0。
- Provider Contract 通过。
- 本地任务 E2E 通过。
- 核心角色、Subagent 和编排场景通过。
- Gateway Core/飞书通过。
- 安装和 CI 通过。
- README Claim Evidence Coverage = 100%。
- 无基于错误 Runtime 假设执行的能力损失。
