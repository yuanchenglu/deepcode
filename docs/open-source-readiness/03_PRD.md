# DeepCode 产品需求文档（PRD）

> 版本：2.1
> 状态：Phase 0 范围冻结
> 产品阶段：Research Alpha → Open-source v0.1
> 第一目标：发布一个可安装、可执行、可验证、默认安全，内置多角色 Agent 并支持 Gateway 的 DeepSeek-native Coding Agent

## 1. 文档目的

本 PRD 定义 v0.1 正式产品范围。产品完成度以用户闭环、主链路 Applied Behavior、自动化测试和运行证据衡量，不能以 Package、Role 或 Adapter 文件数量衡量。

状态：

- 已验证。
- 已实现未验证。
- 部分实现。
- 未实现。

成熟度：

- Stable。
- Beta。
- Experimental。

完整范围以 [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md) 为准。

## 2. 产品定义

DeepCode 是一款针对 DeepSeek 深度优化、内置 13 个 Agent 角色、支持本地和消息平台双入口的开源 Coding Agent。

```text
DeepCode Runtime
+ Built-in DeepAgent
+ DeepCode Gateway
+ DeepSeek-native Harness
= DeepCode v0.1
```

## 3. 核心架构约束

### PRD-ADR-001 唯一 Runtime

CLI、TUI、Gateway 和 Built-in DeepAgent 必须共享：

- Session。
- Provider。
- Context。
- Harness。
- Tool Executor。
- Permission。
- History / Evidence。

禁止维护第二套生产 Agent Loop。

### PRD-ADR-002 内置 Agent

- `oh-my-deepagent` 作为 DeepCode 内部 Package 维护。
- 不独立发布产品、CLI 或生产 Runtime。
- 13 个现有角色全部预装。

### PRD-ADR-003 Gateway 正式进入 v0.1

- Gateway Core 目标 Stable。
- 飞书 Adapter 目标 Stable。
- 其他 Adapter 分级发布。

## 4. 用户画像

### Persona A：本地 DeepSeek 开发者

需要在真实仓库中完成代码任务，控制权限并获得测试证据。

### Persona B：消息平台用户

需要在飞书等平台中发起、继续和查看受控的 DeepCode 任务。

### Persona C：高级 Agent 用户

需要选择预装专业角色完成规划、实现、审查、研究、调试或其他专业任务。

### Persona D：开源贡献者 / Harness 研究者

需要理解真实主链路、运行测试并扩展 Role、Skill、Adapter 和 Harness。

## 5. v0.1 目标

1. 全新环境可安装并启动。
2. 正确连接 DeepSeek OpenAI-compatible API。
3. 完成真实仓库读取、修改、Shell 和测试任务。
4. Session、Reasoning、Tool Call、Permission 和 Compaction 正确。
5. 13 个角色全部预装，使用统一 Runtime。
6. Build、Plan、Review 和关键高级角色完成 Runtime E2E。
7. Gateway Core 达到 Stable。
8. 飞书 Adapter 达到 Stable。
9. 至少两个其他 Adapter 达到 Beta，或通过显式 ADR 调整。
10. Model Routing、Hard Constraints、Reasoning、Scope、Review 真实生效。
11. 公开主张全部具有追踪证据。
12. 贡献者可通过单命令运行质量门。

## 6. v0.1 非目标

- 云端托管和商业计费。
- 企业多租户、SSO 和管理后台。
- 分布式 Session Runtime。
- 无监督并行 Multi-Agent 高风险写入。
- 自动创建并启用全局 Role/Skill。
- 所有 Adapter 同时达到 Stable。
- Desktop 专属产品重设计。

## 7. 核心用户故事

### US-001 安装和配置

用户能够在干净环境安装 DeepCode，配置 DeepSeek，并在十分钟内完成首次对话。

### US-002 本地代码任务

用户能够读取代码、批准修改、运行测试并获得证据。

### US-003 选择角色

用户能够选择任一预装角色，无需安装独立 Agent 项目。

### US-004 Plan-Build-Review

用户能够在同一个 Session 中由 Plan 规划、Build 执行、Review 审查。

### US-005 复杂模型路由

复杂任务使用配置中的强模型，简单任务使用快速模型，并展示实际 Model ID。

### US-006 权限和范围

deny 永远不可绕过；角色、Skill、Workflow 和 Gateway 均使用同一安全链。

### US-007 飞书任务

已授权用户能够在飞书中选择 Workspace 和 Role，继续同一 Session 并收到结果。

### US-008 Gateway 多平台

贡献者能够通过统一 Adapter Contract 扩展平台，而不复制 Runtime。

### US-009 可验证 Harness

用户能够查看 Role、Model、Reasoning、Scope、Permission 和 Review 的 decided/applied 结果。

## 8. 安装与启动需求

### FR-INSTALL-001 正式安装方式

