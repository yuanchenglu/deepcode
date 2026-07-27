# DeepCode v0.1 测试计划与用例基线

> 版本：2.0
> 状态：Phase 0 范围冻结
> 原则：验证真实 Applied Behavior，不以文件存在、Role 注册、Adapter 导出、Typecheck 或日志输出替代功能验证

## 1. 测试目标

1. 证明 DeepSeek Provider Wire 和 Stream 正确。
2. 证明 CLI、Built-in DeepAgent 和 Gateway 使用唯一 Runtime。
3. 证明 13 个角色全部预装且 Tool / Skill Policy 真实执行。
4. 证明 Gateway Core 安全、Session 隔离、Queue 和 Runtime Bridge 正确。
5. 证明飞书达到 Stable，Beta Adapter 达到各自发布门槛。
6. 证明 Permission、Workspace、Shell、Scope 和 Webhook 不可绕过。
7. 证明 Model Routing、Constraints、Reasoning 和 Review 真实改变执行。
8. 证明安装、构建、贡献和发布可复现。

## 2. 测试分层

| 层级 | 内容 | 频率 |
|---|---|---|
| Static | lint、typecheck、secret、license、dependency | 每次提交 |
| Unit | 纯函数、Schema、Registry、Parser、Policy | 每次提交 |
| Integration | Runtime、Session、Tool、Agent、Gateway Core | 每次 PR |
| Contract | Provider Wire/SSE、Adapter Auth/Fixture | 每次 PR |
| Security | deny、path、webhook、replay、secret | Required |
| E2E Mock | 本地任务、Role、Gateway Platform | develop / PR |
| E2E Real | DeepSeek、飞书、Beta Platform | RC / 手动受控 |
| Install | 干净 OS 安装、包内容、doctor | Release |
| Reliability | 100 Turn、24 小时、Queue、Abort | Nightly / RC |

## 3. 环境矩阵

### OS

- Ubuntu x64。
- macOS arm64。
- macOS x64（可用 Runner 时）。
- Linux arm64（可用 Runner 时）。
- Windows Experimental / Beta。

### Runtime

- package.json 固定 Bun 版本。
- Node 版本按构建依赖要求。

### Provider

- Local Mock OpenAI-compatible Server。
- DeepSeek 真实 Endpoint（受控 Secret）。
- Error / Overflow / Abort Fixtures。

### Gateway

- Platform Fixture Server。
- 飞书测试应用。
- Beta 平台测试 Bot / App。

## 4. Required CI Jobs

```text
static
runtime
provider-contract
deepagent
gateway-core
gateway-adapters
security
build-install
```

根命令：

```bash
bun run check
```

## 5. Runtime 用例

| ID | 场景 | 预期 |
|---|---|---|
| RUN-001 | createSession | 绑定 Workspace 和默认 Build |
| RUN-002 | resumeSession | 恢复同一历史和状态 |
| RUN-003 | CLI 调用 Runtime API | 不绕过 Runtime |
| RUN-004 | Agent 调用 Runtime API | 不创建第二 Session |
| RUN-005 | Gateway 调用 Runtime API | 不启动 CLI 子进程 |
| RUN-006 | cancel Provider | Stream 有界终止 |
| RUN-007 | cancel Tool | AbortSignal 生效 |
| RUN-008 | max steps | 阻止继续 Tool Call |
| RUN-009 | Runtime error | 结构化 Error Event |
| RUN-010 | completion | Evidence 完整 |
| RUN-011 | role.decided/applied | 两事件可对照 |
| RUN-012 | model.decided/applied | 两事件可对照 |
| RUN-013 | permission event | 请求和回复相关联 |
| RUN-014 | tool events | requested/running/completed 顺序 |
| RUN-015 | usage event | Token 指标持久化 |
| RUN-016 | gateway identity | Session 保存引用不泄露 Secret |
| RUN-017 | cross-workspace | 不串话 |
| RUN-018 | concurrent sessions | 独立执行 |
| RUN-019 | graceful shutdown | Pending 正确终止 |
| RUN-020 | legacy path disabled | 正式配置不可调用旧 Runtime |

