# DeepCode 功能测试报告

> 测试基线：`master@ff79c93cc8c865349a74e6844d4881be99f5ce65`
> 报告日期：2026-07-27
> 总体结论：**FAIL / RUNTIME TEST BLOCKED**

## 1. 结论

当前版本不满足开源发布门槛。

本轮完成了：

- 最新 Commit/仓库状态核查。
- 核心主链路源码级功能验证。
- Package/Test/CI 配置核查。
- Gateway 安全和路由链路核查。
- Provider Protocol 字段映射核查。
- Permission、Scope、Session Bridge 核查。

本轮未能完成：

- 本地 clone、install、build、typecheck 和 test。
- 真实 DeepSeek API 调用。
- Gateway 真实平台联调。
- OS/架构兼容测试。
- 安装包 Smoke Test。

因此本报告不使用“全量测试通过”等表述。

## 2. 执行环境与阻塞

### 2.1 本地执行尝试

执行：

```bash
gh --version && gh auth status
```

结果：

```text
gh: command not found
```

执行：

```bash
git clone --depth=1 --branch master https://github.com/yuanchenglu/deepcode.git
```

结果：

```text
Could not resolve host: github.com
```

### 2.2 GitHub CI 核查

对最新 Commit `ff79c93...` 核查：

- Combined Status：无 Status。
- Commit Workflow Runs：无关联 Run。

结论：当前没有可引用的最新 Commit CI 证据。

### 2.3 历史证据限制

已有旧审计文档记录过某些历史 Commit 的 typecheck 通过，但：

- 不是当前最新 Commit。
- Typecheck 不能证明功能正确。
- 历史文档已出现过 Stub 被误判为完成的问题。

因此历史结果只作为背景，不计入本轮 Passed。

## 3. 测试统计

| 类型 | Passed | Failed | Blocked | Not Run |
|---|---:|---:|---:|---:|
| 仓库/Commit 状态 | 3 | 1 | 0 | 0 |
| Provider/Protocol 静态功能 | 2 | 3 | 5 | 15 |
| Session/Tool/Permission 静态功能 | 2 | 5 | 5 | 18 |
| Harness 主链路静态功能 | 4 | 6 | 5 | 15 |
| Gateway 静态功能/安全 | 2 | 8 | 5 | 20 |
| 安装/构建/运行 | 0 | 1 | 12 | 0 |
| 开源工程 | 3 | 5 | 2 | 5 |
| **合计** | **16** | **29** | **34** | **73** |

说明：

- Passed 表示源码和配置能够明确证明预期行为。
- Failed 表示源码能够明确证明行为与 PRD 相反。
- Blocked 表示必须运行才能判断，但环境不可用。
- Not Run 表示本轮未执行。

## 4. 已执行结果

### 4.1 仓库与分支

| ID | 结果 | 证据 |
|---|---|---|
| REP-001 仓库可访问 | PASS | GitHub Connector 可读取 `yuanchenglu/deepcode` |
| REP-002 默认分支 | PASS | 默认分支为 `master` |
| REP-003 develop 分支 | PASS | 本轮已从 `master` 创建 `develop` |
| REP-004 最新 Commit CI | FAIL | 最新 Commit 无 Status/Workflow Run |

### 4.2 Provider/Protocol

| 用例 | 结果 | 实际行为 |
|---|---|---|
| PRO-001 OpenAI-compatible Chat Route | PASS-STATIC | Route 使用 `/chat/completions` 和 SSE |
| PRO-008/009 Text/Reasoning Parser | PASS-STATIC | Parser 显式处理 content/reasoning_content |
| PRO-003/004 reasoning effort wire | FAIL | SessionRunner 写 snake_case，OpenAIOptions 读取 camelCase |
| PRO-005 max effort | FAIL | ReasoningManager 返回 max，OpenAI Chat 校验排除 max |
| PRO-007 防静默字段失配 | FAIL | 当前没有 Wire Contract Test 阻止失配 |
| PRO-010 Tool Delta | BLOCKED | 需执行 Fixture/Unit Test |
| PRO-012 Tool Result 回传 | BLOCKED | 需执行 Integration/Contract Test |
| PRO-013 Reasoning Continuation | BLOCKED | 需真实/Mock 多轮请求 |
| PRO-014~016 Usage | BLOCKED | 需 Fixture 执行 |
| PRO-022 Abort | BLOCKED | 需运行 Stream |

