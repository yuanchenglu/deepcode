# DeepCode v0.1 测试计划与用例基线

> 版本：3.0
> 状态：v0.1 CLI-first Alpha 范围已修订
> 原则：分别验证 Host Execution 与 Plugin Orchestration，不以“只有一条 Loop”作为正确性标准

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 新增发行身份、OpenCode/Oh-my-OpenAgent 共存、官网安装和 Parallels 验收；拆分 v0.1/v0.2/v0.3 门禁 | 开源准备复核与用户确认 |

## 1. 测试目标

1. 证明 DeepSeek Provider 请求和响应协议正确。
2. 证明 Host 对真实副作用、权限和工作区保持有效治理。
3. 证明 DeepCode 的安装、配置、数据、升级和卸载与 OpenCode/Oh-my-OpenAgent 隔离。
4. 证明开源用户可从本项目制品安装、运行、测试和贡献。
5. v0.2 证明 oh-my-deepagent 的 Role、Subagent 和 Multi-Agent 编排真实可用。
6. v0.3 证明 Gateway 可安全进入 Host/Plugin 产品链路。

## 2. 测试模型

### 2.1 Host Execution Loop

验证：

```text
Provider
→ Tool Call
→ Permission / Workspace
→ Execute
→ Tool Result
→ History / Evidence
```

### 2.2 Plugin Orchestration Loop

验证：

```text
Role Selection
→ Plan
→ Delegate/Subagent
→ Review
→ Retry/Aggregate
```

### 2.3 Cross-boundary Contract

验证 Plugin 发起的真实副作用是否遵守 Host 安全契约，以及 Session、Task、Agent、Tool 和 Evidence 是否可关联。

## 3. 禁止的测试假设

不得把以下情况直接判定为失败：

- 插件存在 AgentRuntime；
- 插件存在 runMessageLoop；
- 插件存在 MemoryStore；
- 插件存在 Provider/Transport；
- 同一任务中有多个 Agent 编排循环。

失败条件应是：

- 绕过 Permission；
- Workspace 越权；
- 状态无法关联或恢复；
- Tool 副作用重复；
- 调用协议损坏；
- 编排结果不可追踪。

## 4. 测试分层

| 层级 | 内容 |
|---|---|
| Static | Lint、Typecheck、Secret、License |
| Unit | Provider lowering、Role、Skill、Parser、Policy |
| Contract | Host-Plugin、Provider、Gateway Adapter |
| Integration | Session、Tool、Permission、Memory、Orchestration |
| E2E | 本地任务、Subagent、Gateway、安装 |
| Security | deny、路径、Webhook、Secret、权限继承 |
| Reliability | Abort、Timeout、Queue、Resume、长会话 |

## 5. v0.2 Agent 审计测试

### AUD-001~010 原始架构和调用图

- AUD-001：列出 AgentRuntime 所有构造点。
- AUD-002：列出 runMessageLoop 所有调用点。
- AUD-003：列出 ToolRunner 生产/测试调用方。
- AUD-004：列出 MemoryStore 状态用途。
- AUD-005：列出 Provider/Transport 调用方。
- AUD-006：核对原始 oh-my-OpenAgent 插件入口。
- AUD-007：核对当前改名/移植差异。
- AUD-008：生成 Host/Plugin/Gateway 调用图。
- AUD-009：生成 State Authority Matrix。
- AUD-010：每个组件标记性质和迁移动作。

## 6. Host Runtime 用例

### RUN-001~020

- RUN-001：创建 Host Session。
- RUN-002：Session 绑定 Workspace。
- RUN-003：Resume 恢复 Canonical History。
- RUN-004：Cancel 终止 Provider。
- RUN-005：Cancel 传播到 Tool。
- RUN-006：Tool Call/Result ID 对应。
- RUN-007：副作用写入 Evidence。
- RUN-008：不同 Workspace 不串话。
- RUN-009：最大 Step 生效。
- RUN-010：重复副作用不重放。
- RUN-011~020：Context、Compaction、Usage、Error 和长会话回归。

## 7. Provider Contract 用例

### PRO-001~025

覆盖：

- Wire Body；
- reasoning_effort；
- Text/Reasoning/Tool SSE；
- Tool Continuation；
- Usage/Cache；
- Overflow；
- Abort；
- 4xx/5xx/Rate Limit；
- 跨模型 Metadata。

插件独立 Provider 若保留，需单独标记 Production、Compatibility 或 Test，并运行对应 Contract。

## 8. Role 和 Skill 用例

### ROL-001~102

- Registry 完整性。
- ID/Prompt/Metadata。
- Tool/Skill 引用。
- 用户显式选择。
- Role 切换。
- 每个角色至少一个场景。
- 白名单外 Tool 行为。
- 已知限制和成熟度。

