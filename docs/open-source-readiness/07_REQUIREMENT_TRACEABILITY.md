# DeepCode v0.1 需求与产品主张追踪矩阵

> 版本：3.0
> 状态：v0.1 CLI-first Alpha 范围已修订
> 目的：防止把文件存在、类名、角色注册或 Adapter 导出误认为正式产品能力
> 架构勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 新增官方安装、发行身份、OpenCode 共存和 Desktop 冲突追踪；Agent/Gateway 改为后续版本门禁 | 开源准备复核与用户确认 |

## 1. Verified 判定

一项主张只有同时具备以下证据，才能标记 Verified：

```text
PRD Requirement
+ Accurate Responsibility Classification
+ Production Call Path
+ Applied Behavior
+ Automated Test
+ Runtime Evidence
```

## 2. Runtime 相关判定修正

以下事实不能单独证明“第二套生产 Runtime”：

- 存在 AgentRuntime；
- 存在 runMessageLoop；
- 存在 ToolRunner；
- 存在 MemoryStore；
- 存在独立 Provider 或 Transport。

必须进一步证明：

- 被生产入口调用；
- 与宿主对同一职责形成冲突；
- 状态权威性不一致；
- 绕过安全或导致维护分裂。

## 3. 产品主张矩阵

| 主张 | 当前事实 | 缺失证据 | 当前状态 |
|---|---|---|---|
| 官网可安装 DeepCode | 官网在线，但 npm 命令指向第三方包 | 本项目 Release、checksum、安装 Smoke | **Fail / Misleading** |
| DeepCode 与 OpenCode 共存 | CLI 名称不同，但配置/数据/DB/环境变量/卸载仍复用 OpenCode | 隔离实现、COE、VM | **Fail / Unsafe** |
| DeepCode 内置 oh-my-deepagent | Package 存在并导出 Role/Skill/Runtime 等能力，未发现生产依赖 | v0.2 入口、安装产物和场景 E2E | Not Integrated / v0.2 Target |
| Host 与 Plugin 共生 | 产品目标已确认 | 原始插件契约和当前调用图 | Blocked by Audit |
| 存在第二套生产 Runtime | 仅确认独立可运行实现存在 | 生产调用方和职责冲突证据 | **Not Proven** |
| AgentRuntime 必须删除 | 无充分证据 | 用途分类、替代路径和回归 | **Withdrawn** |
| 角色全部预装 | 13 个 Role 定义存在；不属于 v0.1 门禁 | v0.2 准确清单、入口、安装验证 | v0.2 Target |
| Plan/Build/Review | 角色/规划代码存在 | v0.2 Host/Plugin 场景 E2E | Not Integrated / v0.2 Target |
| Subagent/Multi-Agent | 当前源码证据不足 | v0.2 调用图、安全和并发测试 | Unknown / v0.2 Target |
| DeepSeek Provider | OpenAI-compatible 代码存在 | Wire Contract 和真实 E2E | Partial |
| Model Routing | 决策代码存在 | model.applied 证据 | Partial/Fail |
| Hard Constraints | 模块存在 | 压缩后保持和 Enforcement | Partial |
| Permission deny | 基础存在 | 全入口不可绕过 | Fail |
| Gateway Core | Adapter/Server 代码存在 | Auth、Queue、Session、E2E | Partial/Unsafe / v0.3 Target |
| 飞书 Stable | Adapter 存在 | Auth、真机、多轮、恢复 | Not Verified / v0.3 Target |
| 安装发布 | Build/Publish 配置存在但名称和上游目标不一致 | 本项目 Release、干净环境 Smoke | Not Ready |
| Desktop 共存 | App ID、协议、产品名和更新源仍为 OpenCode | 完整独立身份和双安装 E2E | Fail / Not in v0.1 |

## 4. v0.1 发行与共存追踪

| Requirement | 当前证据 | Test IDs | Gate |
|---|---|---|---|
| 官方下载属于本项目 | 当前无 Release，npm 为第三方 | INS-001~002 | v0.1 必须完成 |
| CLI/配置/数据/DB 隔离 | 当前复用 `opencode` | INS-003~010 | v0.1 必须完成 |
| 默认不加载 Oh-my-OpenAgent | 当前发现 `.opencode` | INS-009~011、COE-002 | v0.1 必须完成 |
| upgrade/uninstall 只处理 DeepCode | 当前仍指向 OpenCode | INS-005~007、COE-005 | v0.1 必须完成 |
| 与 OpenCode/OMO 共存 | 未测试 | COE-001~006、VM-001~004 | v0.1 必须完成 |
| 官网安装闭环 | 当前命令无效 | VM-001、INS | v0.1 必须完成 |
| Desktop 独立身份 | 当前冲突 | Desktop Matrix | 后续版本 |

## 5. v0.2 Agent 审计追踪

