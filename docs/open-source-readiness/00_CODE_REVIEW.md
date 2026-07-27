# DeepCode Code Review 报告

> 审查基线：`master@ff79c93cc8c865349a74e6844d4881be99f5ce65`
> 文档分支：`develop`
> 审查日期：2026-07-27
> 审查方式：Commit 记录、已有审计文档、关键主链路源码、测试配置和安全边界静态核查

## 1. 执行结论

DeepCode 当前属于 **研究型 Alpha / 集成验证版**，不具备生产发布或可信开源条件。

综合判断：

| 维度 | 评分 | 结论 |
|---|---:|---|
| 产品方向 | 8/10 | DeepSeek-native Harness 方向成立 |
| 架构基础 | 7/10 | OpenCode 底座、Effect 分层和 LLM Protocol 较强 |
| 核心差异化有效性 | 4/10 | 多项能力仅注册、记录或旁路运行 |
| 运行正确性 | 4/10 | 存在 Provider 字段失配、路由不生效等问题 |
| 安全性 | 2/10 | Gateway 可形成未经鉴权的远程 Agent 入口 |
| 测试工程 | 4/10 | 局部测试存在，统一质量门缺失 |
| 开源准备度 | 3/10 | 安装、发布、安全、文档真实性均未闭环 |

核心判断：

> 当前主要问题不是功能不够，而是“产品主张、模块代码、主执行路径、测试证据”没有形成闭环。

## 2. Commit 演进判断

最近 Commit 呈现四条主要演进线：

1. **上游源码全量纳入**：`099f38e` 将完整 OpenCode 源码纳入仓库，为二次开发奠定基础。
2. **DeepSeek V4 产品包装**：`631ae12` 重写 README，形成 V4 全栈适配、14 个 Harness 模块、消息网关三大卖点。
3. **Gateway 扩展**：`64b851c`、`ed78bbc`、`a2e5025`、`6ac0a6c` 将平台数量扩展至 11 个并补充测试/Fixture。
4. **DeepAgent 扩展**：`70f6bc7`、`53abf2f`、`8676d36`、`d120512` 增加 oh-my-deepagent 包和 13 个角色。
5. **整合与清理**：`5063bdc` 完成第 35 期整合，`7c5f705` 清理不兼容测试，`ff79c93` 清理陈旧配置。
6. **安全补救**：`edaa0bd`、`d557c03` 对文档中的飞书凭据和本地路径进行脱敏。

这组 Commit 说明项目在短时间内快速扩大了功能面，但缺少同等强度的主链路验证和发布收敛。特别是：

- 平台数量从 2 个快速扩展至 11 个。
- Agent 角色快速扩展至 13 个。
- 14 个 Harness 模块同时进入主服务注册。
- README 同步将这些能力描述为已深度集成。

因此技术债的本质是 **集成速度超过验证速度**。

## 3. P0 问题

### P0-1：Gateway 入站鉴权没有形成统一安全门

Telegram、Slack、Matrix 等 Adapter 的文件注释要求校验 Secret Token、签名或 Bearer Token，但通用 Server/Router 路径没有强制执行统一验证。Adapter 未实现 `handleWebhook` 时，请求可直接进入 Router。

风险链路：

```text
公网伪造请求
→ /webhook/{platform}
→ Router.parse
→ 全局 Queue
→ SessionBridge
→ 本地 Agent/Tool 执行
```

这是远程 Agent 执行入口风险，不是普通消息伪造风险。

要求：

- 入站验证必须成为 `PlatformAdapter` 的必选能力。
- 未配置密钥或校验失败时默认拒绝。
- 增加 timestamp、nonce、重放保护、Body Size、Rate Limit 和幂等。
- Gateway 默认绑定 localhost。

### P0-2：飞书凭据已进入 Git 历史

现有安全 Commit 明确指出飞书 `appId/appSecret` 曾在历史 Commit 中暴露。当前文件脱敏不能撤销历史泄露。