至少选择一种并验证：

- npm / bun Package；或
- GitHub Release Binary。

验收：

- macOS 和 Linux 干净环境安装成功。
- `deepcode --version` 和 `deepcode --help` 正常。
- 安装包包含 Runtime、Built-in DeepAgent、Gateway Core 和发布范围内 Adapter。
- 不单独安装 oh-my-deepagent。

### FR-INSTALL-002 Doctor

提供环境诊断：

- Runtime 版本。
- Workspace / Git。
- Provider 配置和连接。
- Role Registry 完整性。
- Gateway 配置和 Adapter Health。
- Secret 不进入输出。

### FR-INSTALL-003 首次引导

- Provider 最小配置。
- 默认 Role Build。
- Gateway 默认关闭。
- 可选进入 Gateway 配置向导。

## 9. Workspace 与 Session

### FR-SESSION-001 Workspace

- 默认当前目录。
- 检测 Git 状态。
- 不覆盖用户未提交内容。
- Gateway 只能使用 Allowlist Workspace。

### FR-SESSION-002 唯一 Session

- 本地、Gateway 和角色切换均使用同一 Session Service。
- Session 绑定 Workspace。
- 不同 Workspace 不串话。
- Gateway Identity 可映射到 Session，但不创建另一种 Session 类型。

### FR-SESSION-003 历史协议

- User / Assistant / Reasoning / Tool Call / Tool Result 顺序完整。
- Tool Call ID 对应。
- 同模型保留必要 Metadata。
- 跨模型移除不兼容 Metadata。

### FR-SESSION-004 中断和恢复

- Provider、Tool、Gateway 请求可取消。
- Pending Tool 正确 Settlement。
- Resume 不重复执行已完成副作用。

### FR-SESSION-005 最大步数和资源边界

- Agent Step 上限。
- Tool 重复调用上限。
- Queue、History、Pending 状态有容量或持久化策略。

## 10. DeepSeek Provider

### FR-PROVIDER-001 配置

- API Key Env。
- Base URL。
- Model ID。
- Context / Output Limit。
- Reasoning Capability。
- fast / strong Model Policy（可选）。

### FR-PROVIDER-002 Wire Body

内部 camelCase，协议层转换 snake_case，验证：

- model。
- messages。
- tools / tool_choice。
- stream / stream_options。
- reasoning_effort。
- generation parameters。

### FR-PROVIDER-003 Stream

支持：

- Text Delta。
- Reasoning Delta。
- Tool Call Delta。
- Finish Reason。
- Usage / Cache / Reasoning Tokens。
- Provider Error。

### FR-PROVIDER-004 Tool Continuation

- Tool Call 和 Result 正确回传。
- Reasoning Content 遵循 Endpoint 要求。
- Tool 参数流式拼接完整。

### FR-PROVIDER-005 Contract Test

必须通过 Mock Server 捕获最终 Wire Body 和 SSE，不允许只测 ProviderOptions。

## 11. Built-in DeepAgent

### FR-AGENT-001 预装

- 13 个仓库现有角色全部随 DeepCode 安装。
- Phase 1 从 Registry 生成准确角色清单。
- 角色无需额外下载或安装。

### FR-AGENT-002 Role Definition

每个角色必须定义：

- id。
- displayName。
- description。
- systemPrompt。
- tools。
- skills。
- risk。
- maturity。
- scenarios。

### FR-AGENT-003 核心和高级角色

- Build、Plan、Review 一级展示。
- 其余角色进入高级角色区域。
- 高级不等于 Experimental；成熟度由测试决定。

### FR-AGENT-004 Role 选择和切换

- 默认 Build。
- 用户可显式选择。
- Gateway 可在授权范围内选择。
- 切换发生在同一 Session。
- 切换生成 decided/applied Event。
- 失败时保留原 Role。

### FR-AGENT-005 Tool 白名单

实际 Tool：

```text
Registry
∩ Role Tools
∩ Skill Tools
∩ Permission
∩ Workspace / Entry Capability
```

- 白名单外 Tool 不可见。
- deny 优先。
- Skill 不扩权。

### FR-AGENT-006 Skill

- 引用存在。
- 依赖和冲突可验证。
- Context 和 Tool 通过统一 Runtime 应用。
- Skill Evolution 不自动修改全局 Skill。

### FR-AGENT-007 协作

正式支持：

- Plan → Build → Review。
- 同 Session 和 Task。
- 用户显式切换。

Beta：

- Intent 推荐角色。
- Review 请求 Build 修正。

### FR-AGENT-008 测试

- 13 个 Role Registry / Prompt / Tool / Skill 单元测试。
- 每个角色至少一个自动化场景测试。
- 核心和关键高级角色完成真实 Runtime E2E。
- 不可用角色不能以 Stable 发布。