| Requirement | Evidence | Test IDs | Gate |
|---|---|---|---|
| 原始 Host-Plugin 契约 | 上游源码和文档路径 | AUD-006~007 | 必须完成 |
| AgentRuntime 调用方 | 构造点/入口/测试清单 | AUD-001 | 必须完成 |
| runMessageLoop 调用方 | 调用图 | AUD-002 | 必须完成 |
| ToolRunner 用途 | 生产/测试/兼容分类 | AUD-003 | 必须完成 |
| MemoryStore 权威范围 | State Authority Matrix | AUD-004、STA | 必须完成 |
| Provider/Transport 用途 | 调用方和 Contract | AUD-005、PRO | 必须完成 |
| Gateway 调用链 | Gateway→Host→Plugin 图 | AUD-008、GW | 必须完成 |
| 迁移动作 | Keep/Adapt/Bridge/Replace/Remove | AUD-010 | 用户确认 |

## 6. Host-Plugin Contract 追踪

| Contract | 必须证明 | 测试 |
|---|---|---|
| Session/Task | Host Session 与 Orchestration/Child Task 可关联 | RUN、STA、ORC |
| Permission | Plugin/Subagent 不绕过 deny | TOL |
| Workspace | Plugin/Subagent 不越权 | TOL |
| Tool | 副作用、Settlement、Evidence 一致 | TOL、RUN |
| Provider | Reasoning/Tool/Abort/Usage 正确传播 | PRO |
| Memory | Canonical、Scratch、Durable 权威性明确 | STA |
| Cancel | Parent/Child/Gateway 可正确终止 | RUN、ORC、GW |

## 7. Built-in Agent 追踪

每个角色记录：

```yaml
role_id: <id>
source: <path>
plugin_entry: <symbol>
production_path: <path or unknown>
tools: []
skills: []
orchestration: <none|parent|subagent|multi-agent>
permission_contract: <verified|partial|unknown>
tests: []
runtime_evidence: []
maturity: <stable|beta|experimental|not-verified>
```

不能以“Registry 中有 13 项”直接标记 13 个角色 Stable。

## 8. Gateway 追踪

每个平台必须单独记录：

| 平台 | Auth | Parser | Replay | Idempotency | Identity | Workspace | Host/Plugin Path | Outbound | E2E | 状态 |
|---|---|---|---|---|---|---|---|---|---|---|
| Feishu | 待验证 | 有 | 待闭环 | 待闭环 | 待闭环 | 待闭环 | 待审计 | 有 | 待执行 | v0.3 Stable Target |
| 其他平台 | 逐平台审计 | | | | | | | | | 分级 |

## 9. Harness 追踪

| 模块 | 决策存在 | Applied | Enforcement | 自动测试 | 状态 |
|---|---|---|---|---|---|
| Intent | 有 | 部分 | Advisory | 待补 | Partial |
| Model Router | 有 | 当前未可靠改变 Model | 否 | 局部 | Fail/Partial |
| Reasoning | 有 | 字段/历史存在缺口 | 协议约束 | 局部 | Partial |
| Constraints | 有 | 部分 | 待闭环 | 待补 | Partial |
| Scope | 有 | 有绕过风险 | 应 Enforcement | 局部 | Unsafe Partial |
| Review | 有 | 主要日志 | 多为 Advisory | 局部 | Partial |

## 10. Evidence 模板

```yaml
requirement: <id>
classification:
  nature: <host-execution|plugin-orchestration|compatibility|test-runtime|transitional|unused>
  action: <keep|adapt|bridge|replace|remove>
code:
  - path: <path>
    symbol: <symbol>
production_callers: []
tests:
  - id: <id>
    command: <command>
    result: <pass|fail|blocked>
runtime:
  session_id: <id>
  task_id: <id>
  orchestration_id: <id or none>
  applied: true
reviewed_by: <name>
commit: <sha>
```

## 11. README 发布规则

### 可以写入 Stable/Beta

- 调用路径和职责分类清楚。
- 当前 Commit 有测试和运行证据。
- 已知限制公开。

### 不得写入

- “存在 AgentRuntime，所以是第二套生产 Runtime”。
- “已经统一 Runtime”，如果仅修改文档。
- “13 个角色全部 Stable”，如果只完成预装。
- “Gateway 支持 11 平台”，如果没有逐平台矩阵。
- “Harness 保证不乱来”，如果 Enforcement 未闭环。
- `npm install -g deepcode`，如果该包不属于本项目。
- “不影响 OpenCode/Oh-my-OpenAgent”，如果 COE/VM Matrix 未通过。
- “内置插件/Gateway 已可用”，如果不存在生产调用路径和安装 E2E。

## 12. 当前结论

- v0.1 当前最高优先级是官方安装、发行身份和 OpenCode/Oh-my-OpenAgent 共存。
- Host-Plugin 共生是 v0.2 产品方向，不是当前已实现事实。
- 当前独立 Runtime 代码的生产性质尚未证明。
- 删除结论已撤销，等待 v0.2/v0.3 对应审计。
- Agent 审计后移不代表删除；Gateway 安全整改作为 v0.3 门禁保留。
- 安全、协议、安装、隔离和 CI 缺陷仍需按现有证据修复。
