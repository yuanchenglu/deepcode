# DeepCode 功能测试报告

> 测试基线：`master@ff79c93cc8c865349a74e6844d4881be99f5ce65`
> 报告日期：2026-07-27
> 总体结论：**FAIL / RUNTIME TEST BLOCKED**
> Runtime 勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 1. 结论

本轮完成了静态源码和配置核查，但未能在当前环境完成 clone、install、build、typecheck、test、真实 DeepSeek 请求和真机 Gateway E2E。

因此：

- 不宣称完整功能测试通过。
- 当前发布判断仍为 NO-GO。
- 失败依据是已确认的安全、协议、权限、Gateway 和发布闭环问题。

## 2. Runtime 结论修正

静态核查确认 `packages/oh-my-deepagent` 中存在：

- AgentRuntime；
- runMessageLoop；
- ToolRunner；
- MemoryStore；
- Provider；
- Transport。

此前报告将其作为“第二套生产 Runtime”证据。该结论不成立，因为尚未执行：

- 生产调用方扫描；
- 原始插件契约对照；
- Runtime 入口 E2E；
- State Authority 测试；
- Host-Plugin Contract 测试。

修正后的测试状态：

| 项目 | 状态 |
|---|---|
| 独立可运行代码存在 | Static Pass |
| 已形成第二套生产 Runtime | Not Proven |
| 与宿主发生状态冲突 | Not Tested |
| 绕过宿主 Permission | 待调用路径测试 |
| 应当删除 | Withdrawn / Audit Required |

## 3. 已完成的静态核查

- Repository 和最新 Commit 状态。
- Package、Script、CI 配置。
- DeepSeek Provider 字段和协议路径。
- Model Routing 调用顺序。
- Permission Workflow。
- Scope/Workspace 边界。
- Gateway Adapter、Session 和回包逻辑。
- oh-my-deepagent Runtime/Tool/Memory/Provider 代码存在性。

## 4. 未完成的运行测试

- `bun install`。
- Build/Typecheck/Unit/Integration。
- Provider Mock Contract。
- 真实 DeepSeek API E2E。
- Host Execution Loop E2E。
- Plugin Orchestration E2E。
- AgentRuntime 当前生产入口测试。
- Parent/Subagent/Multi-Agent 测试。
- Gateway Core 和飞书真机 E2E。
- macOS/Linux 安装 Smoke。

## 5. 已确认失败项

### Security

- Gateway 入站鉴权边界不完整。
- Secret 历史风险。
- Permission deny 预批准缺陷。
- Workspace/Scope fail-open 风险。

### Provider/Harness

- reasoning effort 字段和能力值存在失配。
- Model Routing 决策未可靠应用。
- Reasoning Lifecycle/History Projection 未闭环。
- 多个 Harness Enforcement 仅记录日志。

### Gateway

- 回包可能使用错误 Adapter。
- 子进程 Timeout 逻辑不可靠。
- Session Key、Queue、TTL 和容量不足。
- 多平台均缺完整 E2E 证据。

### Release

- 根测试链和 CI 证据不足。
- 安装和发布方式未完成 Smoke。

## 6. 新增必测项

### Audit

- AUD-001~010：调用图、来源和用途分类。

### Host-Plugin Contract

- STA-001~015：State Authority。
- ORC-001~030：Plugin Orchestration。
- TOL：Permission/Workspace 跨边界。
- PRO：Host/Plugin Provider Contract。

### Gateway

- Gateway → Host Session → Plugin Role/Orchestration → Tool Effects → Delivery。

## 7. 当前计数解释

此前静态通过、失败和阻塞计数只代表当时审查覆盖，不代表运行完成度。Runtime 架构勘误后，涉及“第二套生产 Runtime”的失败项改为 Audit Blocked，不作为确定失败或删除依据。

## 8. Release Decision

当前：**NO-GO**。

Go 之前必须：

- P0=0；
- Provider Contract 全绿；
- Host Execution E2E；
- Plugin Orchestration 和关键角色 E2E；
- Host-Plugin 安全 Contract；
- Gateway Core/飞书；
- 安装和 CI；
- README Claim Evidence 100%。