判定：Provider 基础代码质量较高，但 DeepCode 关键差异化参数没有形成可靠 Contract。

### 4.3 Session 与 Tool

| 用例 | 结果 | 实际行为 |
|---|---|---|
| SES-004 Message Projection | PASS-STATIC | User/Assistant/Tool/Compaction 有显式投影 |
| SES-007 Interrupted Tool Settlement | PASS-STATIC | Runner 会把 pending/running Tool 标记失败 |
| TOL-008 deny | PARTIAL | 基础 Permission.ask 能拒绝，但 Workflow 预批准有缺陷 |
| TOL-009 Workflow deny | FAIL | `action !== ask` 将 deny 视为 preapproved |
| TOL-013 Workspace 外写 | FAIL | 字符串 startsWith 校验存在同前缀绕过 |
| TOL-015 Symlink | FAIL | 未见 realpath 边界校验 |
| TOL-017 Bash Timeout | FAIL/BLOCKED | Gateway 子进程 timeout 时序错误 |
| TOL-020 Scope 未初始化 | FAIL | allowedFiles 初始为空，未见稳定初始化闭环 |
| TOL-024 多文件 Scope | BLOCKED | 需 Tool Integration Test |

### 4.4 Harness

| 用例 | 结果 | 实际行为 |
|---|---|---|
| HAR-001~003 Intent 分类模块 | PASS-STATIC | Service 和策略存在 |
| HAR-012 Constraint 提取 | PASS-STATIC | 主 Runner 调用 extractAndAdd |
| HAR-022 Checkpoint Review | PASS-STATIC | Turn End 存在 Review 调用 |
| HAR-025 Skill Proposal | PASS-STATIC | pendingSkills Ref 暂存，不自动激活 |
| HAR-005 决策先于 Model Resolve | FAIL | Model 已先 resolve |
| HAR-006 Route Applied | FAIL | 决策不改变当前 Model |
| HAR-009 Failure Upgrade | FAIL | 未形成 recordFailure→resolve 强模型闭环 |
| HAR-011 Reasoning Applied | FAIL | 字段失配导致未应用 |
| HAR-019/020 Reasoning Lifecycle | FAIL | History Projection 未调用 ReasoningManager |
| HAR-023 Enforcement Review | FAIL | Review 违规只记录日志，不阻断完成 |
| HAR-026 Meta 路径安全 | FAIL | startsWith 判断不可靠 |
| HAR-029 Decision Audit | PARTIAL | 有分散日志/历史，缺少统一 decided/applied 事件 |

### 4.5 Gateway

| 用例 | 结果 | 实际行为 |
|---|---|---|
| GW-012 Invalid JSON | PASS-STATIC | 返回 400 |
| GW-013 Unknown Path | PASS-STATIC | Router 返回 Adapter Not Found/Server 404 路径存在 |
| GW-004/006/009 平台鉴权 | FAIL | 多个 Adapter 注释要求鉴权但没有统一执行入口 |
| GW-016 多平台回包 | FAIL | Consumer 固定使用第一个 Adapter |
| GW-017 平台 Session 隔离 | FAIL | Session Map 仅使用 chatId |
| GW-020 Queue Capacity | FAIL | 使用 unbounded Queue |
| GW-023 Subprocess Timeout | FAIL | 先等 Stream 结束再启动 timeout race |
| GW-024 stdout 上限 | FAIL | Buffer 无明确容量限制 |
| GW-026 Matrix 多消息 | FAIL | 只取 Parser 数组第一条 |
| GW-029 Adapter 生命周期 | BLOCKED | 需运行 WS/HTTP Server |
| GW-005/007/008/010 | BLOCKED/FAIL | 必须建立固定签名向量并执行 |

