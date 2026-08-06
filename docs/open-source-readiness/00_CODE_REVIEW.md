# DeepCode Code Review 报告

> 审查基线：`master@ff79c93cc8c865349a74e6844d4881be99f5ce65`
> 文档分支：`develop`
> 审查日期：2026-07-27
> 状态：静态审查 + 当前工作区测试/线上发行链复核；Runtime 架构结论已勘误
> 勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 新增无效官网安装、OpenCode 共存和上游发布配置 P0；撤销无量表评分；调整 CLI Alpha 审计顺序 | 开源准备复核 |

## 1. 执行结论

DeepCode 当前处于研究型 Alpha / 集成验证阶段。核心问题包括无效公开安装、OpenCode 共存隔离、发布流水线、安全、Provider 协议、Routing Applied 和 Permission。Gateway 问题继续成立，但不再阻塞 CLI-first v0.1 Alpha，前提是其默认关闭且不进入 Alpha 暴露面。

此前报告将 `oh-my-deepagent` 中存在 AgentRuntime、Message Loop、ToolRunner、MemoryStore、Provider 和 Transport，描述为“第二套生产 Runtime”或“必然语义漂移”。该判断证据不足，现修正为：

> **存在一组可独立组合的 Runtime 实现，但其生产调用关系、插件职责和状态权威性尚未完成审计。**

## 2. 评分状态

此前 `4.5/10` 没有公开量表、权重和复现方法，现撤销。后续只使用逐项状态和 Go/No-Go 门禁，不使用不可复核的综合分数。

## 3. P0 Findings

### P0-01 Gateway 入站鉴权不完整

风险：未经授权的远程请求可能进入 Agent 执行链。

要求：逐 Adapter 完成签名/Token、Timestamp、Replay、Body Limit 和拒绝测试。

### P0-02 已暴露凭据

风险：飞书等凭据曾出现在 Git 历史或资料中。

要求：轮换、历史清理、Secret Scan 和事件记录。

### P0-03 reasoning_effort 映射错误

风险：中间配置与最终 Wire Body 不一致，`max` 等值可能不被 Endpoint 支持。

要求：内部 camelCase、协议 snake_case、Capability 校验和 Contract Test。

### P0-04 Model Routing 决策未可靠应用

风险：记录了 Model Decision，但 Concrete Model 已先解析或未实际切换。

要求：decide → resolve → request，并记录 decided/applied。

### P0-05 Gateway 回包 Adapter 错误

风险：回复依赖注册顺序而非原消息 sourceAdapter。

要求：消息和 Session 保存 sourceAdapter，并进行多 Adapter 测试。

### P0-06 CLI 子进程 Timeout 无效

风险：在进入 Timeout Race 前已经等待流读取结束。

要求：并发等待、Abort/Kill Escalation、输出和 Queue 边界。

### P0-07 Permission deny 可进入预批准

风险：Workflow 将非 `ask` 动作视为批准，`deny` 可能绕过。

要求：只有明确 `allow` 才能预批准；默认 ask；全入口回归。

### P0-08 发布测试链不完整

风险：无法证明当前 Commit 可安装、构建、测试和发布。

要求：统一根命令和 Required CI。

### P0-09 官网安装指向第三方 npm 包

风险：官网和根 README 的 `npm install -g deepcode` 当前不会安装本项目制品，用户可能执行无关第三方代码。

要求：在本项目 Release 通过安装 Smoke 前移除公开命令；Alpha 使用本项目 GitHub Release 和 SHA-256 校验。

### P0-10 OpenCode/Oh-my-OpenAgent 状态冲突

风险：DeepCode 复用 `opencode` 配置、数据、数据库、环境变量、插件发现和卸载目标，可能读取、修改或删除用户现有 OpenCode/Oh-my-OpenAgent 状态。

要求：实现 `deepcode` 独立命名空间，默认不读取 `.opencode`/`OPENCODE_*`，并通过共存安装、运行和卸载测试。

### P0-11 发布脚本仍指向上游 OpenCode

风险：wrapper、平台包、postinstall、GitHub Actions、Docker、AUR、Homebrew 和更新源名称不一致或仍指向 `anomalyco/opencode`，当前 Commit 无法形成可信 DeepCode Release。

要求：先建立最小 GitHub Release 流水线；npm、AUR、Homebrew 和 Desktop 分发在名称及所有权确认后逐步启用。

## 4. P1 Findings

### P1-01 Scope/Workspace Fail-open

- 空 Scope 语义不明确。
- Shell 可绕过 filePath 检查。
- 路径判断可能依赖不安全的字符串前缀。

### P1-02 Reasoning Lifecycle 未完整进入历史投影

需要确保 Tool Continuation、跨模型 Metadata 和压缩策略协议正确。

### P1-03 Role/Skill Tool Policy 未证明执行

Role/Skill 白名单存在定义，但生产 Tool 暴露和 Permission 交集缺少 E2E。

### P1-04 Gateway Session 与资源边界不足

包括 Session Key、TTL、容量、持久化、PII 日志、Matrix 批量消息和 Queue。

### P1-05 Enforcement 与 Advisory 混淆

部分 Harness 模块只记录建议，却被产品文案描述为强保证。

### P1-06 oh-my-deepagent Runtime 性质未知

已确认的代码事实：

- `AgentRuntime` 调用 `runMessageLoop`；
- Message Loop 可调用 LLM 和 Tool；
- 存在 ToolRunner、MemoryStore、Provider 和 Transport。

尚未确认：

- 生产入口调用方；
- 原始 oh-my-OpenAgent 插件契约；
- Host/Plugin 状态权威性；
- 生产、兼容、测试或过渡用途。

正确处理：v0.2 Agent 集成前生成调用图并分类，不预设删除。

## 5. P2 Findings

- 根测试命令和 Turbo 覆盖不完整。
- 核心路径存在同步 I/O 和无界状态风险。
- Fork 和依赖维护成本高。
- 文档中存在“模块存在即完成”的过度主张。

## 6. Host-Plugin 架构判断

正确架构方向：

```text
DeepCode/OpenCode Host
├── Session/Provider/Tool/Permission/Context/History
└── Plugin Contract
    └── oh-my-deepagent
        ├── Role/Skill
        ├── Plan/Delegation
        ├── Subagents
        └── Multi-Agent Orchestration
```

允许多个编排循环。需要防止的是安全绕过、状态权威冲突和不可测试的重复副作用。

## 7. 下一步审计顺序

1. 公开安装信息止损。
2. 发行身份和 OpenCode/Oh-my-OpenAgent 共存隔离。
3. Provider/Permission 最小任务链。
4. 默认分支、Required CI 和 GitHub Release。
5. Parallels macOS 共存验收和官网 Alpha。
6. v0.2 前再完成原始插件契约、生产调用图、State Authority、Tool/Permission 和迁移分类。
7. v0.3 前完成 Gateway 调用图和安全整改。

## 8. 发布判断

当前：**NO-GO**。

原因是官网安装、发行身份、OpenCode 共存、发布流水线、Provider Contract、Routing、Permission 和测试闭环未完成，而不是“插件中存在第二个 Loop”本身。Gateway 若不进入 v0.1 Alpha 默认制品，可作为后续版本 P0 独立处理。
