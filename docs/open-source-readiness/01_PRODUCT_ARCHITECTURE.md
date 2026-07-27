# DeepCode 产品架构

> 版本：2.0
> 状态：开源准备基线
> 核心原则：少加功能，以真实可用、可信可验证为优先级

## 1. 产品定义

DeepCode 是一款针对 DeepSeek 模型特性优化的本地优先 Coding Agent。

产品公式：

```text
DeepSeek Model
+ OpenCode Runtime
+ DeepCode Harness
= DeepSeek-native Coding Agent
```

它不是：

- 一个单纯换品牌的 OpenCode Fork。
- 一个拥有大量角色名称但缺少执行差异的 Agent 集合。
- 一个同时追求 11 个消息平台生产可用的集成项目。
- 一个只用 Prompt 宣称“适配 DeepSeek”的通用客户端。

它必须证明：

1. DeepSeek 模型请求在协议层正确。
2. Harness 决策真实改变模型、上下文、工具或审查行为。
3. 用户可以从 CLI/TUI 完成真实代码任务。
4. 过程可追踪，结果可验证，安全边界可解释。

## 2. 目标用户

### 2.1 首要用户：DeepSeek 重度开发者

特征：

- 已使用 DeepSeek API 或 OpenAI-compatible Endpoint。
- 在中大型代码库中进行 Debug、改造、研究和文档任务。
- 关注 Token 成本、长上下文、缓存命中和推理质量。
- 能接受本地 CLI/TUI 配置。

核心 Job：

> 在不牺牲可控性和工程质量的前提下，用 DeepSeek 完成长流程代码任务，并理解它为什么选择某个模型、上下文和工具。

### 2.2 次要用户：Agent/Harness 研究者和开源贡献者

核心 Job：

> 研究、验证和扩展 Model + Harness 的工程机制，而不是从混乱代码中猜测哪些模块真的生效。

### 2.3 非首发用户

首个开源版本暂不面向：

- 完全不使用终端的普通办公用户。
- 需要企业多租户、审计平台和组织权限的客户。
- 需要 11 个消息平台 SLA 的运营团队。
- 需要云端托管和计费的一站式客户。

## 3. 核心问题

### P1：通用 Coding Agent 没有利用 DeepSeek 的独特行为

常见问题：

- reasoning content 传输或回放不正确。
- 模型档位、推理深度和上下文管理没有联动。
- 长会话中重要约束逐渐失效。
- Prefix Cache 的稳定性没有工程化保障。

### P2：Agent 可执行，但不可控

常见问题：

- 超出用户范围修改。
- 工具权限边界不清晰。
- 失败后重复调用或无限循环。
- 文档宣称与实际行为不一致。

### P3：研究原型无法可信开源

常见问题：

- 没有可复现安装方式。
- 没有统一测试入口。
- 核心卖点没有端到端测试。
- 安全和凭据管理不合格。

## 4. 产品价值主张

### 4.1 DeepSeek-native Protocol

确保以下行为正确：

- OpenAI-compatible Chat 请求格式。
- reasoning content 流式解析、持久化和历史回放。
- Tool Call 与 Tool Result 的协议连续性。
- Token Usage、Cached Tokens 和 Reasoning Tokens 统计。

### 4.2 Observable Harness

Harness 不只是隐藏逻辑，必须可观察：

- 当前意图分类结果。
- 当前模型与档位。
- reasoning effort。
- 路由原因。
- 约束和 Scope。
- 工具权限决策。
- 审查结果。

### 4.3 Safe Local Agent

- 默认本地运行。
- 默认最小权限。
- 写入和 Shell 可被用户确认。
- 外部消息入口默认关闭。
- 远程入口必须显式启用并通过鉴权。

### 4.4 Evidence-first Delivery

Agent 的完成标准不是“输出了一段文字”，而是：

```text
任务理解
→ 计划/直接执行
→ 工具操作
→ 运行或静态验证
→ 结果与证据
→ 未完成项和风险
```

## 5. 产品能力地图