## 6. Session / Context 用例

| ID | 场景 | 预期 |
|---|---|---|
| SES-001 | 新 Session | 唯一 ID |
| SES-002 | 多轮文本 | 顺序正确 |
| SES-003 | Tool Call/Result | ID 对应 |
| SES-004 | Reasoning 分离 | 不混入 Text |
| SES-005 | 同模型 Metadata | 必要内容保留 |
| SES-006 | 跨模型 | 私有 Metadata 清理 |
| SES-007 | Role switch | 同 Session 动态更新 |
| SES-008 | Gateway resume | 恢复原 Session |
| SES-009 | interrupt pending tool | 标记失败/取消 |
| SES-010 | side-effect resume | 不重复执行 |
| SES-011 | stable baseline | Epoch 内 byte-identical |
| SES-012 | dynamic context | 不污染 baseline |
| SES-013 | compaction | Summary 标识历史 |
| SES-014 | tool sequence compaction | 不产生无效序列 |
| SES-015 | constraint after compaction | 仍保留 |
| SES-016 | 100 Turn | 无错误和无界增长 |
| SES-017 | overflow recovery | 最多恢复一次 |
| SES-018 | Context usage | 估算和 Provider Usage 可比较 |

## 7. Provider Contract 用例

| ID | 场景 | 预期 |
|---|---|---|
| PRO-001 | model | Wire 正确 |
| PRO-002 | messages | Role/Context/History 正确 |
| PRO-003 | reasoningEffort high | 发送 `reasoning_effort` |
| PRO-004 | max supported | 正确发送 |
| PRO-005 | max unsupported | 降级或明确拒绝 |
| PRO-006 | non-reasoning | 不发送字段 |
| PRO-007 | generation params | Wire 正确 |
| PRO-008 | text SSE | Text Delta |
| PRO-009 | reasoning SSE | Reasoning Delta |
| PRO-010 | interleaved reasoning/text | Lifecycle 正确 |
| PRO-011 | tool name delta | 拼接正确 |
| PRO-012 | tool args delta | JSON 完整 |
| PRO-013 | reasoning + tool | Continuation 正确 |
| PRO-014 | tool result | 回传正确 |
| PRO-015 | multiple tools | 分别 Settlement |
| PRO-016 | finish reason | 映射正确 |
| PRO-017 | usage | input/output/total |
| PRO-018 | cached tokens | cacheRead 正确 |
| PRO-019 | reasoning tokens | 指标正确 |
| PRO-020 | 4xx | Provider Error |
| PRO-021 | rate limit | 不误判模型能力 |
| PRO-022 | overflow | 触发受控 Compaction |
| PRO-023 | abort | 网络请求终止 |
| PRO-024 | malformed SSE | 明确 Parser Error |
| PRO-025 | recorded fixtures | 可重复回放 |

## 8. Role Registry 和 13 角色用例

Phase 1 生成真实 Role 清单后，将 `ROLE-01` 至 `ROLE-13` 替换为实际 ID。

### Registry

| ID | 场景 | 预期 |
|---|---|---|
| ROL-001 | 13 Role 数量 | 精确为仓库冻结清单 |
| ROL-002 | Role ID | 全部唯一 |
| ROL-003 | Display Name | 非空且稳定 |
| ROL-004 | Description | 非空 |
| ROL-005 | Prompt | 无占位和非法引用 |
| ROL-006 | Tool references | 全部存在 |
| ROL-007 | Skill references | 全部存在 |
| ROL-008 | 默认 Build | 可解析 |
| ROL-009 | 核心/高级分组 | UI Metadata 正确 |
| ROL-010 | maturity | 合法枚举 |
| ROL-011 | risk | 合法枚举 |
| ROL-012 | duplicate registration | 拒绝 |
| ROL-013 | unknown role | 可行动错误 |