## 12. Agent Tool Loop

### FR-TOOL-001 统一执行器

所有入口共用：

```text
Lookup
→ Role / Skill Filter
→ Schema
→ Permission
→ Workspace / Scope / Sandbox
→ Execute
→ Settlement
→ Evidence
```

### FR-TOOL-002 Permission

- allow / ask / deny。
- 无规则默认 ask。
- deny 不能进入 preapproved。
- once / always Pattern 正确。

### FR-TOOL-003 Workspace

- realpath + relative。
- Symlink 防逃逸。
- Workspace 外写默认 deny。

### FR-TOOL-004 Shell

- cwd 固定。
- 高风险默认 ask。
- Timeout / Abort。
- 环境变量最小暴露。
- 输出限制和脱敏。

## 13. Model Routing 与 Reasoning

### FR-ROUTE-001 Model Decision

输出 providerId、modelId、tier、reason、risk、reasoningEffort。

### FR-ROUTE-002 Applied

- 决策发生在 Resolve 前。
- model.decided 和 model.applied 可对照。
- 单模型配置自动退化。
- Applied Rate 目标 100%。

### FR-REASON-001 Effort

- 按模型能力选择。
- 不支持 `max` 时不发送。
- 非 Reasoning 模型不发送。

### FR-REASON-002 Lifecycle

- 当前 Tool Turn 完整。
- 下一轮在协议允许时摘要。
- 历史在协议允许时剥离。
- 不破坏 Tool Continuation。

## 14. Context、Constraints、Scope 和 Review

### FR-CONTEXT-001 Stable Baseline

- Epoch 内字节稳定。
- Dynamic 内容通过 Update / History。

### FR-CONSTRAINT-001 Hard Constraints

- 提取、来源、查看、删除。
- 压缩后保留。
- Tool 前检查。
- 完成前审查。

### FR-SCOPE-001 Scope

- Plan 输出 expected files。
- 用户或 Policy 确认。
- edit/write/patch 统一检查。
- Shell 使用 Sandbox / Policy。

### FR-REVIEW-001 Review

- 输出 passed、violations、evidence、action。
- Enforcement 违规阻止完成。
- Advisory 只提示。

## 15. Gateway Core

### FR-GW-001 默认状态

- 默认关闭。
- 默认 localhost。
- 公网模式显式开启并通过安全配置检查。

### FR-GW-002 Adapter Contract

每个平台实现：

- start / stop。
- verifyInbound。
- parse 多消息。
- send。
- health。
- capabilities。

### FR-GW-003 Auth

- Signature / Token。
- Timestamp。
- Replay。
- Idempotency。
- Body Limit。
- Rate Limit。
- 失败请求不入队、不创建 Session。

### FR-GW-004 Identity / Workspace

- User / Tenant / Bot / Chat / Thread。
- User Allowlist。
- Workspace Allowlist。
- Permission Profile。
- Allowed Roles。

### FR-GW-005 Session

Key 至少包括：

```text
platform / tenant / bot / user / chat / thread / workspace
```

- 同 Session 保序。
- 不同 Session 受控并发。
- 无跨平台、跨租户串话。

### FR-GW-006 Runtime Bridge

- 直接调用 `DeepCodeRuntime.prompt()`。
- 不直接调用 Provider 或 Tool。
- 不为每条消息启动 CLI 子进程。

### FR-GW-007 Delivery

- sourceAdapter 回包。
- 分段、重试、速率限制。
- Delivery Result 和错误可观察。

### FR-GW-008 Permission UX

- 支持交互的平台展示 once / always / reject。
- 不支持的平台暂停或拒绝高风险操作。
- 不能自动 allow。

## 16. Gateway 平台需求

### FR-FEISHU-001 Stable

- 官方 WS 或 Webhook 协议。
- Auth、事件解析、私聊、群聊。
- Idempotency、多轮 Session。
- Workspace / User Allowlist。
- Role 选择。
- 回包、分段、重连。
- Mock 和真机 E2E。

### FR-GW-BETA-001 Beta Adapters

企业微信、Telegram、Slack 中至少两个达到 Beta：

- Auth。
- Replay。
- Session。
- Workspace。
- Outbound。
- Mock E2E。
- 无 P0。

### FR-GW-EXP-001 Experimental

其余 Adapter：

- 保留源码。
- 默认关闭。
- 限制明确。
- 未完成矩阵前不宣称正式支持。

## 17. Harness 模块

### v0.1 必须接入

- Intent Router。
- Model Router。
- Hard Constraints。
- Reasoning Manager。
- Scope Guard。
- Context Window Manager。
- Review / Immune。

### 渐进集成

- OKR Plan。
- Review Anti-drift。
- Memory Granularity。
- Meta Directives。
- Signal Tagger。
- Skill Evolution。

要求：Service、调用或日志不等于能力完成；必须有 applied 和 evidence。

