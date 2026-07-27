# DeepCode 产品需求文档（PRD）

> 版本：2.0
> 状态：开源准备基线
> 产品阶段：Research Alpha → Open-source Beta
> 第一目标：发布一个真实可安装、可执行、可验证、默认安全的 DeepSeek-native Coding Agent

---

## 1. 文档目的

本 PRD 取代以“14 个 Harness 模块是否存在”为核心的旧需求表达。产品完成度必须以用户闭环和可验证行为衡量。

状态定义：

| 状态 | 定义 |
|---|---|
| 已验证 | 当前 Commit 有可重复执行证据 |
| 已实现未验证 | 代码存在，但当前基线无运行证据 |
| 部分实现 | 接口/模块/记录存在，但没有形成闭环 |
| 未实现 | 不存在或未接入主执行路径 |

---

## 2. 背景

DeepCode 基于 OpenCode 二次开发，试图将 DeepSeek 的长上下文、Reasoning、OpenAI-compatible API 和缓存能力转化为 Coding Agent 产品优势。

项目目前已拥有：

- 完整 OpenCode Monorepo 底座。
- DeepSeek/OpenAI-compatible Protocol 支持。
- 14 个 DeepCode Harness 模块。
- Gateway 多平台 Adapter。
- oh-my-deepagent 及 13 个角色。
- 大量设计、研究和审计文档。

但仍存在：

- 产品主张与运行链路失配。
- 关键协议字段未真正生效。
- 模型路由仅记录不应用。
- Gateway 安全边界不足。
- 测试和发布不可复现。

因此 v0.1 不继续扩功能，而是完成产品闭环。

---

## 3. 产品愿景

> 让 DeepSeek 在真实软件工程任务中，通过可观察、可控制、可验证的 Harness 发挥稳定能力。

长期愿景：

- 模型能力和 Harness 策略共同演进。
- 用户能够理解 Agent 的关键决策。
- 长任务不因上下文增长、权限混乱或目标漂移而失控。
- 开源社区能够独立复现所有核心主张。

---

## 4. v0.1 目标与非目标

### 4.1 目标

1. 全新环境可安装并启动 DeepCode。
2. 可连接 DeepSeek OpenAI-compatible API。
3. 可完成一个真实仓库中的读取、修改、测试任务。
4. Session、Reasoning、Tool Call 和权限链路正确。
5. 至少两项 DeepCode Harness 差异化能力真实生效：
   - Model Routing。
   - Hard Constraints 或 Reasoning Lifecycle。
6. 公开主张全部具有追踪证据。
7. 默认不暴露未经鉴权的远程 Agent 入口。
8. 贡献者可通过单命令运行核心测试。

### 4.2 非目标

- 11 个 Gateway 平台全部 Stable。
- 13 个角色全部产品化。
- 自动创建并启用 Skill。
- 企业级多租户、SSO、审计后台。
- 云端托管和商业计费。
- 分布式 Session Runtime。
- 兼容所有 DeepSeek 第三方代理服务。

---

## 5. 用户画像

### Persona A：DeepSeek 开发者

- 熟悉 CLI、Git、API Key。
- 使用 DeepSeek 完成代码工作。
- 关注成本、质量、长上下文和可控性。

需求：

- 简单配置 DeepSeek。
- 清楚当前模型和推理设置。
- Agent 修改前后有证据。
- 不随意扩大修改范围。

### Persona B：Agent 工程师/研究者

- 研究 Context Engineering、Tool Use、Harness。
- 需要明确的模块接口和可复现实验。

需求：

- 能看到 Harness Decision。
- 能替换策略并运行测试。
- 文档与源码一致。

### Persona C：开源贡献者

- 第一次进入大型 Monorepo。
- 希望快速理解项目、复现问题和提交 PR。

需求：

- 清晰的架构和贡献指南。
- 单命令环境检查和测试。
- 明确的模块成熟度与边界。

---

## 6. 核心用户故事

### US-001 首次安装

作为开发者，我希望通过 npm/bun 或 Release Binary 安装 DeepCode，并在 10 分钟内完成首次模型对话。

### US-002 配置 DeepSeek