### 每角色通用矩阵

对 13 个角色分别执行：

| ID 范围 | 内容 |
|---|---|
| ROL-014~026 | Prompt Snapshot / Contract |
| ROL-027~039 | 允许 Tool 可见 |
| ROL-040~052 | 禁止 Tool 不可见 |
| ROL-053~065 | Skill Resolution / Conflict |
| ROL-066~078 | Permission deny / ask / allow |
| ROL-079~091 | Runtime Scenario |

### 协作和切换

| ID | 场景 | 预期 |
|---|---|---|
| ROL-092 | Build 默认 | 正确 applied |
| ROL-093 | Plan → Build | 同 Session |
| ROL-094 | Build → Review | 同 Task / Evidence |
| ROL-095 | Review → Build 修正 | 无重复副作用 |
| ROL-096 | 切换未知 Role | 原 Role 保留 |
| ROL-097 | 临时 Approval | 不被不安全继承 |
| ROL-098 | Role Model Policy | Model applied 可见 |
| ROL-099 | Gateway 选择 Role | Allowed Roles 生效 |
| ROL-100 | Gateway 禁止 Role | 拒绝 |
| ROL-101 | Role 不调用独立 Provider | 调用图断言 |
| ROL-102 | Role 不使用独立 Tool Loop | 调用图断言 |

## 9. Skill 用例

| ID | 场景 | 预期 |
|---|---|---|
| SKL-001 | 名称唯一 | 冲突拒绝 |
| SKL-002 | 依赖加载 | 顺序正确 |
| SKL-003 | 缺依赖 | 明确失败 |
| SKL-004 | 冲突 | 拒绝或选择策略 |
| SKL-005 | Tool 交集 | 不扩张 Role |
| SKL-006 | Permission | deny 优先 |
| SKL-007 | Context | 正确进入 Projector |
| SKL-008 | unload | Tool/Context 清理 |
| SKL-009 | Workspace Skill | 来源和权限明确 |
| SKL-010 | Skill Evolution | 只提议不自动启用 |

## 10. Unified Tool / Permission 用例

| ID | 场景 | 预期 |
|---|---|---|
| TOL-001 | read allow | 执行 |
| TOL-002 | edit ask once | 单次执行 |
| TOL-003 | edit always pattern | 仅匹配范围 |
| TOL-004 | reject | Tool 不执行 |
| TOL-005 | unknown tool | 错误 |
| TOL-006 | schema invalid | 不执行 |
| TOL-007 | result persistence | 下一轮前完成 |
| TOL-008 | deny hidden | 模型不可见或执行拒绝 |
| TOL-009 | Workflow deny | 不进入 preapproved |
| TOL-010 | Role deny | 不可绕过 |
| TOL-011 | Skill deny | 不可绕过 |
| TOL-012 | Gateway deny | 不可绕过 |
| TOL-013 | workspace outside | deny |
| TOL-014 | prefix sibling path | deny |
| TOL-015 | `..` escape | deny |
| TOL-016 | absolute path | 按 Policy |
| TOL-017 | symlink outside | deny |
| TOL-018 | symlink inside | 按 Policy |
| TOL-019 | realpath error | fail-closed |
| TOL-020 | shell cwd | 固定 Workspace |
| TOL-021 | high-risk shell | ask / deny |
| TOL-022 | shell timeout | 终止 |
| TOL-023 | shell abort | 终止 |
| TOL-024 | env secret | 不暴露 |
| TOL-025 | output limit | 截断并保存引用 |
| TOL-026 | same call loop | 达到上限终止 |

## 11. Harness 用例

