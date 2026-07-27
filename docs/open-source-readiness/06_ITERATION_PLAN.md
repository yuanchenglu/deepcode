# DeepCode v0.1 开源迭代计划

> 版本：2.1
> 状态：Phase 0 范围与架构冻结完成
> 目标：不删除 Gateway 或内置 Agent，以统一 Runtime、安全和验证闭环达到正式开源

## 1. 总体原则

```text
范围冻结
→ 准确盘点
→ 单一 Runtime
→ Built-in DeepAgent
→ Gateway Core / Adapters
→ DeepSeek / Harness
→ 安全门禁
→ Test / CI
→ Install / Release
```

全程冻结：

- 新增第 14 个角色。
- 新增当前列表之外的 Gateway 平台。
- 新增 Harness 模块。
- 新增云端、计费、多租户和 Desktop 专属产品面。

允许工作：

- 使现有 13 角色达到正式质量。
- 使现有 Gateway 平台按 Stable/Beta/Experimental 分级。
- 删除重复 Runtime 和不安全路径。
- 补主链路、测试、文档和发布工程。

## 2. 版本里程碑

| 版本 | 目标 |
|---|---|
| `v0.1.0-alpha.1` | 范围冻结、准确盘点、Runtime API、安全 Kill Switch |
| `v0.1.0-alpha.2` | Built-in DeepAgent 接入，13 Roles 可运行 |
| `v0.1.0-alpha.3` | Gateway Core、Runtime Bridge、飞书主流程 |
| `v0.1.0-beta.1` | Provider/Harness 闭环、Agent/Gateway E2E、CI |
| `v0.1.0-rc.1` | 安全、安装、长运行、外部试用 |
| `v0.1.0` | 可信开源首发 |

## 3. Phase 0：范围与架构冻结

### 状态

**已完成文档阶段。**

### 已产出

- `08_V0.1_SCOPE.md`。
- `09_V0.1_PRODUCT_ARCHITECTURE.md`。
- `10_V0.1_TECHNICAL_ARCHITECTURE.md`。
- `11_V0.1_AGENT_INTEGRATION_PLAN.md`。
- `12_V0.1_GATEWAY_PLAN.md`。
- `13_V0.1_MIGRATION_MANIFEST.md`。
- PRD、架构、迭代和追踪矩阵同步修订。

### 已冻结决策

1. Gateway 进入 v0.1。
2. 飞书目标 Stable。
3. 13 Roles 全部预装。
4. oh-my-deepagent 不独立发布或维护生产 Runtime。
5. 所有入口使用唯一 Runtime。

### Phase 0 退出条件

- 文档无旧范围冲突。
- 每个 Package 有目标定位。
- 删除原则是 migration-first。

## 4. Phase 1：准确盘点与统一 Runtime

> 版本目标：`v0.1.0-alpha.1`

### P1-01 仓库准确盘点

产出机器可核查清单：

- 13 Role 文件、ID、Tools、Skills。
- Skill 清单和冲突。
- oh-my-deepagent 独立 Runtime 入口和调用图。
- Gateway Adapter、Auth、Parser、Outbound、Tests。
- Gateway CLI 子进程桥调用图。
- Runtime、Tool Executor、Permission 的重复实现。
- 14 Harness 的 registered / called / applied / tested 状态。

将结果填入 Migration Manifest，禁止根据文档或 Commit Message 猜测。

### P1-02 DeepCode Runtime API

定义并实现：

- createSession。
- resumeSession。
- prompt。
- cancel。
- getSession。
- subscribeEvents。

### P1-03 Runtime Event Contract

统一：

- role.decided / applied。
- model.decided / applied。
- tool / permission。
- reasoning / text。
- evidence / completion / error。

### P1-04 安全 Kill Switch

在完整安全整改完成前：

- Gateway 默认关闭。
- 公网绑定拒绝或要求显式危险确认。
- 无 Auth Adapter 不注册。
- 已知 deny 绕过路径标记阻断测试。

### Phase 1 退出条件