作为开发者，我希望仅配置 API Key、Base URL 和 Model，即可验证连接，无需理解内部 Provider Schema。

### US-003 完成代码修改

作为开发者，我希望 DeepCode 读取代码、提出最小修改、执行变更并运行验证，最终告诉我改了什么、为什么和测试结果。

### US-004 复杂任务路由

作为开发者，我希望复杂重构自动使用更强模型，而简单读取优先使用更快模型，并能看到实际使用的 Model ID。

### US-005 长会话稳定

作为开发者，我希望长任务中约束、计划和 Tool Call 仍然正确，不因压缩或 reasoning 回放导致协议错误。

### US-006 权限控制

作为开发者，我希望读操作可以自动进行，而写文件和 Shell 根据我的规则 ask/allow/deny，deny 永远不能被绕过。

### US-007 查看 Harness 决策

作为研究者，我希望查看意图、模型、reasoning、Scope 和 Review 的决策与原因。

### US-008 安全远程接入

作为高级用户，我希望可选启用飞书 Gateway，但只有合法签名、授权用户和指定 Workspace 能触发 Agent。

### US-009 贡献代码

作为贡献者，我希望 clone 后通过一个命令完成依赖检查、类型检查和测试，并明确失败原因。

---

## 7. 核心流程需求

## 7.1 安装与启动

### FR-INSTALL-001 支持的安装方式

至少提供一种正式支持、可验证的安装方式：

- npm package，或
- bun package，或
- GitHub Release Binary。

不能在 README 同时宣传未验证的安装方式。

验收：

- 在干净 Linux/macOS 环境安装成功。
- `deepcode --version` 返回版本。
- `deepcode --help` 正常。
- 卸载不残留项目文件。

### FR-INSTALL-002 环境诊断

提供 `deepcode doctor`：

- Runtime 版本。
- Git 状态。
- 配置路径。
- Provider 配置是否完整。
- 可选依赖是否存在。
- 网络连接测试。
- 不打印 Secret。

### FR-INSTALL-003 配置引导

首次启动缺少 Provider 时：

- 展示最小配置提示。
- 支持环境变量。
- 支持用户配置与 Workspace 配置。
- 提供连接测试。

---

## 7.2 Workspace 与 Session

### FR-SESSION-001 Workspace 识别

- 默认使用当前目录。
- 检测 Git Repository。
- 展示当前分支、未提交变更。
- 不自动覆盖用户未提交文件。

### FR-SESSION-002 Session 创建与恢复

- 新任务创建 Session。
- 可恢复历史 Session。
- Session 绑定 Workspace。
- 不同 Workspace 不串话。

### FR-SESSION-003 多轮上下文

- User/Assistant/Reasoning/Tool Call/Tool Result 顺序完整。
- Tool Call ID 与 Result ID 对应。
- Provider-required Metadata 在同模型回放时保留。
- 跨模型时移除不兼容 Metadata。

### FR-SESSION-004 中断与恢复

- 用户可取消 Provider Stream。
- 运行中 Tool 能收到 AbortSignal。
- 中断后的 pending/running Tool 被标记失败。
- Resume 不重复执行已完成副作用。

### FR-SESSION-005 最大步数

- Agent Step 有上限。
- 达到上限后禁止继续 Tool Call。
- 给出清晰终止原因。

---

## 7.3 DeepSeek Provider 与协议

### FR-PROVIDER-001 OpenAI-compatible 配置

配置项：

- API Key。
- Base URL。
- Model ID。
- Context Limit。
- Output Limit。
- Reasoning Capability。

### FR-PROVIDER-002 Request Body

正确映射：

- `model`
- `messages`
- `tools`
- `tool_choice`
- `stream`
- `stream_options.include_usage`
- `reasoning_effort`
- `max_tokens`
- `temperature`
- `top_p`

内部配置使用统一 camelCase，协议层转换 snake_case。

### FR-PROVIDER-003 Stream Parsing

支持：

- Text Delta。
- Reasoning Delta。
- Tool Call Delta。
- Finish Reason。
- Usage。
- Cached Tokens。
- Reasoning Tokens。
- Provider Error。

### FR-PROVIDER-004 Tool Call Continuation