### 4.6 安装和开源工程

| 用例 | 结果 | 实际行为 |
|---|---|---|
| INS-001 正式安装 | FAIL-STATIC | README 宣传 npm 安装，但相关 Package 为 private |
| INS-009 Package Metadata | FAIL | Root repository 仍指向上游 OpenCode |
| OSS-001 Secret Scan | FAIL | 已确认历史凭据泄露，尚无轮换/历史清理证据 |
| OSS-003 Upstream Copyright | PASS-STATIC | README 说明基于 OpenCode MIT |
| OSS-005 Issue Template | PASS-STATIC | 仓库已有 Issue/PR Template 来源 |
| OSS-011 Root Check | FAIL | Root test 脚本主动退出 |
| OSS-012 CI Required | FAIL/BLOCKED | 最新 Commit 无 CI Status |
| OSS-014 Personal Paths | PARTIAL PASS | 最近安全 Commit 已清理部分路径，需全历史扫描 |

## 5. P0 缺陷列表

| ID | 缺陷 | 影响 |
|---|---|---|
| FT-P0-001 | Gateway 入站鉴权缺失 | 可伪造消息触发 Agent |
| FT-P0-002 | 历史 Secret 泄露 | 凭据滥用风险 |
| FT-P0-003 | reasoning effort 字段失配 | 核心卖点失效 |
| FT-P0-004 | Model Routing 不应用 | Flash/Pro 自动路由失效 |
| FT-P0-005 | 多平台错误回包 | 功能不可用/数据泄露 |
| FT-P0-006 | Subprocess timeout 失效 | 消息队列永久阻塞/OOM |
| FT-P0-007 | Workflow deny 被预批准 | 权限绕过 |
| FT-P0-008 | 路径边界判断缺陷 | Workspace 外文件风险 |

## 6. P1 缺陷列表

- Scope 未初始化且 Bash 绕过。
- Reasoning 生命周期未接入消息投影。
- Role Tool/Skill 白名单未执行。
- Session Key 缺少平台/租户/用户维度。
- Matrix 批量消息丢失。
- Enforcement 与 Advisory 失败策略混杂。
- 同步文件 IO 阻塞主运行时。
- 多个运行状态无界。
- 正式发布 Package 未闭环。
- 单一测试入口缺失。

## 7. 未执行测试清单

必须在可联网 Runner 中补跑：

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun --cwd packages/opencode test
bun --cwd packages/core test
bun --cwd packages/deepcode-gateway test
bun --cwd packages/oh-my-deepagent test
bun run build
```

若 Package 名称或脚本不同，应以实际 Package 为准并更新统一入口。

还需执行：

1. Mock DeepSeek Contract Suite。
2. 真实 DeepSeek 最小 E2E。
3. Gateway 签名固定向量。
4. 安装包 Smoke Test。
5. macOS/Linux Matrix。
6. Secret/Dependency/License Scan。
7. 长 Session、Queue、Subprocess 压测。

## 8. 建议的 CI Job

```text
static
├── lint
├── typecheck
├── secret-scan
└── license-check

core-test
├── provider-contract
├── session-integration
├── tool-permission
└── harness-policy

gateway-test
├── auth-fixtures
├── router
├── session-isolation
└── timeout/backpressure

build-install
├── package
├── fresh-install
└── smoke-run
```

## 9. Release 判定

当前判定：**NO-GO**。

解除条件：

- 8 个 P0 缺陷全部关闭。
- 本文 Blocked 的 P0 用例全部实际执行。
- 最新 Release Commit 有完整 CI Artifact。
- 安装和真实 DeepSeek E2E 通过。
- README 根据实际成熟度重写。

## 10. 报告诚信说明

本报告将“无法执行”记为 Blocked，而不是 Passed；将源码明确证明的错误记为 Failed，而不是“待优化”。这应成为 DeepCode 后续测试报告的统一原则。