# DeepCode 需求与产品主张追踪矩阵

> 目的：防止“文档写了、模块存在、Commit 说完成”被误认为产品能力已完成

## 1. 判定规则

一项产品主张只有同时具备以下证据，才能写入 README 的 Stable/Beta 能力：

```text
PRD Requirement
+ Main Code Path
+ Applied Behavior
+ Automated Test
+ Runtime Evidence
```

状态：

- **Verified**：五项齐全。
- **Implemented-Unverified**：代码存在，缺运行证据。
- **Partial**：只完成部分链路。
- **Not Implemented**：不存在或未接入。
- **Blocked**：环境或外部条件阻塞验证。

## 2. README 核心主张审计

| 公开主张 | PRD | 关键代码区域 | 当前状态 | 缺失证据 | 测试 |
|---|---|---|---|---|---|
| 支持 DeepSeek OpenAI-compatible API | FR-PROVIDER-001~005 | `packages/llm` OpenAI-compatible Chat、Session Model Resolve | Partial | 当前 Commit Contract Run | PRO-001~025 |
| reasoning_effort 动态控制 | FR-REASON-001 | SessionRunner、OpenAIOptions、OpenAI Chat Lowering | Partial/Fail | 字段失配；max 能力冲突 | PRO-003~007、HAR-011 |
| thinking/reasoning 深度集成 | FR-REASON-002~004 | Stream Parser、Session History Projection | Partial | 三阶段策略未接投影 | PRO-009/013/025、HAR-018~021 |
| Flash-first，复杂任务自动 Pro | FR-ROUTE-001~005 | ModelRouter、SessionRunnerModel、SessionRunner | Partial/Fail | 路由发生在 Model Resolve 后 | HAR-005~010、HAR-029~030 |
| 长上下文稳定 | FR-CONTEXT-001~005 | Context Epoch、Compaction、History Projection | Implemented-Unverified | 长 Session/Overflow E2E | SES-012~015、PERF-002/009 |
| Prefix Cache 优化 | FR-CONTEXT-001/005 | System Context、Provider Usage | Partial | byte stability 与 cache 指标证据 | HAR-016/017、PERF-010 |
| 硬约束防遗忘 | FR-CONTEXT-002 | Constraint Store/Context Source/Runner | Partial | 压缩后保留、违规 enforcement | HAR-012~015/023 |
| Scope Creep 防护 | FR-SCOPE-001~003 | Scope Guard、Tool Runner | Partial/Unsafe | Scope 初始化、Bash/Symlink 安全 | TOL-013~024 |
| Harness 保证 Agent 不乱来 | FR-PERM、FR-SCOPE、FR-REVIEW | Permission/Scope/Review | Not Valid | 多个 fail-open、Review 仅日志 | TOL、HAR-023/024 |
| 14 个 Harness 模块深度接入 | 全 PRD | `packages/core/src/deepcode`、SessionRunner | Partial | 各模块 applied/test 证据 | HAR-001~030 |
| 13 个角色可用 | FR-ROLE | `packages/oh-my-deepagent` | Experimental | Tool/Skill 白名单未执行；无主 Runtime E2E | ROL-001~013 |
| 支持飞书/微信/11 平台 | FR-GW | `packages/deepcode-gateway` | Experimental/Unsafe | 鉴权、回包、Session 隔离、E2E | GW-001~030 |
| npm install -g deepcode | FR-INSTALL | Root/CLI Package | Not Ready | Package private、发布 Smoke | INS-001~012 |
| 纯 TypeScript、无 Python 桥接 | NFR/Architecture | Gateway/Build | Implemented-Unverified | Package/Runtime dependency scan | OSS/INS |
| 全部强类型、编译期拦截问题 | NFR-Maintainability | TypeScript/Effect | Overstated | 多项运行逻辑错误不可能由类型拦截 | 全套测试 |

## 3. v0.1 Must Have 追踪

| Requirement | Owner Area | Code Path | Test IDs | 当前状态 | v0.1 Gate |
|---|---|---|---|---|---|
| FR-INSTALL-001 正式安装 | Release | package/build/release | INS-001~012 | Not Ready | 必须通过 |
| FR-SESSION-002 Session 恢复 | Runtime | Session Store/Runner | SES-001~010 | Implemented-Unverified | 必须通过 |
| FR-PROVIDER-002 Wire Body | Protocol | OpenAI Chat Lowering | PRO-001~007 | Partial | 必须通过 |
| FR-PROVIDER-003 Stream | Protocol | Parser/Lifecycle | PRO-008~021 | Implemented-Unverified | 必须通过 |
| FR-AGENT-003 Tool Loop | Runtime | SessionRunner/Tool Settlement | SES/TOL | Implemented-Unverified | 必须通过 |
| FR-PERM-002 deny | Security | Permission/Workflow | TOL-008~012 | Fail | 必须修复 |
| FR-ROUTE-003 Applied | Harness | Router/Model Resolver | HAR-005~010 | Fail | 必须修复 |
| FR-REASON-001 Effort | Protocol/Harness | Reasoning/Provider | PRO-003~007 | Fail | 必须修复 |
| FR-CONTEXT-002 Constraint | Harness | Constraint/Context | HAR-012~015 | Partial | 必须闭环 |
| NFR-SEC-001 Secret | Security | Git/CI | OSS-001 | Fail | 必须修复 |
| NFR-SEC-002 Default Safe | Security/Gateway | Server/Permission | GW/TOL | Fail | 必须修复 |
| OSS Root Check | Release | package/turbo/CI | OSS-011~013 | Not Ready | 必须通过 |