- Assistant Tool Call 进入历史。
- Tool Result 正确回传。
- Reasoning Content 按 Provider 协议要求回传。
- 工具参数流式拼接完整。

### FR-PROVIDER-005 Contract Test

必须通过录制/Mock Server 验证最终 Wire Body 和 SSE，不允许只测试中间 ProviderOptions。

---

## 7.4 Agent 执行

### FR-AGENT-001 任务理解

每轮提取：

- 用户目标。
- 约束。
- 验收标准。
- 风险。
- 是否需要计划。

简单任务不强制过度规划。

### FR-AGENT-002 计划

复杂任务支持：

- Objective。
- Key Results。
- Steps。
- Dependencies。
- Acceptance Criteria。
- Status。

首发只要求计划可创建、更新和展示，不要求自动进化。

### FR-AGENT-003 Tool Loop

- 每轮可调用多个 Tool。
- Tool 并发策略可控。
- Tool 执行前完成安全检查。
- 结果持久化后才能进入下一轮。
- 重复相同 Tool Call 应有上限。

### FR-AGENT-004 完成输出

最终输出必须包含：

- 完成内容。
- 关键文件。
- 验证命令和结果。
- 未验证项。
- 风险和后续事项。

禁止在未运行测试时输出“测试通过”。

---

## 7.5 权限与工具安全

### FR-PERM-001 权限规则

动作：

- allow
- ask
- deny

优先级：最后匹配规则生效。无匹配默认 ask。

### FR-PERM-002 deny 强保证

- deny Tool 不暴露给模型，或执行时拒绝。
- Workflow/Gateway/DeepAgent 不能绕过。
- deny 不能进入 preapproved 列表。

### FR-PERM-003 once/always

- once 只批准当前请求。
- always 仅批准匹配 Pattern。
- Session 结束后默认不跨 Session 保存，除非用户显式配置。

### FR-PERM-004 路径边界

- 通过 `realpath + relative` 判断 Workspace 边界。
- 默认禁止 Workspace 外写入。
- Symlink 逃逸必须阻止。

### FR-PERM-005 Shell

Shell 不能依赖单一 filePath 做安全判断。

首发要求：

- 高风险命令默认 ask。
- cwd 固定在 Workspace。
- 注入 AbortSignal/Timeout。
- 限制环境变量暴露。
- 日志不打印 Secret。

---

## 7.6 Intent 与 Model Routing

### FR-ROUTE-001 Intent

首发只保留可解释的分类：

- simple
- medium
- refactor
- architecture
- research

`new/collaboration/spec-driven` 可保留内部兼容，但不作为首发核心承诺。

### FR-ROUTE-002 Model Decision

决策输出必须包含：

```ts
{
  providerId,
  modelId,
  tier,
  reason,
  risk,
  reasoningEffort
}
```

### FR-ROUTE-003 决策应用

- 决策发生在 Model Resolve 前。
- `model.decided` 与 `model.applied` 可对照。
- UI 显示真实 Model ID。
- 决策无法应用时明确降级原因。

### FR-ROUTE-004 Override

- 用户具体 Model 选择优先。
- Override 可清除。
- Override 有 Session 生命周期。
- 模型主动切换默认只作为建议，除非 Policy 允许。

### FR-ROUTE-005 失败升级

只有以下失败计入能力升级：

- 可重试的模型能力失败。
- 连续工具参数错误。
- 明确的低质量检查失败。

网络错误、Rate Limit 不应直接升级模型。

---

## 7.7 Reasoning 管理

### FR-REASON-001 Effort

- 根据模型真实支持集合选择。
- 不支持 `max` 的 Endpoint 不发送 `max`。
- 非 Reasoning 模型不发送该字段。

### FR-REASON-002 存储

- Reasoning 与 Text 分开存储。
- 用户可选择显示/隐藏。
- 不作为最终答案的一部分重复输出。

### FR-REASON-003 历史策略

目标策略：

- 当前 Tool Turn：完整保留。
- 下一轮：Provider 要求优先；允许时摘要。
- 历史轮：允许时剥离。

策略必须由协议兼容性约束，不能为了省 Token 破坏 Tool Call Continuation。