## 18. 非功能需求

### 安全

- P0 为 0。
- Secret Scan 全历史。
- Gateway、Tool、Permission fail-closed。
- 日志和 Telemetry 脱敏。

### 可靠性

- Provider、Tool、Gateway、Subprocess 可取消。
- Queue、History、Pending 状态有界。
- Graceful Shutdown。

### 性能

- CLI 启动目标 < 3 秒。
- 不在主 Event Loop 做大目录同步扫描。
- 文件和 Tool 输出有大小限制。
- Gateway 并发有上限。

### 兼容性

- macOS arm64/x64。
- Linux x64/arm64。
- Windows 根据上游稳定性标 Beta 或 Experimental。

### 隐私

- 代码只发送到用户配置 Provider。
- Gateway 日志不默认保存完整消息正文。
- Telemetry 不含 Prompt、源码和 Secret。

## 19. UX 需求

本地用户能看到：

- Workspace。
- Role。
- Provider / Model。
- reasoning effort。
- Tool / Permission。
- Usage / Evidence。

Gateway 用户能看到：

- Workspace 和 Session。
- 当前 Role。
- 任务状态。
- 权限请求。
- 结果摘要和完整证据入口。

## 20. 开源和发布需求

必须提供：

- README。
- LICENSE / 上游版权。
- CONTRIBUTING。
- SECURITY。
- CODE_OF_CONDUCT。
- CHANGELOG。
- SUPPORT。
- UPSTREAM。
- Role、Skill、Adapter 扩展指南。

统一质量门：

```text
lint
+ typecheck
+ unit
+ integration
+ provider-contract
+ agent-e2e
+ gateway-core
+ gateway-adapter
+ security
+ build
+ install-smoke
```

## 21. README 主张规则

允许写入 Stable/Beta 的前提：

```text
Requirement
+ Main Code Path
+ Applied Behavior
+ Automated Tests
+ Runtime Evidence
+ Security Review
```

未验证前禁止：

- 11 平台全部稳定。
- 13 角色全部正式可用。
- 自动切换模型完成。
- Harness 保证不乱来。
- 唯一、完全、全栈适配等绝对化表述。

完成对应证据后可以恢复准确主张。

## 22. v0.1 Go / No-Go

1. 单一生产 Runtime。
2. 13 个角色全部预装且均有自动化场景；未达 Stable 的明确标 Beta。
3. 核心和关键高级角色 Runtime E2E 通过。
4. Gateway Core Stable。
5. 飞书 Stable。
6. 至少两个 Beta Adapter，或显式 ADR 调整。
7. Gateway 不通过 CLI 子进程运行 Agent。
8. P0 = 0。
9. Provider Contract 全通过。
10. Model Routing Applied Rate = 100%。
11. deny 无绕过。
12. CI 和安装矩阵全通过。
13. Claim Evidence Coverage = 100%。
14. 至少 3 名外部用户完成本地任务。
15. 至少 3 名外部用户完成飞书任务。

## 23. 当前状态快照

| 能力 | 当前状态 | v0.1 要求 |
|---|---|---|
| OpenCode Runtime | 已实现未验证 | 统一 API 和回归测试 |
| DeepSeek Protocol | 部分实现 | Contract 全通过 |
| Model Routing | Partial / Fail | 真正 Applied |
| Reasoning | Partial | Wire + History E2E |
| Permission | 基础存在，有缺陷 | 全入口统一且 deny 正确 |
| 13 Roles | 文件和局部测试存在 | 内置、Tool Policy、场景 E2E |
| oh-my-deepagent Runtime | 存在重复风险 | 迁移后删除重复 Runtime |
| Gateway Core | Experimental / Unsafe | Stable |
| 飞书 | 部分实现 | Stable + 真机 E2E |
| 其他 Adapter | 程度不一 | 至少两个 Beta，其余分级 |
| Harness 14 模块 | 接入程度不一 | 核心 Applied，其他准确标级 |
| 安装 / CI | 未闭环 | 正式发布门禁 |

## 24. 相关文档

- [08_V0.1_SCOPE.md](./08_V0.1_SCOPE.md)
- [09_V0.1_PRODUCT_ARCHITECTURE.md](./09_V0.1_PRODUCT_ARCHITECTURE.md)
- [10_V0.1_TECHNICAL_ARCHITECTURE.md](./10_V0.1_TECHNICAL_ARCHITECTURE.md)
- [11_V0.1_AGENT_INTEGRATION_PLAN.md](./11_V0.1_AGENT_INTEGRATION_PLAN.md)
- [12_V0.1_GATEWAY_PLAN.md](./12_V0.1_GATEWAY_PLAN.md)
- [13_V0.1_MIGRATION_MANIFEST.md](./13_V0.1_MIGRATION_MANIFEST.md)
