# DeepCode Code Review 报告

> 审查基线：`master@ff79c93cc8c865349a74e6844d4881be99f5ce65`
> 文档分支：`develop`
> 审查日期：2026-07-27
> 状态：静态审查；Runtime 架构结论已勘误
> 勘误：[14_PHASE0_ERRATA_AGENT_RUNTIME.md](./14_PHASE0_ERRATA_AGENT_RUNTIME.md)

## 1. 执行结论

DeepCode 当前处于研究型 Alpha / 集成验证阶段。核心问题仍包括安全、Provider 协议、Routing Applied、Permission、Gateway 和测试发布闭环。

此前报告将 `oh-my-deepagent` 中存在 AgentRuntime、Message Loop、ToolRunner、MemoryStore、Provider 和 Transport，描述为“第二套生产 Runtime”或“必然语义漂移”。该判断证据不足，现修正为：

> **存在一组可独立组合的 Runtime 实现，但其生产调用关系、插件职责和状态权威性尚未完成审计。**

## 2. 评分

当前静态评分：**4.5/10**。

该分数不因 Runtime 勘误而自动提高，因为 P0/P1 安全、协议和测试问题仍然存在。

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

正确处理：Phase 1 生成调用图并分类，不预设删除。

## 5. P2 Findings

- README 安装主张与 Package 状态可能不一致。
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

1. 原始 OpenCode/oh-my-OpenAgent 插件契约。
2. 当前 CLI/TUI/Gateway 生产调用图。
3. AgentRuntime/runMessageLoop/ToolRunner/MemoryStore/Provider/Transport 调用方。
4. State Authority Matrix。
5. Tool/Permission Path Matrix。
6. Keep/Adapt/Bridge/Replace/Remove 决策。
7. 再进入代码整改。

## 8. 发布判断

当前：**NO-GO**。

原因仍是 P0 安全、Provider Contract、Routing、Permission、Gateway 和测试发布闭环，而不是“插件中存在第二个 Loop”本身。