### FR-REASON-004 跨模型

- 不把私有 Provider Metadata 发送给其他 Provider。
- 可将必要 reasoning 摘要转成普通 Context，但必须标明历史摘要而非新指令。

---

## 7.8 Context 与 Cache

### FR-CONTEXT-001 Stable Baseline

- System Baseline 在 Context Epoch 内字节稳定。
- 不含时间戳、随机数或易变顺序。
- Dynamic 内容通过 Update/History 进入。

### FR-CONTEXT-002 Hard Constraints

- 提取显式“禁止/必须/只能”等约束。
- 用户可查看和删除误提取约束。
- 约束有来源消息。
- 约束在压缩后仍保留。

### FR-CONTEXT-003 Compaction

- Context Overflow 前主动压缩。
- Overflow 后最多恢复一次。
- Compaction Summary 明确标识为历史上下文，不是新指令。
- Tool Call/Result 不被截断成无效序列。

### FR-CONTEXT-004 Token Budget

- 使用模型真实 Context/Output Limit。
- 显示估算值与 Provider 实际 Usage 的差异。
- 不以未经验证的模型内部 sliding_window 参数作为硬编码产品承诺。

### FR-CONTEXT-005 Cache Metrics

如 Provider 返回：

- cache read tokens
- cache write tokens
- non-cached input

则持久化并展示。没有 Provider 证据时不宣称 Cache 命中收益。

---

## 7.9 Scope 与 Review

### FR-SCOPE-001 Scope 初始化

复杂任务 Plan 创建后：

- 推断预计修改文件。
- 展示给用户。
- 用户确认或按 Permission 自动批准。
- 空 Scope 不得被误解为“全部禁止”或“全部允许”。

### FR-SCOPE-002 Scope 检查

- edit/write/apply_patch 统一检查。
- Shell 通过 Sandbox/Policy 检查。
- 超范围操作返回原因和建议。

### FR-SCOPE-003 Required/Optional/Unrelated

- required：需说明与当前验收的必要关系。
- optional：必须用户批准。
- unrelated：记录，不执行。

### FR-REVIEW-001 Checkpoint

Checkpoint 可由以下条件触发：

- Plan Step 完成。
- 高风险文件修改。
- 连续失败。
- 用户/模型请求。

### FR-REVIEW-002 审查结果

输出：

- passed。
- violations。
- evidence。
- action。

Enforcement 违规必须阻止完成或要求修复；Advisory 只提示。

### FR-REVIEW-003 Skill 提议

首发只允许：

- 生成提议。
- 用户查看。
- 手动导出。

不允许自动激活或修改全局 Skill。

---

## 7.10 Role 与 Skill

### FR-ROLE-001 首发角色

只正式支持：

1. Build：通用编码执行。
2. Plan：复杂任务规划。
3. Review：代码审查和验证。

其他角色标记 Experimental。

### FR-ROLE-002 工具白名单

实际暴露 Tool 必须是：

```text
Registry
∩ Role Tools
∩ Loaded Skill Tools
∩ User Permission
∩ Runtime Capability
```

### FR-SKILL-001 Skill 加载

- 来源明确。
- 名称唯一。
- 工具注册冲突拒绝。
- 卸载清理工具。
- Skill 内容不得绕过 Permission。

---

## 7.11 Gateway（Experimental）

### FR-GW-001 默认关闭

- 未配置时不启动。
- 默认 localhost。
- UI/日志明确 Experimental。

### FR-GW-002 平台范围

v0.1 只允许一个经过端到端验证的平台进入 Experimental Release，建议飞书。

其他平台：

- Parser/Adapter 可保留源码。
- README 不宣称生产支持。
- 不默认注册。

### FR-GW-003 入站鉴权

每个平台必须：

- 验证签名/Token。
- 验证时间窗口。
- 防重放。
- 限制 Body Size。
- 记录拒绝原因但不泄露 Secret。

### FR-GW-004 会话路由

Key 至少包含：

- platform
- tenant
- bot
- user
- chat
- workspace

### FR-GW-005 正确回包

回复必须使用原消息 sourceAdapter，不依赖 Adapter 注册顺序。

### FR-GW-006 执行桥接