要求：

- 立即轮换凭据。
- 审查访问日志。
- 使用历史重写工具清理敏感信息。
- CI 增加 Secret Scan。

### P0-3：V2 主链路中的 reasoning effort 字段失配

`SessionRunner` 写入：

```ts
providerOptions.openai.reasoning_effort
```

`OpenAIOptions` 读取：

```ts
providerOptions.openai.reasoningEffort
```

最终协议 lowering 才将 `reasoningEffort` 转成 wire field `reasoning_effort`。当前写法会被静默忽略。

同时，ReasoningManager 可返回 `max`，但 OpenAI Chat 的校验集合排除了 `max`，存在协议兼容冲突。

结论：README 声称的 reasoning_effort 动态控制没有端到端证据，当前代码存在明确失效路径。

### P0-4：Flash/Pro 路由没有改变当前模型

当前执行顺序是：

```text
models.resolve(session)
→ intent.classify
→ modelRouter.decide
→ 记录 tier
→ 使用已解析 model 发起请求
```

因此路由结果只记录，不改变当前轮模型。`setOverride()` 也没有被 Model Resolver 消费。

结论：

- “架构任务自动切 Pro”未生效。
- “失败自动升级 Pro”未形成闭环。
- “模型主动请求切换”只更新旁路状态。

### P0-5：多平台消息可能通过错误 Adapter 回包

Gateway 使用统一 Queue，但 Consumer 固定取 `adapters.values().next().value` 作为回复 Adapter。消息虽包含 platform/source 信息，消费链没有据此选择发送端。

后果：

- Telegram 消息可能通过飞书 Adapter 回包。
- 多平台并行时结果不可预测。
- Adapter 注册顺序成为隐式业务逻辑。

### P0-6：CLI 子进程超时逻辑不能可靠触发

当前先等待 stdout/stderr Stream 完整结束，之后才与 timeout 竞争。如果子进程不退出，Stream 不关闭，代码永远到不了 timeout。

同时：

- 消息消费为串行。
- Queue 为无界。
- 单个挂死任务会阻塞全部后续消息。

### P0-7：Workflow 工具预批准逻辑错误

当前预批准条件：

```ts
!match || match.action !== "ask"
```

该逻辑会把 `deny` 视为预批准。正确逻辑只能是：

```ts
match?.action === "allow"
```

没有匹配规则时应进入 ask，而不是自动批准。

## 4. P1 问题

### P1-1：Scope Guard 既误拦截，又可被 Bash 绕过

Scope 初始 allowedFiles 为空，未发现稳定的 `setInitialScope()` 主链路调用。

实际表现：

- write/edit/apply_patch 有路径时可能全部拒绝。
- bash 通常没有单一 filePath，可跳过检查。
- Guard 异常时 Runner 允许执行，属于 fail-open。

安全控制应进入统一 Tool Executor，不能依赖 Session Runner 中的工具名和参数猜测。

### P1-2：路径逃逸判断不可靠

使用 `fullPath.startsWith(location.directory)` 判断目录边界，会把同前缀目录误认为子目录，也没有处理 symlink。

应采用 `realpath + path.relative` 判断。

### P1-3：Reasoning 三阶段生命周期未接入消息投影

ReasoningManager 定义 full/summary/stripped，但 `toLLMMessages()` 未调用该服务：

- 同模型保留完整 reasoning。
- 跨模型把 reasoning 转成普通文本。
- 没有 N+1 摘要与 N+2 剥离。

### P1-4：Role 工具和 Skill 权限未执行

`RoleDefinition.tools` 和 `RoleDefinition.skills` 存在，但 Message Loop 每轮暴露 `registry.descriptors()` 全量工具。SkillManager 被保存但未进入 Prompt、Tool 或生命周期。

### P1-5：Session Key 维度不足

