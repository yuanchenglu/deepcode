# DeepCode v0.1 产品需求文档（PRD）

> 创建日期：2026-07-27
> 版本：3.0
> 状态：CLI-first Alpha 范围已修订
> 第一目标：发布可安装、可执行、可验证、默认安全且不干扰 OpenCode/Oh-my-OpenAgent 的 DeepSeek-native Coding Agent
> 总计划：[PLAN.md](./PLAN.md)；第一阶段专项契约：[15_V0.1_RELEASE_AND_COEXISTENCE_PLAN.md](./15_V0.1_RELEASE_AND_COEXISTENCE_PLAN.md)

## 更新记录（Update Log）

| 时间       | 更新内容                                                                                   | 来源                   |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------------- |
| 2026-07-27 | v0.1 收敛为 CLI-first Alpha；Gateway、全量 Agent 和 Desktop 后移；新增发行身份和共存硬门槛 | 开源准备复核与用户确认 |

## 1. 文档目的

本 PRD 定义 v0.1 Alpha 的最小用户闭环和发布门槛。完成度以安装、Applied Behavior、自动化测试、运行证据和共存验证衡量。

## 2. 产品定义

```text
DeepCode v0.1 Alpha
= Isolated DeepCode CLI
+ DeepSeek Provider
+ Host-governed Tool / Permission / Workspace
+ One Default Coding/Build Agent
+ Session / Evidence
```

`oh-my-deepagent` 全量插件编排、Gateway 和 Desktop 属于目标架构，但不是当前生产能力，也不阻塞 v0.1 Alpha。

## 3. 核心架构决策

### PRD-ADR-001 独立发行身份

DeepCode 的命令、配置、数据、数据库、环境变量、安装、升级和卸载必须与 OpenCode/Oh-my-OpenAgent 隔离。默认不得读取 `.opencode`、`opencode.json(c)` 或 `OPENCODE_*`。

### PRD-ADR-002 Host Runtime Governance

Host 对以下产品能力保持最终治理或明确 Contract：

- Workspace 和真实副作用；
- Permission 和用户确认；
- 正式 Session/Task Identity；
- Provider/Tool 调用审计；
- Context、History 和 Evidence。

### PRD-ADR-003 Plugin Orchestration

oh-my-deepagent 的目标定位允许 Role、Skill、Planning、Delegation、Subagent、Multi-Agent 和独立编排循环。v0.2 集成前必须先完成生产调用图、来源和 Host-Plugin Contract 审计。

不得使用“禁止第二套 Agent Loop”作为删除理由；也不得把尚未接入的插件能力写成 v0.1 当前能力。

### PRD-ADR-004 Gateway 与 Desktop

- Gateway Core/飞书 Stable 目标版本为 v0.3；
- v0.1 Alpha 不启动、不打包或不宣称 Gateway Stable；
- Desktop 在独立 App ID、协议、目录、更新源和签名前不发布。

## 4. 用户画像

- 需要在本地使用 DeepSeek 完成代码任务的开发者；
- 已安装 OpenCode、Oh-my-OpenAgent，要求 DeepCode 不干扰现有环境的用户；
- 希望验证 Alpha 并贡献代码的开源用户。

消息平台和高级 Multi-Agent 用户属于后续版本画像。

## 5. v0.1 Alpha 目标

1. 从本项目控制的 Release 安装并启动。
2. `deepcode --version`、`deepcode --help` 正常。
3. 正确连接 DeepSeek OpenAI-compatible API。
4. 完成真实仓库读取、修改、Shell 和测试任务。
5. allow/ask/deny、Workspace、Timeout、Abort 正确。
6. 保存和恢复 Session，输出可追踪 Evidence。
7. 不读取或修改 OpenCode/Oh-my-OpenAgent 的默认状态。
8. 安装、升级、卸载可验证且只触碰 DeepCode 文件。
9. 默认分支 CI、Release、官网安装和公开主张可追踪到同一 Commit。

## 6. 非目标

- Gateway Core、飞书或其他 Adapter Stable；
- 13 个角色全部预装或 Stable；
- Parent/Subagent/Multi-Agent 生产写入；
- Desktop；
- 云托管、计费、多租户、SSO；
- npm 无作用域包 `deepcode` 或 `deepcode-ai`；
- 未经调用图审计的大规模 Runtime 删除。

## 7. 核心用户故事

### US-001 安装与首个任务

用户从官网安装本项目 Release，配置 DeepSeek API，进入代码仓库并完成一个可验证任务。

### US-002 共存

已安装 OpenCode/Oh-my-OpenAgent 的用户安装、运行和卸载 DeepCode，原有命令、配置、数据库、插件和 Session 均不变。

### US-003 安全

deny、Workspace、Timeout 和 Abort 不因 CLI、Provider 或 Agent 路径而绕过。