目标使用 OpenCode Server/SDK 长期连接，不为每条消息启动 CLI 子进程。

过渡期子进程方案必须：

- 严格 timeout。
- kill escalation。
- stdout/stderr 限制。
- 有界 Queue。
- 同 Session 保序、不同 Session 可并发。

### FR-GW-007 Workspace Allowlist

远程用户只能操作预配置 Workspace，不能通过消息指定任意系统目录。

---

## 8. 非功能需求

## 8.1 安全

### NFR-SEC-001 Secret

- 仓库和历史无有效 Secret。
- CI Secret Scan。
- 日志脱敏。
- 提供 `SECURITY.md`。

### NFR-SEC-002 默认安全

- Gateway 默认关闭。
- 写/Shell 默认 ask。
- Workspace 外写默认 deny。
- 插件和 Skill 不可绕过 Permission。

### NFR-SEC-003 供应链

- Lockfile 固定。
- 依赖漏洞扫描。
- Patch 列表有 Owner/原因/上游链接。
- Release 有 checksum。

## 8.2 可靠性

### NFR-REL-001 取消

Provider、Tool、Subprocess 在用户取消后有界时间内终止。

### NFR-REL-002 无界状态

Queue、History、Pending Skills 等必须有容量或持久化策略。

### NFR-REL-003 错误语义

错误区分：

- User Error
- Config Error
- Provider Error
- Permission Error
- Tool Error
- Internal Error

## 8.3 性能

### NFR-PERF-001 启动

不联网安装完成后，CLI 启动到可输入界面目标 < 3 秒（常规开发机）。

### NFR-PERF-002 运行时

- 不在主 Event Loop 执行大目录同步扫描。
- 文件读取有大小限制。
- Tool 输出有截断和外部存储。

### NFR-PERF-003 Context

- 组装复杂度不随全历史无限增长。
- 压缩前有阈值。
- Usage 可观测。

## 8.4 兼容性

首发支持：

- macOS arm64/x64。
- Linux x64/arm64。
- Windows 若上游构建已稳定，否则标记 Experimental。

Runtime 版本必须固定并在安装文档中说明。

## 8.5 可维护性

- 核心模块有 Owner。
- 单文件不持续堆积所有 Hook。
- 公共 API 有 Type Test。
- 新功能必须进入追踪矩阵。

## 8.6 可观察性

- 结构化日志。
- Session/Turn/Tool Correlation ID。
- Harness Decision Event。
- Provider Usage。
- 默认不上传 Telemetry，需用户选择。

## 8.7 隐私

- 本地代码不默认上传到除用户配置 Provider 之外的服务。
- Telemetry 不包含 Prompt、源码和 Secret。
- Gateway 日志不默认保存消息正文。

---

## 9. 配置需求

最小配置示例：

```jsonc
{
  "provider": {
    "deepseek": {
      "apiKeyEnv": "DEEPSEEK_API_KEY",
      "baseURL": "https://api.example.com/v1",
      "models": {
        "deepseek-model": {
          "context": 128000,
          "output": 8192,
          "reasoning": true
        }
      }
    }
  },
  "model": "deepseek/deepseek-model",
  "permission": {
    "read": "allow",
    "edit": "ask",
    "bash": "ask"
  },
  "gateway": {
    "enabled": false
  }
}
```

要求：

- Schema 验证。
- Unknown Key 提示。
- 配置错误包含路径。
- Secret 仅引用环境变量或安全存储。

---

## 10. UX 需求

### 10.1 每轮状态

用户应能看到：

- Agent/Role。
- Provider/Model ID。
- Model Tier。
- Reasoning Effort。
- Tool。
- Permission 状态。
- Token/Usage（可用时）。

### 10.2 权限请求

必须展示：

- Tool 名称。
- 目标文件/命令。
- 风险说明。
- once/always/reject。

### 10.3 错误信息

示例：

不合格：

```text
Provider failed
```

合格：

```text
DeepSeek request rejected: reasoning_effort=max is not supported by this endpoint.
Model: deepseek/example
Action: choose high or update the model capability configuration.
```

### 10.4 完成总结

模板：

```text
完成：...
变更：...
验证：命令 + 结果
未验证：...
风险：...
```

