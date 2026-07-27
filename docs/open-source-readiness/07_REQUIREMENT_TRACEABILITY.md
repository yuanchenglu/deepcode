# DeepCode v0.1 需求与产品主张追踪矩阵

> 版本：2.1
> 状态：Phase 0 范围冻结
> 目的：防止“文件存在、角色已注册、Adapter 已导出、Commit 说完成”被误认为正式产品能力

## 1. Verified 判定

一项 Stable/Beta 产品主张必须具备：

```text
PRD Requirement
+ Main Code Path
+ Applied Behavior
+ Automated Test
+ Runtime Evidence
+ Security Review
+ User Documentation
```

状态：

- **Verified**：全部证据齐全。
- **Implemented-Unverified**：实现存在，缺运行证据。
- **Partial**：链路不完整或输出未消费。
- **Failed**：已知行为与需求冲突。
- **Not Implemented**：不存在或未接入。
- **Blocked**：环境或外部条件阻塞验证。

成熟度：Stable、Beta、Experimental。

## 2. v0.1 一级主张

| 产品主张 | PRD | 当前代码区域 | 当前状态 | v0.1 Gate |
|---|---|---|---|---|
| DeepCode 使用唯一生产 Runtime | PRD-ADR-001 | core/opencode/deepagent/gateway | Failed / 多路径风险 | CLI、Agent、Gateway 共用 Runtime API |
| oh-my-deepagent 内置而非独立产品 | PRD-ADR-002 | `packages/oh-my-deepagent` | Partial | 无独立生产 Session/Tool/Permission/CLI |
| 13 个角色全部预装 | FR-AGENT-001~008 | Role Registry | Implemented-Unverified | 清单准确、Policy、Scenario、Docs |
| Gateway 是正式能力 | PRD-ADR-003 / FR-GW | gateway | Partial / Unsafe | Gateway Core Stable |
| 飞书正式支持 | FR-FEISHU-001 | feishu adapter/ws/api | Partial | Stable Matrix + 真机 E2E |
| 至少两个其他平台 Beta | FR-GW-BETA-001 | adapters | Partial | 单平台矩阵通过 |
| DeepSeek OpenAI-compatible | FR-PROVIDER | llm/provider/runtime | Partial | Contract 全通过 |
| Model Routing 真正切模型 | FR-ROUTE | router/model resolver | Failed | decided = applied，100% |
| Hard Constraints 生效 | FR-CONSTRAINT | constraint/context/tool/review | Partial | 压缩和 Enforcement E2E |
| Reasoning 深度集成 | FR-REASON | protocol/history | Partial | Wire + Continuation + Projection |
| deny 不可绕过 | FR-TOOL-002 | permission/workflow/roles/gateway | Failed | 全入口负向测试 |
| 安装即含 Runtime/Agent/Gateway | FR-INSTALL | package/build/release | Not Ready | Install Smoke Matrix |

## 3. Runtime 追踪

| Requirement | Code Path | Test IDs | 当前状态 | Evidence Needed |
|---|---|---|---|---|
| 唯一 Runtime API | core/opencode | RUN-001~010 | Not Implemented / 待盘点 | CLI/Agent/Gateway 同 API |
| Session 创建恢复 | Session Store/Runner | SES-001~010 | Implemented-Unverified | Runtime Integration |
| Runtime Events | Event / Bridge | RUN-011~020 | Partial | Event Contract Fixture |
| Tool Settlement | Tool Runner | TOL-001~007 | Implemented-Unverified | Cancel/Error E2E |
| Compaction | Context/History | SES-012~018 | Implemented-Unverified | 100 Turn / Overflow |
| Evidence | Session/Completion | EVD-001~010 | Partial | command/exit/duration/result |

## 4. Provider / Harness 追踪

| 主张 | Requirement | 当前状态 | 缺失 | Test IDs |
|---|---|---|---|---|
| Wire Body 正确 | FR-PROVIDER-002/005 | Partial | Contract Run | PRO-001~007 |
| Reasoning Stream | FR-PROVIDER-003 | Implemented-Unverified | SSE E2E | PRO-008~013 |
| Tool Continuation | FR-PROVIDER-004 | Implemented-Unverified | Multi-turn Contract | PRO-014~021 |
| Usage / Cache | FR-PROVIDER-003 | Implemented-Unverified | Provider Fixture / E2E | PRO-022~025 |
| reasoning effort | FR-REASON-001 | Failed | 字段和 Capability | HAR-011 / PRO-003~007 |
| Model Routing | FR-ROUTE | Failed | Resolve 前应用 | HAR-005~010 |
| Constraints | FR-CONSTRAINT | Partial | UI、Compaction、Enforcement | HAR-012~015/023 |
| Reasoning Lifecycle | FR-REASON-002 | Partial | History Projection | HAR-018~021 |
| Scope | FR-SCOPE | Partial / Unsafe | 初始化、Shell、Path | TOL-013~024 |
| Review | FR-REVIEW | Partial | Enforcement | HAR-023~027 |

## 5. 13 Role 追踪