- 准确清单完成。
- Runtime API 有集成测试。
- CLI 可通过新 Runtime API 完成基础对话。
- Gateway 和 Agent 可以开始接入，不需复制 Runtime。

## 5. Phase 2：Built-in DeepAgent 正式接入

> 版本目标：`v0.1.0-alpha.2`

### P2-01 Role Registry

- 13 ID 唯一。
- 默认 Build。
- 核心 / 高级角色分组。
- Tool / Skill 引用验证。
- 成熟度和风险元数据。

### P2-02 Context 集成

- Role Prompt 进入 Context Projector。
- 角色切换产生动态 Context Update。
- role.decided / role.applied。

### P2-03 Tool / Skill Policy

实现：

```text
Registry
∩ Role Tools
∩ Skill Tools
∩ Permission
∩ Entry Capability
```

### P2-04 同 Session 切换

- CLI/TUI 选择和切换。
- Plan → Build → Review。
- Gateway 可携带或保存 Role。
- 不复制 Session。

### P2-05 测试

- 13 Role Unit。
- 13 Role Scenario。
- 核心和关键高级角色 Runtime E2E。
- Tool 越权负向测试。

### P2-06 删除重复 Agent Runtime

在替代路径和测试通过后删除：

- Message Loop。
- Session Store。
- Provider Invocation。
- Tool Executor。
- Permission。
- Memory Runtime。
- 独立 CLI。

### Phase 2 退出条件

- 13 Roles 全部预装可选。
- 不存在第二套生产 Agent Runtime。
- Role Tool Policy 不可绕过。
- 核心角色 E2E 通过。

## 6. Phase 3：Gateway Core 重构

> 版本目标：`v0.1.0-alpha.3`

### P3-01 Adapter Contract

- verifyInbound。
- parse 多消息。
- send。
- health。
- capabilities。

### P3-02 Core Security Pipeline

- Raw Body。
- Auth。
- Timestamp。
- Replay。
- Idempotency。
- Body / Rate Limit。

### P3-03 Identity / Workspace

- 多维 Identity。
- User Allowlist。
- Workspace Allowlist。
- Permission Profile。
- Allowed Roles。

### P3-04 Session / Queue

- 多维 Session Key。
- 有界 Queue。
- 同 Session 保序。
- 跨 Session 受控并发。

### P3-05 Runtime Bridge

```text
Gateway
→ DeepCodeRuntime.prompt()
→ Runtime Events
→ Response Aggregator
→ sourceAdapter.send()
```

### P3-06 Legacy Path

- Legacy CLI Bridge 默认关闭。
- 新桥完成并通过 E2E 后删除。
- 删除第一个 Adapter 回包和 chatId-only Session。

### Phase 3 退出条件

- Gateway Core 自动测试通过。
- 鉴权先于入队。
- Gateway 直接调用统一 Runtime。
- Session 和 Adapter 路由正确。

## 7. Phase 4：平台 Adapter 完整化

### P4-01 飞书 Stable

- 官方 WS / Webhook。
- Auth、Challenge、Parser。
- 私聊、群聊。
- Replay / Idempotency。
- Workspace / User Policy。
- Role 选择。
- 多轮 Session。
- 回包、分段、重连。
- Mock + 真机 E2E。

### P4-02 Beta Adapter 选择

从企业微信、Telegram、Slack 选择至少两个，基于 Phase 1 准确盘点评估：

- 当前实现完整度。
- 安全协议复杂度。
- Fixture 和测试资产。
- 真机验证可获得性。
- 维护成本。

### P4-03 Experimental Adapter

其余平台：

- 保留源码。
- 接入统一 Contract 或记录迁移计划。
- 默认关闭。
- 限制说明。

### Phase 4 退出条件

- 飞书 Stable Matrix 全通过。
- 至少两个 Beta Adapter，或新增经确认 ADR。
- 每个平台状态与证据一致。

## 8. Phase 5：DeepSeek Provider 与 Harness 闭环

### P5-01 Provider Contract

- Wire Body。
- Text / Reasoning / Tool SSE。
- Usage / Cache。
- 4xx / Overflow / Abort。