---

## 11. 数据与事件需求

### 11.1 Harness Decision

记录：

- 输入摘要。
- 决策。
- 原因。
- 是否 Enforcement。
- 是否实际应用。

### 11.2 Test Evidence

每个任务可记录：

- command
- exit code
- duration
- stdout summary
- stderr summary
- environment

### 11.3 敏感字段

以下禁止进入日志/Telemetry：

- API Key。
- Authorization Header。
- Platform Secret。
- 完整环境变量。
- 未经用户许可的源码正文。

---

## 12. README 主张规范

公开主张必须映射到 `07_REQUIREMENT_TRACEABILITY.md`。

允许：

- “支持 DeepSeek OpenAI-compatible API”，前提是 Contract Test 通过。
- “实验性飞书 Gateway”，前提是签名和 E2E 通过。

禁止：

- “唯一全栈适配”。
- “14 个模块保证不乱来”。
- “支持 11 平台”，如果未完成逐平台鉴权和 E2E。
- “自动切 Pro”，如果 Applied Rate 不为 100%。

---

## 13. 开源仓库需求

必须提供：

- README。
- LICENSE 与上游版权说明。
- CONTRIBUTING.md。
- SECURITY.md。
- CODE_OF_CONDUCT.md。
- CHANGELOG.md。
- Architecture/PRD/Test 文档。
- Issue/PR Template。
- 发布和升级说明。
- Upstream Sync 说明。

根 `repository` 字段必须指向 DeepCode 仓库。

---

## 14. 发布门槛

### 14.1 P0 必须为 0

- 未鉴权远程执行。
- Secret 泄露。
- deny 被绕过。
- 路径逃逸。
- Session 串话。
- Provider 协议破坏。
- 数据损坏。

### 14.2 自动化门禁

必须通过：

```text
lint
+ typecheck
+ unit tests
+ integration tests
+ provider contract tests
+ install smoke tests
+ security scan
+ build
```

### 14.3 E2E 场景

1. 干净环境安装。
2. DeepSeek 文本对话。
3. 读取仓库。
4. 修改文件并运行测试。
5. deny 写入。
6. 长会话压缩。
7. Tool Call continuation。
8. Model Routing applied。
9. Gateway 签名拒绝/接受（若发布）。

### 14.4 文档门禁

- README 每项主张有证据。
- 不把“已实现未验证”写成 Stable。
- 示例无真实凭据和个人路径。

---

## 15. 当前实现状态快照

| 能力 | 当前状态 | v0.1 要求 |
|---|---|---|
| OpenCode 基础 Runtime | 已实现未验证 | 回归测试通过 |
| DeepSeek OpenAI-compatible Chat | 部分实现 | Contract Test 通过 |
| Reasoning Stream Parsing | 已实现未验证 | E2E 通过 |
| reasoning effort 动态控制 | 部分实现/字段失配 | Wire Body 正确 |
| Flash/Pro Routing | 部分实现 | 决策真实应用 |
| Hard Constraint | 部分实现 | 压缩后仍生效 |
| Reasoning Lifecycle | 部分实现 | 接入 History Projection |
| Scope Guard | 部分实现且有绕过 | 统一 Tool Guard |
| Permission | 基础存在，Workflow 有缺陷 | deny 全链路正确 |
| 14 Harness Modules | 代码存在程度不一 | 只承诺验证过的模块 |
| oh-my-deepagent | Experimental | 不作为主 Runtime |
| 11 Platform Gateway | Experimental/不安全 | 默认关闭，最多验证 1 个 |
| 安装发布 | 未闭环 | 干净环境成功 |
| CI | 未闭环 | 单一质量门 |

---

## 16. 成功标准

v0.1 发布后 30 天内：

- 至少 20 个独立用户完成安装。
- 安装成功率 ≥ 80%。
- 至少 50 个真实代码任务。
- Verified Task Completion Rate ≥ 60%。
- Permission Bypass = 0。
- Secret Incident = 0。
- README Claim Evidence Coverage = 100%。
- P0 安全问题 = 0。

这些是验证产品是否可用的指标，不以 Star 数、角色数或平台数替代。