# DeepCode v0.1 开源迭代计划

> 版本：2.2
> 状态：Phase 0 范围冻结完成，Runtime 架构已勘误
> 目标：保留 Gateway 与 oh-my-deepagent 插件价值，以安全、契约和验证闭环达到正式开源

## 1. 总体原则

```text
事实审计
→ 安全边界
→ Host-Plugin Contract
→ Provider/Harness
→ Agent Orchestration
→ Gateway
→ 测试/安装
→ Release
```

此前“先统一为一套 Runtime、再删除第二套 Loop”的顺序已撤销。

正确原则：

> **单一宿主治理边界，允许多个 Agent 编排循环。**

## 2. 功能冻结

v0.1 前冻结新增：

- 新 Gateway 平台；
- 新 Role/Skill；
- 新 Harness 模块；
- 新产品入口；
- 云端和企业功能。

冻结不等于删除现有 Subagent、Multi-Agent、Gateway 或插件 Runtime 能力。

## 3. Phase 0：范围与架构冻结——已完成并勘误

完成：

- Gateway 进入 v0.1。
- oh-my-deepagent 正式内置。
- 角色预装目标确认。
- 文档基线建立。

勘误：

- 撤销“当前已有第二套生产 Runtime”的既定判断。
- 撤销“AgentRuntime/runMessageLoop 必须删除”的预设。
- 改为 Host Runtime Governance + Plugin Orchestration。

## 4. Phase 1：来源、调用图与职责审计

### 目标

在修改 Runtime 代码前还原真实架构。

### 工作项

#### P1-01 上游架构还原

- 阅读原始 OpenCode 插件 API。
- 阅读原始 oh-my-OpenAgent 安装、Hook、Agent、Subagent 和 Tool 机制。
- 对照改名后的 DeepCode/oh-my-deepagent。

#### P1-02 生产入口调用图

- CLI/TUI 入口。
- Gateway 入口。
- Host Session/Provider/Tool 入口。
- Plugin Role/Agent 入口。

#### P1-03 DeepAgent 组件调用图

列出：

- AgentRuntime；
- runMessageLoop；
- ToolRunner；
- MemoryStore；
- Provider；
- Transport；
- Role/Skill/Planning；
- Subagent/Multi-Agent。

#### P1-04 状态权威性

生成：

- Canonical History；
- Orchestration State；
- Parent/Child Task；
- Scratch/Durable Memory；
- Gateway Mapping。

#### P1-05 分类决策

每个组件标记：

- Host Execution；
- Plugin Orchestration；
- Compatibility；
- Test Runtime；
- Transitional；
- Unused；
- Unknown。

再给出 Keep、Adapt、Bridge、Replace、Remove。

### 退出条件

- 不存在依赖猜测的 Runtime 删除项。
- 所有核心调用方有源码路径。
- 原始插件关系有文档证据。
- 后续整改清单经过确认。

## 5. Phase 2：P0 安全封锁

### 工作项

- Secret 轮换、历史清理和 Scan。
- Permission deny 修复。
- Workspace realpath/Symlink 安全。
- Shell Timeout/Abort/环境变量保护。
- Gateway 默认关闭、本地绑定和入站鉴权。
- Subagent 权限继承和收缩规则。

### 退出条件

- P0 安全问题为 0。
- Host Loop、Plugin Loop、Gateway 均不能绕过安全契约。

## 6. Phase 3：Host-Plugin Contract

### 工作项

#### Session/Task

- Host Session 与 Orchestration ID。
- Parent/Child Agent Task。
- Resume/Cancel。
- History/Memory 边界。

#### Tool

- Role/Skill Filter。
- Permission/Workspace/Sandbox。
- Tool Result Settlement。
- Evidence。

#### Provider

- Host Provider、Plugin Adapter、Compatibility/Test Provider 的定位。
- Reasoning、Usage、Abort 和 Error 传播。

#### Events

- role/agent/model/tool/permission/gateway 相关性。

### 退出条件

- Contract 有类型、文档和测试。
- 不要求插件丧失编排能力。
- 无法归类的 Runtime 代码仍保持 Unknown，不强删。

## 7. Phase 4：DeepSeek Provider 与 Harness

### Provider

- Wire Contract。
- reasoning_effort。
- Text/Reasoning/Tool SSE。
- Usage/Cache。
- Overflow/Abort/Error。

### Harness

- Model Routing Applied。
- Hard Constraints。
- Reasoning Lifecycle。
- Scope。
- Review Enforcement/Advisory。

### 退出条件

- Provider Contract 全通过。
- 核心 Harness 有 E2E 证据。

## 8. Phase 5：Built-in Agent 正式交付

### 工作项

- 准确角色和 Skill 清单。
- 每个角色的 Prompt/Tool/Skill/Risk/Maturity。
- Plan → Build → Review。
- Parent/Subagent。
- Multi-Agent 编排和冲突处理。
- Gateway Role 选择。
- 插件独立 Runtime/Compatibility/Test 能力按审计结论处理。

### 退出条件

- 预装角色可发现、可选择、可测试。
- 关键角色和每个角色场景达到既定标准。
- Agent 编排能力未因架构整改回退。
- 真实副作用遵守安全契约。

## 9. Phase 6：Gateway 正式交付

### Gateway Core

- Auth、Replay、Idempotency。
- Identity、Workspace、Session Mapping。
- Queue、Concurrency、Timeout、Shutdown。
- Host/Plugin 调用链。
- Source Adapter Delivery。

### Feishu Stable

- 官方鉴权。
- Parser。
- 私聊/群聊。
- 多轮、Role、Subagent。
- 分段、重连、幂等和真机 E2E。

### 退出条件

- Gateway Core Stable。
- 飞书 Stable。
- 无未鉴权执行路径。

## 10. Phase 7：测试、CI、安装和发布

### 统一质量门

```bash
bun run check
```

覆盖：

- Static；
- Provider Contract；
- Host Runtime；
- Plugin Orchestration；
- Host-Plugin Contract；
- Gateway；
- Security；
- Build/Install。

### 开源体验

- README。
- CONTRIBUTING。
- SECURITY。
- CHANGELOG。
- SUPPORT。
- UPSTREAM。
- 安装 Smoke Matrix。

## 11. 版本里程碑

### v0.1.0-alpha.1

- Phase 1 审计完成。
- P0 安全封锁。

### v0.1.0-alpha.2

- Host-Plugin Contract。
- Provider/Harness 闭环。

### v0.1.0-alpha.3

- Built-in Agent 和编排链路。
- Gateway Core/飞书。

### v0.1.0-beta.1

- 全套 E2E、CI 和安装。

### v0.1.0-rc.1

- 外部试用、长运行和 Claim 审计。

## 12. Go/No-Go

Go：

- P0=0。
- 调用图和状态权威性明确。
- Provider Contract 全绿。
- Host 和 Plugin 编排 E2E 通过。
- Gateway Core/飞书通过。
- 安装和 CI 通过。
- README Claim Coverage=100%。
- 无因错误“单 Loop”假设造成的插件能力损失。