```text
DeepCode
├── A. 用户交互层
│   ├── CLI
│   ├── TUI
│   ├── Desktop/Web（继承 OpenCode，非首发差异化）
│   └── Message Gateway（实验性、默认关闭）
│
├── B. Coding Agent Runtime
│   ├── Session
│   ├── Model Selection
│   ├── Context Assembly
│   ├── Tool Loop
│   ├── Permission
│   ├── Compaction
│   └── Result/Usage Persistence
│
├── C. DeepSeek-native 能力
│   ├── OpenAI-compatible Protocol
│   ├── Reasoning Content
│   ├── Reasoning Effort
│   ├── Cache Key / Prefix Stability
│   └── Usage & Cache Metrics
│
├── D. Harness Control Plane
│   ├── Intent Classification
│   ├── Model Routing
│   ├── Hard Constraints
│   ├── Scope Guard
│   ├── Context Window Policy
│   ├── Reasoning Lifecycle
│   ├── Review / Anti-drift
│   └── Meta-directives
│
├── E. Extensibility
│   ├── Tools
│   ├── Skills
│   ├── Roles
│   ├── MCP
│   └── Plugins
│
└── F. Open-source Operations
    ├── Install / Upgrade
    ├── Config / Secrets
    ├── Test / CI
    ├── Security Policy
    ├── Contribution Guide
    └── Release / Changelog
```

## 6. 首发产品范围

### 6.1 Must Have

| 能力 | 用户价值 | 首发要求 |
|---|---|---|
| CLI/TUI 启动 | 可实际使用 | 全新环境可安装启动 |
| DeepSeek Provider | 可连接模型 | API Key、Base URL、Model 可配置 |
| 多轮 Session | 连续任务 | 同一 Session 历史可靠回放 |
| Tool Call | 执行代码任务 | read/search/edit/bash 等基本工具可用 |
| 权限确认 | 安全可控 | deny/ask/allow 正确执行 |
| Reasoning Content | DeepSeek 原生能力 | 流式、持久化、回传正确 |
| Model Routing | 成本/质量平衡 | 路由结果真实改变模型 |
| Hard Constraints | 防止偏离 | 约束可见、可审查、可测试 |
| Evidence Output | 可信完成 | 给出变更、测试和未完成项 |
| 统一测试入口 | 可维护 | 单命令执行核心质量门 |

### 6.2 Should Have

- Reasoning 三阶段生命周期。
- Prefix Cache 稳定性指标。
- Scope Guard 对 edit/write 的可靠控制。
- 路由和 Token 指标展示。
- 至少 3 个经过验证的角色，而不是 13 个同时承诺。

### 6.3 Could Have

- 飞书单平台实验性 Gateway。
- Skill 提议但不自动激活。
- Review Anti-drift 可视化。
- Context Budget Debug View。

### 6.4 Won't Have in v0.1

- 11 平台生产支持。
- 自动 Skill 自进化。
- 多节点分布式 Session。
- 企业多租户控制台。
- 云托管和计费。
- 无监督自动修改生产仓库。

## 7. 核心用户流程

### 7.1 首次启动

```text
安装 DeepCode
→ 检查 Bun/Node/平台依赖
→ 配置 DEEPSEEK_API_KEY / Base URL
→ 选择模型
→ 运行连接测试
→ 进入当前仓库 Session
```

成功标准：

- 错误信息可行动。
- 不要求用户理解 OpenCode 内部 Provider 数据结构。
- 不在日志中泄露 API Key。

### 7.2 简单修改任务

```text
用户提出任务
→ 识别为 simple/medium
→ 选择默认模型
→ 读取相关文件
→ 生成最小修改
→ 请求写权限（按配置）
→ 修改
→ 运行最相关测试
→ 返回证据
```

### 7.3 复杂重构任务

```text
用户提出重构
→ 识别为 refactor/architecture
→ 生成可审查计划
→ 路由到强模型/高 reasoning
→ 初始化修改 Scope
→ 分步执行
→ 每个 checkpoint 验证约束与测试
→ 最终总结和未解决风险
```