### US-004 诊断与恢复

用户可确认版本、实际配置位置、Provider 状态和 Session；失败时得到明确诊断，不留下半安装状态。

## 8. 安装与发行需求

### FR-INSTALL-001 官方来源

Alpha 至少提供 GitHub Release Binary。官网安装脚本只能从本项目 Release 下载并校验 SHA-256。

### FR-INSTALL-002 身份隔离

- CLI：`deepcode`；
- 安装目录：`~/.deepcode/bin`；
- 全局配置：`~/.config/deepcode` 或平台等价目录；
- 项目配置：`.deepcode/`；
- 数据/缓存/状态：`deepcode`；
- 数据库：`deepcode.db`；
- 环境变量：`DEEPCODE_*`。

### FR-INSTALL-003 生命周期

必须验证安装、重复安装、升级、失败回滚和卸载。卸载不得调用 `opencode-ai` 或删除 OpenCode 目录。

### FR-INSTALL-004 Doctor

检查版本、安装来源、实际路径、配置、Provider、权限和 Session。未交付的 Gateway/Plugin 不得显示为可用。

## 9. Session、Tool 与 Permission

- Session 绑定 Workspace、Model、Permission 和 Evidence；
- Resume 恢复 Canonical History；
- Tool Call/Result 可关联；
- deny 不进入 preapproved；
- Workspace 外写和 Symlink 逃逸拒绝；
- Shell 有 cwd、Timeout、Abort、输出和环境限制。

## 10. DeepSeek Provider

- API Key、Base URL、Model、Context/Output Limit 可配置；
- Text、Reasoning、Tool Call、Usage、Cache、Abort 和 Error 可处理；
- `reasoning_effort` Wire Body 和 SSE 通过 Contract Test；
- Model Routing 若不能在当前 Turn Applied，则 Alpha 中关闭相应自动路由主张；
- 至少一次受控真实 DeepSeek E2E。

## 11. v0.1 默认 Agent

- 一个默认 Coding/Build Agent；
- 能读取、修改、运行测试并汇总 Evidence；
- 不要求 `packages/oh-my-deepagent` 成为生产依赖；
- 不宣称 Plan/Build/Review、Subagent、Multi-Agent 已完成。

## 12. 后续 Host-Plugin Contract

v0.2 前必须：

1. 生成 `oh-my-deepagent` 生产调用图；
2. 分类 AgentRuntime、Message Loop、ToolRunner、MemoryStore、Provider、Transport；
3. 确认来源和许可证；
4. 定义 Session/Task、Permission、Workspace、Provider、Memory 和 Cancel Contract；
5. 再决定 Keep、Adapt、Bridge、Replace、Remove。

## 13. 测试需求

v0.1 必须覆盖：

- Static、Typecheck、Secret、Dependency、License；
- DeepSeek Provider Contract；
- Permission/Workspace；
- 本地任务 E2E；
- 安装、升级、卸载；
- OpenCode/Oh-my-OpenAgent 共存；
- Parallels macOS VM-001~004；
- 官网安装 Smoke。

Agent Orchestration 和 Gateway 测试保留，但分别作为 v0.2/v0.3 门禁。

## 14. 开源需求

- LICENSE 和上游版权保留正确；
- SECURITY、CONTRIBUTING、SUPPORT、UPSTREAM、CODE_OF_CONDUCT 属于 DeepCode；
- Release 包含 SHA-256、SBOM 和许可证清单；
- Secret 历史有轮换/清理证据；
- README Claim Evidence Coverage = 100%。

## 15. v0.1 Alpha 发布门槛

- 官方安装源属于本项目；
- 发行身份和共存 Contract 通过；
- Alpha 暴露面 P0=0；
- Provider Contract、本地任务 E2E 通过；
- Required CI 全绿；
- Parallels VM-001~004 通过；
- 安装、升级、卸载只触碰 DeepCode；
- 未交付 Gateway、Desktop、全量 Agent 未被宣称 Stable；
- README Claim Evidence Coverage = 100%。

## 附录 A：讨论债务

- scoped npm 组织名称和所有权待确认。
- 默认分支最终名称待仓库管理员确认。
- macOS 公证是否进入 Alpha，取决于实际 Gatekeeper 验收。

## 附录 B：Q&A 过程记录

#### Q#1：为什么 v0.1 不再包含 Gateway Stable 和 13 个角色？

> 2026-07-27 | 开源与上线优先级复核 | 用户确认

**问题**：原范围包含全部目标能力，导致安装和真实用户验证排在最后。

**答案**：v0.1 只交付最小但完整的 CLI 用户闭环；目标能力保留并按 v0.2/v0.3 交付，不进行破坏性删除。

> [→ 正文 §2、§5、§6 已体现此结论]