### SKL-001~010

- Skill 发现、冲突、加载、卸载。
- Skill 不隐式扩权。
- Context 注入和 Tool 暴露符合 Contract。

## 9. Orchestration 用例

### ORC-001~030

- ORC-001：Plan → Build → Review。
- ORC-002：Parent Agent 创建 Subagent。
- ORC-003：Parent/Child Task 可关联。
- ORC-004：Subagent 结果聚合。
- ORC-005：Subagent 失败返回父任务。
- ORC-006：Cancel 传播。
- ORC-007：子 Agent 权限不扩大。
- ORC-008：并行只读任务。
- ORC-009：并行写入冲突检测。
- ORC-010：Review 请求返工。
- ORC-011~020：模型、角色、记忆和重试策略。
- ORC-021~030：多 Agent 稳定性与 Evidence。

## 10. State Authority 用例

### STA-001~015

- Canonical History 与 Plugin State 区分。
- Orchestration ID 映射 Host Task。
- Scratch Memory 不污染正式历史。
- Durable Memory 来源可追踪。
- 重启恢复无双重执行。
- Parent/Child 状态一致。
- 无法恢复时明确失败，不静默创建错误新会话。

## 11. Tool 和安全用例

### TOL-001~030

- allow/ask/deny。
- deny 不进入 preapproved。
- Role/Skill/Plugin/Gateway 不能绕过 deny。
- realpath + relative。
- Symlink 逃逸。
- Shell cwd/Timeout/Abort。
- 子 Agent 权限继承/收缩。
- 插件 ToolRunner 若执行生产 Tool，必须通过安全 Contract。

## 12. Harness 用例

### HAR-001~030

- Intent Applied。
- Model decided/applied。
- Reasoning Lifecycle。
- Hard Constraints。
- Scope。
- Review Enforcement/Advisory。
- Agent/Role/Task 相关性。

## 13. Gateway 用例

### GW-001~050

- 默认关闭和本地绑定。
- Auth、Timestamp、Replay、Idempotency。
- Body/Rate/Queue。
- Identity/Workspace。
- Session/Role 选择。
- Gateway → Host/Plugin 调用链。
- Source Adapter Delivery。
- Abort、Timeout、Shutdown。

### FEI-001~070

覆盖飞书鉴权、Parser、私聊/群聊、多轮、角色、分段、重连、幂等和真机 E2E。

## 14. 安装、共存和 CI

- INS-001：官网安装源只指向本项目 Release。
- INS-002：SHA-256 校验失败时拒绝安装。
- INS-003：`deepcode --version`、`deepcode --help`。
- INS-004：重复安装幂等。
- INS-005：升级到指定版本。
- INS-006：升级失败可回滚。
- INS-007：卸载只删除 DeepCode 文件。
- INS-008：安装后实际配置、数据和数据库路径属于 `deepcode`。
- INS-009：默认不读取 `.opencode`、`opencode.json(c)`。
- INS-010：默认不解释 `OPENCODE_*`。
- INS-011：默认不加载 Oh-my-OpenAgent。
- INS-012：安装过程没有半安装残留。
- COE-001：已有 OpenCode 时安装和运行 DeepCode。
- COE-002：已有 OpenCode + Oh-my-OpenAgent 时安装和运行 DeepCode。
- COE-003：`deepcode`、`opencode`、`omo` 命令互不覆盖。
- COE-004：DeepCode 运行前后 OpenCode 配置/数据库校验值不变。
- COE-005：DeepCode 升级和卸载不调用 OpenCode 包管理命令。
- COE-006：DeepCode 和 OpenCode 可同时运行，端口/进程可区分。
- VM-001~004：干净 macOS、OpenCode、OpenCode+Oh-my-OpenAgent、升级/回滚快照。
- OSS-001~015：License、Security、Contribution、Claim Evidence。
- PERF-001~012：启动、长 Session、Queue、并发、内存边界。

统一命令目标尚未实现，建立前必须在 CI 中显式列出各 Package 命令：

```bash
bun run check
```

## 15. 分版本 Release Exit Criteria

### v0.1 Alpha

- Alpha 暴露面 P0=0。
- Provider Contract 全通过。
- Host Execution E2E 通过。
- 安装、升级、卸载、共存 Matrix 和 Required CI 通过。
- Parallels VM-001~004 和官网安装 Smoke 通过。
- OpenCode/Oh-my-OpenAgent 状态不变。
- 未交付 Agent/Gateway/Desktop 未被宣称 Stable。

### v0.2 Agent

- Plugin Orchestration、关键角色和 Host-Plugin 安全 Contract 通过。
- 没有因错误“单 Loop”假设造成的插件能力回退。

### v0.3 Gateway

- Gateway Core/飞书 Contract、真机 E2E 和安全门禁通过。