## 4. Harness 模块追踪

| 模块 | Service/Node | 主链路调用 | 输出被消费 | 自动测试 | 当前成熟度 |
|---|---|---|---|---|---|
| Prefix Context | 有 | System Context | 部分 | 待核查 | Beta Candidate |
| Constraint Store/Context | 有 | Runner 提取 | Context 注入需 E2E | 待补 | Beta Candidate |
| Model Router | 有 | Runner decide | **未改变 Model** | 局部 | Partial |
| Reasoning Manager | 有 | Runner getEffort | 字段失配/历史未消费 | 局部 | Partial |
| Intent Router | 有 | Runner classify | Strategy 被部分使用 | 局部 | Beta Candidate |
| Immune System | 有 | Turn End | 只日志，不 enforcement | 局部 | Experimental |
| Meta Directives | 有 | Tool Intercept | 部分 callback 生效 | 待补 | Experimental |
| Window Manager | 有 | Runner 查询 | 只部分影响 max tokens | 待补 | Experimental/Beta |
| Signal Tagger | 有 | 注册 | 主请求实际使用待证 | 待补 | Experimental |
| OKR Plan | 有 | Turn End evaluate | Plan 创建/生命周期不完整 | 局部 | Experimental |
| Review Anti-drift | 有 | Turn End record | 只日志建议 | 局部 | Experimental |
| Scope Creep Guard | 有 | Tool Intercept | 初始化/安全缺陷 | 局部 | Unsafe Partial |
| Skill Evolution | 有 | 注册 | 主链路使用待证 | 待补 | Experimental |
| Memory Granularity | 有 | Turn End | 主 Context 投影作用待证 | 局部 | Experimental |

## 5. Gateway 平台追踪模板

每个平台必须单独完成以下矩阵，不能以“Adapter 文件存在”标记支持：

| 平台 | Inbound Auth | Parser | Idempotency | Session Isolation | Outbound | E2E | 状态 |
|---|---|---|---|---|---|---|---|
| Feishu | 待验证 | 有 HTTP/WS Parser | 未闭环 | 未闭环 | 有 | 待执行 | Experimental |
| WeChat/WeCom | 待验证 | 部分 | 未闭环 | 未闭环 | 部分 | 待执行 | Experimental |
| Telegram | 未统一执行 | 有 | 未闭环 | 未闭环 | 有 | 待执行 | Unsafe Partial |
| Slack | 未统一执行 | 有 | 未闭环 | 未闭环 | 有 | 待执行 | Unsafe Partial |
| Matrix | Token 未统一执行 | 有，批量丢失 | 未闭环 | 未闭环 | 有 | 待执行 | Unsafe Partial |
| Signal | 待验证 | 有 | 未闭环 | 未闭环 | 有/部分 | 待执行 | Experimental |
| WhatsApp | 待验证 | 有 | 未闭环 | 未闭环 | 有/部分 | 待执行 | Experimental |
| DingTalk | 待验证 | 有 | 未闭环 | 未闭环 | 有/部分 | 待执行 | Experimental |
| QQ | 待验证 | 部分 | 未闭环 | 未闭环 | 有/部分 | 待执行 | Experimental |
| Email | 待验证 | 部分 | 未闭环 | 未闭环 | 有/部分 | 待执行 | Experimental |

v0.1 只允许一个平台完成全列后进入 Experimental Release。

## 6. Evidence 记录模板

每项 Requirement 在完成时增加：

```yaml
requirement: FR-ROUTE-003
commit: <sha>
code:
  - path: <path>
    symbol: <symbol>
tests:
  - id: HAR-006
    command: <command>
    result: pass
artifacts:
  - <CI artifact URL/path>
runtime:
  model_decided: <id>
  model_applied: <id>
reviewed_by: <name>
date: <date>
```

## 7. README 发布规则

### Stable/Beta 可以写入

仅当：

- Current Status 为 Verified。
- v0.1 Gate 通过。
- 文档链接指向本矩阵证据。

### Experimental 可以写入

仅当：

- 明确标记 Experimental。
- 默认关闭或不影响安全。
- 已列出已知限制。

### 必须删除或降级的措辞

- 唯一。
- 完全。
- 全栈适配。
- 保证不乱来。
- 11 平台支持。
- 自动切换已完成。

除非有独立可重复证据支持。

## 8. 当前 Claim Coverage

按当前静态证据估计：

- Verified：0 项（当前 Commit 无运行证据）。
- Implemented-Unverified：部分基础能力。
- Partial/Failed：多数 DeepCode 差异化主张。
- Experimental：Gateway、DeepAgent、Evolution 类模块。

因此当前 README 应以“研究型 Alpha”描述，而不是正式产品发布描述。