| ID | 场景 | 预期 |
|---|---|---|
| HAR-001 | Intent simple | 分类和策略 |
| HAR-002 | Intent refactor | 分类和策略 |
| HAR-003 | Intent architecture | 分类和策略 |
| HAR-004 | Role influences policy | Applied Event |
| HAR-005 | fast decision | fast model applied |
| HAR-006 | strong decision | strong model applied |
| HAR-007 | single model | 安全退化 |
| HAR-008 | user override | 优先 |
| HAR-009 | failure upgrade | 只对能力失败 |
| HAR-010 | network error | 不错误升级 |
| HAR-011 | reasoning effort | Capability 正确 |
| HAR-012 | constraint extract | 来源完整 |
| HAR-013 | constraint delete | 不再应用 |
| HAR-014 | duplicate constraint | 去重 |
| HAR-015 | compaction | 仍保留 |
| HAR-016 | baseline byte stability | 一致 |
| HAR-017 | cache metric | 只展示 Provider 数据 |
| HAR-018 | current reasoning | 完整 |
| HAR-019 | next reasoning | 协议允许时摘要 |
| HAR-020 | old reasoning | 协议允许时剥离 |
| HAR-021 | cross-model | Metadata 清理 |
| HAR-022 | scope initialize | expected files 正确 |
| HAR-023 | constraint violation | 阻止完成 |
| HAR-024 | review advisory | 不错误阻断 |
| HAR-025 | review enforcement | 阻断/修复 |
| HAR-026 | model decision event | decided/applied |
| HAR-027 | role decision event | decided/applied |
| HAR-028 | scope decision event | decided/applied |
| HAR-029 | harness failure | Enforcement fail-closed |
| HAR-030 | advisory failure | 降级且可观察 |

## 12. Gateway Core 用例

### Startup / Registry

| ID | 场景 | 预期 |
|---|---|---|
| GW-001 | 未启用 | 不监听 |
| GW-002 | 默认 host | localhost |
| GW-003 | public 无安全配置 | 拒绝启动 |
| GW-004 | Adapter 注册 | 唯一名称 |
| GW-005 | 缺 verifyInbound | 拒绝 Stable 注册 |
| GW-006 | health | 返回结构化状态 |
| GW-007 | graceful shutdown | Server/Queue/Adapter 停止 |

### Auth / Replay / Limit

| ID | 场景 | 预期 |
|---|---|---|
| GW-008 | 正确签名 | 接受 |
| GW-009 | 缺签名 | 拒绝 |
| GW-010 | 错签名 | 拒绝 |
| GW-011 | 过期 Timestamp | 拒绝 |
| GW-012 | Future Timestamp | 拒绝 |
| GW-013 | Replay | ACK 但不重复执行 |
| GW-014 | Duplicate Message ID | 幂等 |
| GW-015 | Oversized Body | 拒绝 |
| GW-016 | Rate Limit | 限制 |
| GW-017 | Auth Failure Log | 不泄露 Secret |
| GW-018 | Auth failure queue | 不入队 |

### Identity / Workspace / Session

| ID | 场景 | 预期 |
|---|---|---|
| GW-019 | allowed user | 进入 |
| GW-020 | unauthorized user | 拒绝 |
| GW-021 | allowed workspace | 绑定 |
| GW-022 | arbitrary path in message | 忽略/拒绝 |
| GW-023 | platform collision | 不串话 |
| GW-024 | tenant collision | 不串话 |
| GW-025 | chat collision | 不串话 |
| GW-026 | thread isolation | 正确 |
| GW-027 | resume session | 恢复 |
| GW-028 | new session | 新 ID |
| GW-029 | end session | 清理映射 |

### Queue / Runtime / Delivery