### 7.4 多轮长任务

```text
Session 持续增长
→ 追踪 Token/窗口
→ 保持稳定 Prefix
→ 压缩历史
→ 保留关键约束和决策
→ 管理 reasoning content
→ 确保 Tool Call 历史协议完整
```

### 7.5 外部消息入口（实验）

```text
平台签名验证
→ 解析消息
→ 平台/租户/用户/会话映射
→ 限流与幂等
→ 进入 Agent Session
→ 按原平台回包
```

任一安全步骤未配置时，入口必须拒绝启动或拒绝请求。

## 8. 产品对象模型

### 8.1 Workspace

- repository/workdir
- project metadata
- config
- permissions
- available providers/models

### 8.2 Session

- session ID
- workspace
- selected agent/role
- selected model/variant
- user/assistant/tool history
- context epoch
- constraints
- scope
- route decisions
- usage/cost/cache metrics

### 8.3 Task

- original goal
- intent
- risk level
- plan
- acceptance criteria
- status
- evidence
- unresolved findings

### 8.4 Tool Invocation

- tool name
- input
- authorization decision
- start/end time
- result/error
- output paths
- provider executed flag

### 8.5 Harness Decision

统一数据结构：

```ts
interface HarnessDecision {
  id: string
  sessionId: string
  turn: number
  category: "intent" | "model" | "reasoning" | "scope" | "review" | "memory"
  inputSummary: string
  decision: unknown
  reason: string
  enforcement: "required" | "advisory"
  timestamp: number
}
```

## 9. 产品状态与透明度

产品界面和日志必须明确展示：

- 当前使用的真实模型 ID，不只显示 Flash/Pro 标签。
- 当前 reasoning effort。
- 工具是否需要确认。
- 当前 Scope 是否已初始化。
- 当前功能是否实验性。
- Gateway 是否公开监听。
- 测试是否实际执行。

禁止使用以下模糊表达：

- “已深度集成”但没有主链路和测试证据。
- “支持 11 平台”但只有 parser 或 adapter skeleton。
- “自动切 Pro”但只记录决策。
- “测试通过”但仅 typecheck 通过。

## 10. 产品指标

### 10.1 首发北极星指标

> 在真实代码任务中，DeepCode 使用 DeepSeek 完成任务并通过项目验证的比例。

定义：

```text
Verified Task Completion Rate
= 有明确验收标准且验证通过的任务数
/ 已开始执行的任务数
```

### 10.2 核心指标

| 指标 | 目的 |
|---|---|
| Task Completion Rate | 是否完成用户任务 |
| Verification Pass Rate | 是否有真实验证 |
| Permission Bypass Count | 安全边界是否可靠 |
| Model Route Accuracy | 路由是否匹配任务 |
| Route Applied Rate | 决策是否真实生效 |
| Cache Read Ratio | 缓存是否产生收益 |
| Context Overflow Rate | 长上下文是否稳定 |
| Tool Retry Loop Rate | 是否陷入循环 |
| Install Success Rate | 开源是否可使用 |
| First Useful Result Time | 用户多久获得价值 |

### 10.3 约束指标

- 任何 Secret 泄露：0。
- 未鉴权 Gateway 执行：0。
- deny 权限被执行：0。
- 文档主张无追踪证据：0。

## 11. 产品治理

每项功能进入 Stable 前必须通过：

1. PRD 中有用户价值和验收标准。
2. 技术架构中有主链路位置。
3. 代码中有实际生效点。
4. 测试中有自动化用例。
5. 运行中有可观察证据。
6. README 中的措辞与成熟度一致。

成熟度：

| 等级 | 定义 |
|---|---|
| Experimental | API/行为可能变化，不默认启用 |
| Beta | 主链路完成，有自动化测试，仍可能有兼容问题 |
| Stable | 有真实用户验证、兼容策略和发布承诺 |

首个开源版本中：CLI/TUI 核心为 Beta；Gateway 和自动进化类能力为 Experimental。