### 5.1 发布规则

角色文件存在只证明 Definition 存在。Stable 必须通过：

```text
Registry
+ Prompt
+ Tool Whitelist Applied
+ Skills Resolved
+ Permission Negative Tests
+ Runtime Scenario
+ Documentation
```

### 5.2 角色矩阵

Phase 1 必须从代码生成真实 13 Role 清单。当前仅列出已确认名称，不猜测其余名称。

| Role | Definition | Registry | Tools Applied | Skills | Unit | Runtime Scenario | Docs | Target |
|---|---|---|---|---|---|---|---|---|
| Build | 待准确核查 | 待核查 | Failed / 未统一 | 待核查 | 待执行 | 待执行 | 待补 | Stable |
| Plan | 待准确核查 | 待核查 | Failed / 未统一 | 待核查 | 待执行 | 待执行 | 待补 | Stable |
| Review | 待准确核查 | 待核查 | Failed / 未统一 | 待核查 | 待执行 | 待执行 | 待补 | Stable |
| Oracle | 有 | 有 | 未验证 | 待验证 | 局部 | 待执行 | 待补 | Stable |
| Metis | 有 | 有 | 未验证 | 待验证 | 局部 | 待执行 | 待补 | Stable |
| Momus | 有 | 有 | 未验证 | 待验证 | 局部 | 待执行 | 待补 | Stable |
| Multimodal | 有 | 有 | 未验证 | 待验证 | 局部 | 待执行 | 待补 | Beta / Stable |
| Artistry | 有 | 有 | 未验证 | 待验证 | 局部 | 待执行 | 待补 | Beta / Stable |
| Role-09 | Phase 1 生成 | Phase 1 | 待实现 | 待验证 | 待执行 | 待执行 | 待补 | Stable/Beta |
| Role-10 | Phase 1 生成 | Phase 1 | 待实现 | 待验证 | 待执行 | 待执行 | 待补 | Stable/Beta |
| Role-11 | Phase 1 生成 | Phase 1 | 待实现 | 待验证 | 待执行 | 待执行 | 待补 | Stable/Beta |
| Role-12 | Phase 1 生成 | Phase 1 | 待实现 | 待验证 | 待执行 | 待执行 | 待补 | Stable/Beta |
| Role-13 | Phase 1 生成 | Phase 1 | 待实现 | 待验证 | 待执行 | 待执行 | 待补 | Stable/Beta |

### 5.3 Role Test IDs

- ROL-001~013：Registry 和 ID。
- ROL-014~026：Prompt Snapshot / Contract。
- ROL-027~039：Tool Whitelist。
- ROL-040~052：Skill Resolution。
- ROL-053~065：Permission Negative。
- ROL-066~078：Runtime Scenarios。
- ROL-079~085：Plan-Build-Review / Switch。
- ROL-086~090：Gateway Role Selection。

## 6. Built-in DeepAgent 迁移追踪

| 项目 | 当前状态 | 目标 | Gate |
|---|---|---|---|
| Role / Skill Assets | 存在 | Keep | 引用完整性 |
| 独立 Message Loop | 待盘点 | Delete after migration | Runtime Scenarios |
| 独立 Session | 待盘点 | Delete after migration | Session Migration Tests |
| 独立 Provider | 待盘点 | Delete after migration | Provider Contract |
| 独立 Tool Executor | 存在风险 | Delete after migration | Unified Tool Tests |
| 独立 Permission | 存在风险 | Delete after migration | Permission Negative |
| 独立 CLI | 待盘点 | 不发布/删除 | Install Artifact Audit |

## 7. Gateway Core 追踪

| Requirement | 当前状态 | 缺失 | Test IDs | Target |
|---|---|---|---|---|
| 默认关闭/localhost | 待验证 | Config / Startup | GW-001~003 | Stable |
| Adapter Contract | Partial | verifyInbound / health / batch | GW-004~010 | Stable |
| Auth before Queue | Failed | Middleware | GW-011~018 | Stable |
| Replay / Idempotency | Not Implemented / Partial | Store | GW-019~025 | Stable |
| Body / Rate Limit | 待实现 | Middleware | GW-026~031 | Stable |
| Identity / Workspace | Partial | Allowlist | GW-032~040 | Stable |
| Session Key | Failed | 多维 Key | GW-041~047 | Stable |
| Queue / Ordering | Failed / Partial | Bounded / Locks | GW-048~055 | Stable |
| Runtime Bridge | Failed | Direct API | GW-056~062 | Stable |
| sourceAdapter Delivery | Failed | Adapter resolve | GW-063~067 | Stable |
| Permission UX | Not Implemented / Partial | Platform flow | GW-068~073 | Stable |
| Health / Logs | Partial | Metrics / Redaction | GW-074~080 | Stable |

## 8. Gateway Adapter 矩阵