| ID | 场景 | 预期 |
|---|---|---|
| GW-030 | Queue Capacity | 超限拒绝/busy |
| GW-031 | same session ordering | 串行 |
| GW-032 | cross-session concurrency | 有上限并发 |
| GW-033 | runtime prompt | 直接 API |
| GW-034 | no CLI subprocess | 调用图/运行断言 |
| GW-035 | runtime abort | 终止 |
| GW-036 | runtime error | 平台错误响应 |
| GW-037 | sourceAdapter | 原平台回包 |
| GW-038 | long message | 分段 |
| GW-039 | send retry | 退避 |
| GW-040 | delivery failure | 记录状态 |
| GW-041 | platform batch events | 全部处理 |
| GW-042 | unsupported attachment | 明确提示 |
| GW-043 | permission interactive | once/always/reject |
| GW-044 | no interactive permission | 暂停/拒绝，不自动 allow |

## 13. 飞书 Stable 用例

| ID 范围 | 内容 |
|---|---|
| FEI-001~008 | App Auth / Challenge |
| FEI-009~015 | WS / Webhook Lifecycle |
| FEI-016~022 | Message Parser / Batch |
| FEI-023~028 | Replay / Idempotency |
| FEI-029~035 | Identity / Workspace |
| FEI-036~043 | Session / Role |
| FEI-044~050 | Outbound / Segment |
| FEI-051~055 | Reconnect / Health |
| FEI-056~060 | Permission UX |
| FEI-061~065 | Mock E2E |
| FEI-066~070 | Real E2E |

## 14. Beta Adapter 用例

每个平台必须复用 Gateway Core Contract，并具有独立前缀：

- WEC-xxx。
- TLG-xxx。
- SLK-xxx。

最低包括：

- Auth / Timestamp。
- Parser。
- Replay。
- Identity / Session。
- Workspace。
- Outbound。
- Permission 降级。
- Mock E2E。
- 已知限制。

## 15. Security 用例

| ID | 场景 | 预期 |
|---|---|---|
| SEC-001 | 全历史 Secret Scan | 0 有效 Secret |
| SEC-002 | 日志 API Key | 不出现 |
| SEC-003 | Gateway Secret | 不出现 |
| SEC-004 | Source body | 默认不完整持久化 |
| SEC-005 | Dependency Scan | 无发布阻断 |
| SEC-006 | License Scan | 合规 |
| SEC-007 | Patch Manifest | Owner/Reason/Upstream |
| SEC-008 | Telemetry default | 关闭/opt-in |
| SEC-009 | prompt/source telemetry | 不上传 |
| SEC-010 | public gateway | 安全配置强制 |

## 16. Install / Release 用例

| ID | 场景 | 预期 |
|---|---|---|
| INS-001 | Ubuntu install | 成功 |
| INS-002 | macOS arm64 install | 成功 |
| INS-003 | `--version` | 正确 |
| INS-004 | `--help` | 正确 |
| INS-005 | doctor | Runtime/Role/Gateway 检查 |
| INS-006 | package roles | 13 个存在 |
| INS-007 | package gateway | Core 和目标 Adapter 存在 |
| INS-008 | no standalone agent product | 无独立入口 |
| INS-009 | README local demo | 可复现 |
| INS-010 | README Feishu demo | 可复现 |
| INS-011 | uninstall | 无项目残留 |
| INS-012 | checksum | 验证通过 |

## 17. Release Gate

v0.1 不允许发布，除非：

1. Required CI 全绿。
2. P0 = 0。
3. Provider Contract 全通过。
4. 13 Role 自动化场景覆盖 100%。
5. 核心和关键高级角色 Runtime E2E 通过。
6. Gateway Core Stable Tests 全通过。
7. 飞书 Stable Mock + Real E2E 通过。
8. Beta Adapter 目标达成或具有显式 ADR。
9. Install Matrix 通过。
10. Claim Evidence Coverage = 100%。

## 18. Phase 0 说明

本文件定义测试范围，Phase 0 不执行上述运行测试。当前 [05_FUNCTIONAL_TEST_REPORT.md](./05_FUNCTIONAL_TEST_REPORT.md) 仍是代码整改前基线；后续每个 Phase 必须将相应用例自动化并更新报告。