### P5-02 Model Routing

- 决策在 Resolve 前。
- concrete model applied。
- 单模型退化。
- Applied Rate = 100%。

### P5-03 Reasoning

- effort capability。
- History Projection。
- Tool Continuation。
- 跨模型 Metadata。

### P5-04 Constraints / Scope / Review

- Constraint 提取、查看、删除、压缩保留、Enforcement。
- Scope 初始化。
- Unified Tool Guard。
- Review Enforcement / Advisory 区分。

### P5-05 其他 Harness

OKR、Anti-drift、Memory、Meta Directives、Signal、Skill Evolution：

- 按 applied 状态接入。
- 未完成的不冒充 Stable。
- 不新增模块。

### Phase 5 退出条件

- Provider Contract 全通过。
- 至少核心 Harness E2E 全通过。
- README 核心主张有证据。

## 9. Phase 6：安全专项

安全整改在各 Phase 同步进行，本阶段负责完成审计和门禁闭环。

### P6-01 Secret

- 凭据轮换。
- Git 历史清理。
- Gitleaks / Secret Scan。
- SECURITY.md。

### P6-02 Tool / Permission

- deny 修复。
- Workspace / Symlink。
- Shell Policy。
- Environment 和日志脱敏。

### P6-03 Gateway

- Auth / Replay / Rate / Body。
- User / Workspace Allowlist。
- Permission UX。
- Audit Events。

### P6-04 Supply Chain

- Dependency / License Scan。
- Patch Ownership。
- Release Checksum。

### Phase 6 退出条件

- P0 = 0。
- 安全测试为 Required Check。
- 独立安全复审完成。

## 10. Phase 7：测试与 CI

### 根命令

```bash
bun run check
```

### Required Jobs

- static。
- runtime。
- provider-contract。
- deepagent。
- gateway-core。
- gateway-adapters。
- security。
- build-install。

### Artifacts

- JUnit。
- Coverage。
- Contract Fixture（脱敏）。
- Role Scenario Report。
- Gateway Matrix Report。
- Install Log。
- Build Artifact。

### 性能和可靠性

- CLI 启动。
- 100 Turn Session。
- 24 小时 Runtime / Gateway。
- Queue / Timeout / Abort。
- 大文件和 Tool Output Limit。

### Phase 7 退出条件

- develop 最新 Commit CI 全绿。
- P0 用例自动化。
- Test Report 可由 Artifact 生成。

## 11. Phase 8：安装、文档和 Release

### 发布物

一个 DeepCode 发布物，内置：

- Runtime。
- Built-in DeepAgent / 13 Roles。
- Harness。
- Gateway Core。
- 发布范围内 Adapter。

不独立发布 oh-my-deepagent 产品或 Gateway Agent Runtime。

### 文档

- 3 分钟开始。
- Role 指南。
- Gateway 配置和安全。
- Adapter 状态矩阵。
- Architecture / PRD / Test。
- CONTRIBUTING / SECURITY / SUPPORT / UPSTREAM。

### 外部试用

- 至少 3 人完成本地真实任务。
- 至少 3 人完成飞书真实任务。

### Go / No-Go

- 单一 Runtime。
- 13 Roles 预装且测试达标。
- Gateway Core Stable。
- 飞书 Stable。
- Beta Adapter 目标达成或 ADR 调整。
- P0 = 0。
- CI / Install 全通过。
- Claim Evidence Coverage = 100%。

## 12. 工作分解建议

| Workstream | 责任 |
|---|---|
| Runtime | Session、Runtime API、Events、Tool Settlement |
| DeepAgent | Role、Skill、Tool Policy、Role E2E |
| Gateway | Core、Adapter、Session、Delivery |
| Protocol / Harness | DeepSeek Contract、Routing、Reasoning、Constraints |
| Security | Permission、Workspace、Gateway Auth、Secret |
| Release | CI、Package、Install、Docs、External Test |

小团队可以一人多岗，但每个 Issue 必须有 Owner、Requirement、Test ID 和退出条件。