| Platform | Auth | Parser | Replay | Session | Workspace | Outbound | Reconnect | Mock E2E | Real E2E | Target |
|---|---|---|---|---|---|---|---|---|---|---|
| Feishu | 部分/待验证 | 有 | 未闭环 | 未闭环 | 未闭环 | 有 | 部分 | 待执行 | 待执行 | Stable |
| WeCom | 待盘点 | 部分 | 未闭环 | 未闭环 | 未闭环 | 部分 | N/A/待定 | 待执行 | 待执行 | Beta candidate |
| Telegram | 未统一执行 | 有 | 未闭环 | 未闭环 | 未闭环 | 有 | N/A | 待执行 | 待执行 | Beta candidate |
| Slack | 未统一执行 | 有 | 未闭环 | 未闭环 | 未闭环 | 有 | N/A | 待执行 | 待执行 | Beta candidate |
| Matrix | 未统一执行 | 批量丢失风险 | 未闭环 | 未闭环 | 未闭环 | 有 | N/A | 待执行 | 待执行 | Experimental |
| Signal | 待盘点 | 有 | 未闭环 | 未闭环 | 未闭环 | 部分 | 待定 | 待执行 | 待执行 | Experimental |
| WhatsApp | 待盘点 | 有 | 未闭环 | 未闭环 | 未闭环 | 部分 | N/A | 待执行 | 待执行 | Experimental |
| DingTalk | 待盘点 | 有 | 未闭环 | 未闭环 | 未闭环 | 部分 | 待定 | 待执行 | 待执行 | Experimental |
| QQ | 待盘点 | 部分 | 未闭环 | 未闭环 | 未闭环 | 部分 | 待定 | 待执行 | 待执行 | Experimental |
| Email | 待盘点 | 部分 | 未闭环 | 未闭环 | 未闭环 | 部分 | N/A | 待执行 | 待执行 | Experimental |

Phase 1 必须根据实际代码补齐平台准确列表。

## 9. 飞书 Stable Gate

| Gate | Test IDs | 当前状态 |
|---|---|---|
| Auth / Challenge | FEI-001~008 | 待验证 |
| WS / Webhook Lifecycle | FEI-009~015 | 部分 |
| Parser / Batch | FEI-016~022 | 部分 |
| Replay / Idempotency | FEI-023~028 | 未闭环 |
| Identity / Workspace | FEI-029~035 | 未闭环 |
| Session / Role | FEI-036~043 | 未闭环 |
| Outbound / Segment | FEI-044~050 | 部分 |
| Reconnect | FEI-051~055 | 部分/待验证 |
| Permission | FEI-056~060 | 未闭环 |
| Mock E2E | FEI-061~065 | 待执行 |
| Real E2E | FEI-066~070 | 待执行 |

## 10. 安全追踪

| 风险 | 当前状态 | Gate |
|---|---|---|
| 历史 Secret | Failed | 轮换 + 全历史 Scan |
| Webhook 未鉴权 | Failed | Auth Negative Tests |
| Permission deny 预批准 | Failed | 全入口 deny Tests |
| Path Prefix Escape | Failed | realpath / symlink Tests |
| Scope fail-open | Failed | Enforcement Tests |
| Shell 绕过 | Failed / Partial | Sandbox / Policy Tests |
| Gateway Session 串话 | Failed risk | Session Matrix |
| 无界 Queue / Process | Failed risk | Capacity / Timeout Tests |

## 11. 安装和发布追踪

| Requirement | 当前状态 | Gate |
|---|---|---|
| 单一发布物 | Not Ready | Artifact Audit |
| 包含 13 Roles | Not Ready | Install + Registry Check |
| 包含 Gateway Core | Not Ready | Install + Health Check |
| 不发布独立 Agent Runtime | Not Ready | Package Manifest Audit |
| macOS / Linux | Blocked | Install Smoke |
| `bun run check` | Not Ready | Root Command |
| CI Required Checks | Not Ready | Branch Protection |

## 12. Evidence 记录模板

```yaml
requirement: FR-AGENT-005
commit: <sha>
code:
  - path: <path>
    symbol: <symbol>
tests:
  - id: ROL-027
    command: <command>
    result: pass
artifacts:
  - <artifact>
runtime:
  role_decided: build
  role_applied: build
  visible_tools: [read, edit]
  denied_tools: [bash]
security_review: pass
reviewed_by: <name>
date: <date>
```

## 13. README 发布规则

### 可写 Stable

- Current Status = Verified。
- Security Gate 通过。
- 文档链接到 Evidence。

### 可写 Beta

- 核心流程和自动测试通过。
- 无 P0。
- 限制明确。

### 必须降级

- Adapter 文件存在但无 Auth / E2E。
- Role 已注册但 Tool Policy 未执行。
- Router 有 Decision 但无 Applied。
- Harness 有日志但无 Enforcement。

## 14. 当前 Coverage

按当前静态证据：

- Verified：0 项；当前 Commit 缺运行证据。
- Implemented-Unverified：部分 Runtime、Provider、Role 和 Adapter 基础。
- Partial / Failed：多数差异化能力和 Gateway 安全链。
- Scope 已冻结，但代码整改尚未开始。

后续每个整改 PR 必须同时更新本矩阵，否则不得宣称 Requirement 完成。