Gateway Session Map 仅以 chatId 为 Key，缺少：

- platform
- tenant/workspace
- user
- bot/app
- repository/workdir

不同平台或租户可能发生会话串扰。Map 也没有 TTL、持久化或容量限制。

### P1-6：Matrix Transaction 丢弃多余消息

Matrix Parser 可返回消息数组，Router 只取第一条，其余消息丢失。

### P1-7：Enforcement 与 Advisory 混杂

多个 Harness 模块出错时统一吞错或默认通过：

- Scope 检查失败时允许。
- Immune Review 失败时返回 passed。
- AntiDrift、Memory、OKR 失败时忽略。

建议明确两类：

| 类型 | 例子 | 失败策略 |
|---|---|---|
| Enforcement | 权限、路径、安全、用户硬约束 | Fail-closed |
| Advisory | 成本路由、审查建议、记忆衰减 | 可降级，但必须可观察 |

## 5. P2 问题

### P2-1：README 安装说明与 Package 发布配置冲突

README 使用 `npm install -g deepcode`，但根包和 CLI 包均为 `private: true`。仓库 repository 字段仍指向上游 OpenCode。

### P2-2：缺少统一测试入口

根 `test` 脚本主动失败，Turbo 只覆盖部分包。Gateway 只有 typecheck 脚本，未形成仓库级质量门。

### P2-3：同步 IO 阻塞运行时

Session Runner 使用 `readFileSync`、`readdirSync`、`Bun.spawnSync`，并可能把完整文件内容注入上下文，缺少文件大小、总 Token、超时和二进制过滤。

### P2-4：运行时状态普遍无界

以下结构缺少容量和生命周期：

- Gateway Queue
- Session Map
- Router History
- Pending Skills
- Scope Violations
- Deferred Findings

### P2-5：依赖和 Patch 维护成本高

项目依赖 Effect Beta、Drizzle RC、TypeScript Native Preview，并维护大量第三方 Patch。上游同步风险高，需要独立的 Patch Ownership 和 Upstream Sync 流程。

## 6. 做得好的部分

1. 选择 OpenCode 作为底座，避免重新实现 Session、Tool、Provider 和 UI。
2. `@opencode-ai/llm` 的 Request、Route、Protocol、Transport 分层清晰。
3. DeepCode Harness 模块边界清楚，Effect Service/Layer 风格一致。
4. Provider Stream、Tool Settlement、Session Event、Compaction 基础较强。
5. 已有审计文档能够承认此前众测产物和文档的真实性问题。
6. Commit 大体遵循 feat/fix/docs/test/chore 语义，演进轨迹可追踪。

## 7. 开源阻断项

满足以下条件前，不建议发布公开版本：

- [ ] 全部已泄露凭据完成轮换。
- [ ] Gateway 默认不提供未经鉴权的公网入口。
- [ ] reasoning effort 有 wire-level contract test。
- [ ] Flash/Pro 路由真实改变模型。
- [ ] 多平台回包按 sourceAdapter 正确路由。
- [ ] 子进程超时、取消和并发控制可重复验证。
- [ ] 权限 deny 不可能被预批准。
- [ ] 至少一个统一 CI 入口覆盖核心包。
- [ ] README 主张全部进入追踪矩阵。
- [ ] 安装流程在全新环境完成 Smoke Test。

## 8. 审查限制

本轮无法在执行环境中 clone 仓库：环境无法解析 `github.com`，且未安装 `gh`。GitHub 最新 Commit 也没有关联的 Status 或 Workflow Run。因此：

- 本报告的源码结论为静态证据结论。
- 不将旧审计中的历史测试结果冒充为当前 Commit 测试结果。
- 当前 Commit 的实际构建、测试、安装和真实 DeepSeek API 调用均需在有网络和密钥的受控 Runner 中补跑。

详细测试状态见 `05_FUNCTIONAL_TEST_REPORT.md`。