# DeepCode 测试计划与完整用例

> 版本：1.0
> 目标版本：Open-source v0.1
> 原则：验证真实行为，不以模块存在、类型通过或日志输出替代功能验证

## 1. 测试目标

1. 证明 DeepSeek Protocol 请求和响应正确。
2. 证明 Harness 决策真实改变执行路径。
3. 证明权限、安全和 Workspace 边界不可绕过。
4. 证明 Session、Tool、Compaction 在长流程中保持一致。
5. 证明开源用户可安装、配置、运行和贡献。
6. 限定 Gateway 和 Experimental 功能的真实成熟度。

## 2. 测试分层

| 层级 | 目标 | 运行频率 |
|---|---|---|
| Static | Lint、Typecheck、Secret、License | 每次提交 |
| Unit | 纯函数、Schema、状态机、Parser | 每次提交 |
| Integration | Service/Layer、Session、Tool、DB | 每次 PR |
| Contract | DeepSeek Wire Body、SSE、Usage | 每次 PR |
| E2E | 安装、仓库任务、Gateway | 每次 Release |
| Security | 鉴权、权限、路径、重放、Secret | 每次 PR/Release |
| Performance | 启动、长会话、Queue、内存 | 每次 Release |
| Compatibility | OS/Runtime/Provider | 每次 Release Candidate |

## 3. 质量门

建议统一命令：

```bash
bun run check
```

等价于：

```bash
bun run lint
bun run typecheck
bun run test:unit
bun run test:integration
bun run test:contract
bun run test:security
bun run build
```

Release 增加：

```bash
bun run test:e2e
bun run test:install
bun run test:performance
```

失败策略：任一 P0/P1 Case 失败，禁止 Release。

## 4. 测试环境矩阵

### 4.1 OS

| OS | 架构 | 优先级 |
|---|---|---|
| Ubuntu 24.04 | x64 | P0 |
| macOS latest | arm64 | P0 |
| macOS latest | x64 | P1 |
| Windows 11 | x64 | P1/Experimental |

### 4.2 Runtime

- Bun：锁定仓库 `packageManager` 版本。
- Node：仅用于明确依赖场景。
- Git：当前稳定版本与一个最低支持版本。

### 4.3 Provider

1. Mock OpenAI-compatible Server。
2. Recorded DeepSeek-compatible Fixtures。
3. 真实 DeepSeek 测试账号（Release 前人工执行）。
4. 非 Reasoning OpenAI-compatible Mock。

### 4.4 Repository Fixtures

- Empty repository。
- Small TypeScript repository。
- Monorepo。
- Dirty working tree。
- Symlink fixture。
- Large file/binary fixture。
- Failing test fixture。
- Tool Call multi-turn fixture。

## 5. 测试数据规则

- 不使用真实 API Key 写入 Fixture。
- Secret 使用 `test_secret_xxx`。
- 所有时间、随机 ID 可注入。
- Provider Fixture 记录前脱敏。
- Gateway Fixture 使用固定签名测试向量。

---

# 6. 测试用例

## A. 安装与发布

| ID | 优先级 | 场景 | 步骤/输入 | 预期 |
|---|---|---|---|---|
| INS-001 | P0 | npm/bun 安装 | 干净 Ubuntu 安装正式包 | 退出码 0，生成 `deepcode` 命令 |
| INS-002 | P0 | 版本输出 | `deepcode --version` | 与 Package/Release 版本一致 |
| INS-003 | P0 | 帮助输出 | `deepcode --help` | 无异常，核心命令可见 |
| INS-004 | P0 | 首次启动缺少 Key | 清空 Provider 配置启动 | 提示可行动配置方式，不打印堆栈 |
| INS-005 | P0 | Doctor | `deepcode doctor` | Runtime/Git/Config/Provider 检查完整 |
| INS-006 | P1 | 重复安装 | 同版本重复安装 | 不破坏配置和缓存 |
| INS-007 | P1 | 升级 | 旧版升级至当前版 | 配置兼容或给出迁移提示 |
| INS-008 | P1 | 卸载 | 卸载 Package | 命令移除，不删除用户项目 |
| INS-009 | P0 | Package 元数据 | `npm pack --dry-run` | 无私密文件，repository/LICENSE 正确 |
| INS-010 | P0 | Release 内容 | 检查归档/二进制 | 包含 LICENSE、NOTICE、checksum |
| INS-011 | P1 | macOS arm64 | 安装运行 | 成功 |
| INS-012 | P1 | 无 Git 仓库 | 普通目录启动 | 可运行或明确提示，不崩溃 |

## B. 配置与 Secret

| ID | 优先级 | 场景 | 输入 | 预期 |
|---|---|---|---|---|
| CFG-001 | P0 | 环境变量 Key | `DEEPSEEK_API_KEY=test` | 正确读取，日志脱敏 |
| CFG-002 | P0 | Key 缺失 | 配置引用不存在变量 | 启动前失败，指出变量名 |
| CFG-003 | P0 | 配置优先级 | CLI/Workspace/User/Env 同时配置 | 按文档优先级解析 |
| CFG-004 | P1 | Unknown Key | 拼错 `reasoningEffrot` | Schema 报具体路径 |
| CFG-005 | P0 | 非法 Base URL | 无协议或非法 URL | 配置阶段拒绝 |
| CFG-006 | P0 | Secret 日志 | 触发 Provider 错误 | stdout/stderr 无完整 Key |
| CFG-007 | P0 | Secret Telemetry | 开启本地 Trace | Span 无 Authorization/API Key |
| CFG-008 | P1 | Workspace 配置隔离 | 两仓库不同模型 | 不互相污染 |
| CFG-009 | P1 | 配置迁移 | 旧 OpenCode Config | 可兼容或明确迁移 |
| CFG-010 | P0 | Gateway 默认值 | 未配置 Gateway | 不监听端口 |
| CFG-011 | P0 | Gateway 公网绑定 | 配置 `0.0.0.0` 无鉴权 | 拒绝启动 |
| CFG-012 | P1 | Config 示例 | 复制文档示例 | Schema 通过 |

## C. Provider 与 Protocol Contract

| ID | 优先级 | 场景 | 输入 | 预期 |
|---|---|---|---|---|
| PRO-001 | P0 | 基本文本请求 | 单条 User Message | Wire Body 结构正确 |
| PRO-002 | P0 | Model ID | 配置具体模型 | `body.model` 完全一致 |
| PRO-003 | P0 | reasoning effort low | 内部 `reasoningEffort=low` | Wire 为 `reasoning_effort: low` |
| PRO-004 | P0 | reasoning effort high | high | Wire 正确 |
| PRO-005 | P0 | reasoning effort max | Endpoint 支持 max | Wire 正确 |
| PRO-006 | P0 | max 不支持 | Capability 不含 max | 自动降级或配置错误，不发送非法值 |
| PRO-007 | P0 | snake/camel 保护 | 输入错误 snake_case 内部字段 | Contract Test 应失败，防静默忽略 |
| PRO-008 | P0 | Text Delta | SSE 多段 content | 合并顺序正确 |
| PRO-009 | P0 | Reasoning Delta | SSE reasoning_content | 产生 reasoning start/delta/end |
| PRO-010 | P0 | Tool Call Delta | arguments 分多 chunk | 拼接为合法 JSON |
| PRO-011 | P0 | 多 Tool Call | 两个 index 交错 | ID、Name、Args 不串 |
| PRO-012 | P0 | Tool Result 回传 | Assistant Call + Tool Result | Message 序列符合协议 |
| PRO-013 | P0 | Reasoning 回传 | Tool Turn 含 Reasoning | Provider 要求字段完整 |
| PRO-014 | P1 | Usage | prompt/completion/total | 映射正确 |
| PRO-015 | P1 | Cached Tokens | cached subset | nonCached 与 cacheRead 正确 |
| PRO-016 | P1 | Reasoning Tokens | completion details | reasoningTokens 正确 |
| PRO-017 | P0 | Provider Error | 4xx JSON/SSE error | 归一化错误，Session 可见 |
| PRO-018 | P0 | Context Overflow | 模拟 overflow | 触发一次 Compaction Recovery |
| PRO-019 | P0 | 二次 Overflow | 压缩后仍 overflow | 明确失败，不无限递归 |
| PRO-020 | P1 | Empty Choice | SSE choices=[] | 不崩溃，正确处理 Usage |
| PRO-021 | P1 | Invalid SSE JSON | 损坏 chunk | 可诊断错误 |
| PRO-022 | P0 | Abort Stream | 用户取消 | HTTP/Stream 有界时间中止 |
| PRO-023 | P1 | Media Unsupported | 模型不支持图片 | 转成明确错误消息 |
| PRO-024 | P1 | Tool Schema | 复杂 JSON Schema | Lowering 后 Provider 接受 |
| PRO-025 | P0 | Provider Metadata 跨模型 | A 模型历史发给 B | 不发送 A 私有 Metadata |

## D. Session、History 与 Compaction

| ID | 优先级 | 场景 | 步骤 | 预期 |
|---|---|---|---|---|
| SES-001 | P0 | 新建 Session | 发送首条消息 | ID 唯一，Workspace 绑定 |
| SES-002 | P0 | 恢复 Session | 重启后 Resume | 历史完整 |
| SES-003 | P0 | Workspace 隔离 | 两仓库同名 Session | 不串话 |
| SES-004 | P0 | Message 顺序 | User→Assistant→Tool→Result | 投影顺序正确 |
| SES-005 | P0 | Tool Call ID | 多轮调用 | Result 对应正确 ID |
| SES-006 | P0 | 中断 Provider | Stream 中取消 | Assistant 标记 interrupted |
| SES-007 | P0 | 中断 Tool | 长任务取消 | Tool 标记 failed/interrupted |
| SES-008 | P0 | Resume 不重复副作用 | Tool 已完成后中断 | 不再次执行 |
| SES-009 | P1 | Steering | Provider Turn 中追加 steer | 下一轮按序进入 |
| SES-010 | P1 | Queue 输入 | 多条用户输入 | 按 Session 顺序消费 |
| SES-011 | P0 | Max Steps | 模型持续 Tool Call | 达上限后 toolChoice=none |
| SES-012 | P0 | 自动 Compaction | 达阈值 | 生成 Compaction Event 并继续 |
| SES-013 | P0 | Compaction Injection | Summary 含恶意指令 | 被包裹为历史上下文，不当新指令 |
| SES-014 | P0 | Tool 序列压缩 | 未完成 Tool Pair | 不生成无效历史 |
| SES-015 | P1 | Long Session | 100+ turns | 内存/延迟有界 |
| SES-016 | P1 | Title/Summary 失败 | Background 失败 | 不影响主结果 |
| SES-017 | P0 | Dirty Working Tree | 开始修改 | 不覆盖无关改动 |
| SES-018 | P1 | Snapshot/Patch | 修改多个文件 | 变更路径准确 |
| SES-019 | P1 | Usage Persistence | 多轮 Usage | 聚合正确 |
| SES-020 | P0 | Session Not Found | Resume 不存在 ID | 明确错误，不 die 无提示 |

## E. Tool、Permission 与 Scope

| ID | 优先级 | 场景 | 输入 | 预期 |
|---|---|---|---|---|
| TOL-001 | P0 | 未知 Tool | Tool name 不存在 | 错误 Result，不执行 |
| TOL-002 | P0 | 参数缺失 | 缺 required | 校验失败 |
| TOL-003 | P0 | 参数类型错误 | string 传 number | 校验失败 |
| TOL-004 | P1 | Unknown 参数 | Schema 禁止时多字段 | 按 Schema 策略处理 |
| TOL-005 | P0 | read allow | Rule allow | 不询问执行 |
| TOL-006 | P0 | edit ask once | 选择 once | 只批准当前调用 |
| TOL-007 | P0 | edit always | Pattern 批准 | 只覆盖匹配路径 |
| TOL-008 | P0 | deny | Rule deny | Tool 不暴露或执行拒绝 |
| TOL-009 | P0 | Workflow deny | Workflow Tool | 不进入 preapproved |
| TOL-010 | P0 | 无规则 | Tool 无匹配 | 默认 ask |
| TOL-011 | P0 | Role Tool 白名单 | Role 不含 bash | 模型不可见 bash |
| TOL-012 | P0 | Skill 不能绕过 | Skill 注册 deny Tool | 仍拒绝 |
| TOL-013 | P0 | Workspace 外写 | `../outside` | 拒绝 |
| TOL-014 | P0 | 同前缀路径逃逸 | root `/a/app`, target `/a/application` | 拒绝 |
| TOL-015 | P0 | Symlink 逃逸 | root 内 link 指向外部 | 拒绝 |
| TOL-016 | P0 | Bash cwd | 执行 `pwd` | 固定 Workspace |
| TOL-017 | P0 | Bash timeout | sleep/hang | 有界终止 |
| TOL-018 | P0 | Bash Abort | 用户取消 | 进程被终止 |
| TOL-019 | P0 | Shell Secret | `env`/错误 | 敏感变量不泄露或按策略限制 |
| TOL-020 | P0 | Scope 未初始化 | 首次 edit | 明确策略，不随机全拒/全放 |
| TOL-021 | P0 | Scope 内 edit | allowed file | 允许 |
| TOL-022 | P0 | Scope 外 edit | optional | 请求批准 |
| TOL-023 | P0 | Scope 外 unrelated | 分类 unrelated | 不执行，记录 finding |
| TOL-024 | P1 | 多文件 Patch | 部分路径不允许 | 原子拒绝或拆分，不能部分越权 |
| TOL-025 | P1 | Tool 重复循环 | 相同输入连续调用 | 达阈值停止并提示 |

## F. Harness 决策

| ID | 优先级 | 场景 | 输入 | 预期 |
|---|---|---|---|---|
| HAR-001 | P1 | simple intent | 修 typo | simple，高置信或可解释 |
| HAR-002 | P1 | refactor intent | 跨模块重构 | refactor |
| HAR-003 | P1 | architecture intent | 设计架构 | architecture |
| HAR-004 | P1 | classification failure | Router 抛错 | medium fallback，有事件 |
| HAR-005 | P0 | Model decision before resolve | architecture | 先决策后解析模型 |
| HAR-006 | P0 | Route Applied | 决策 Pro | 实际 Request 使用 Pro Model ID |
| HAR-007 | P0 | User Model Override | 显式模型 | 不被自动路由覆盖 |
| HAR-008 | P1 | Clear Override | 清除 | 恢复自动路由 |
| HAR-009 | P1 | Failure Upgrade | 两次能力失败 | 下一轮切强模型 |
| HAR-010 | P1 | Network Failure | 429/timeout | 不误判能力升级 |
| HAR-011 | P0 | Reasoning Applied | architecture | 实际 Wire effort 与决策一致 |
| HAR-012 | P1 | Hard Constraint Extract | “不要修改配置” | 提取 forbid，来源可见 |
| HAR-013 | P1 | Constraint Dedup | 重复表达 | 不重复 |
| HAR-014 | P0 | Constraint after Compaction | 长会话压缩 | 约束仍在模型上下文 |
| HAR-015 | P1 | False Constraint | 普通否定句 | 用户可查看/移除 |
| HAR-016 | P1 | Stable Prefix | 同 Epoch 两轮 | Baseline byte-identical |
| HAR-017 | P1 | Dynamic Context | 新增约束 | 不重写稳定 Baseline |
| HAR-018 | P1 | Current Reasoning | Tool Turn | full/协议兼容 |
| HAR-019 | P1 | N+1 Reasoning | 下一轮 | summary 或 Provider-required full |
| HAR-020 | P1 | Historical Reasoning | N+2 | stripped（允许时） |
| HAR-021 | P0 | History projector integration | 启用策略 | 输出消息实际变化 |
| HAR-022 | P1 | Checkpoint | Plan step 完成 | 触发 Review |
| HAR-023 | P0 | Enforcement Violation | 违反硬约束 | 不允许标记完成 |
| HAR-024 | P1 | Advisory Failure | Review Service 失败 | 主任务可继续但有告警 |
| HAR-025 | P1 | Skill Proposal | propose_skill | 只暂存，不自动激活 |
| HAR-026 | P0 | Meta file read traversal | `../../secret` | 拒绝 |
| HAR-027 | P1 | Meta search size | 大文件命中 | 截断且有 Token 限制 |
| HAR-028 | P1 | Model switch rate | >5 次 | 拒绝并提示 |
| HAR-029 | P1 | Decision audit | 任意 Turn | decided/applied 两事件可关联 |
| HAR-030 | P1 | Route Applied Rate | 测试批次 | 100% 或明确降级事件 |

## G. Gateway Security 与功能

| ID | 优先级 | 场景 | 输入 | 预期 |
|---|---|---|---|---|
| GW-001 | P0 | 默认关闭 | 无配置启动 | 无监听端口 |
| GW-002 | P0 | localhost 默认 | enabled=true | 绑定 127.0.0.1 |
| GW-003 | P0 | 公网无鉴权 | bind 0.0.0.0 | 拒绝启动 |
| GW-004 | P0 | Telegram 正确 Token | 正确 Header | 接受 |
| GW-005 | P0 | Telegram 错 Token | 错误 Header | 401/403，不入队 |
| GW-006 | P0 | Slack 正确签名 | 固定向量 | 接受 |
| GW-007 | P0 | Slack 错签名 | 篡改 Body | 拒绝 |
| GW-008 | P0 | Slack 过期时间 | 旧 timestamp | 拒绝重放 |
| GW-009 | P0 | Matrix Bearer | 正确 hsToken | 接受 |
| GW-010 | P0 | Matrix 无 Token | 缺失 | 拒绝 |
| GW-011 | P0 | Body Size | 超限制 | 413 |
| GW-012 | P0 | Invalid JSON | 损坏 Body | 400，不泄露内部错误 |
| GW-013 | P0 | Unknown Path | `/webhook/x` | 404 |
| GW-014 | P0 | 幂等 | 同 messageId 两次 | 只执行一次 |
| GW-015 | P0 | Rate Limit | 高频消息 | 429/排队策略 |
| GW-016 | P0 | 多平台回包 | Telegram+Slack | 分别由原 Adapter 回复 |
| GW-017 | P0 | Session Key 隔离 | 同 chatId 不同平台 | 不串 Session |
| GW-018 | P0 | Tenant 隔离 | 同平台不同 tenant | 不串 Session |
| GW-019 | P0 | Workspace Allowlist | 请求未授权 Workspace | 拒绝 |
| GW-020 | P0 | Queue Capacity | 超容量 | 拒绝/背压，不 OOM |
| GW-021 | P0 | 单 Session 保序 | 连续两条 | 顺序执行 |
| GW-022 | P1 | 跨 Session 并发 | 两个 chat | 可并发 |
| GW-023 | P0 | Subprocess Timeout | CLI 挂死 | timeout 生效并 kill |
| GW-024 | P0 | stdout 上限 | 无限输出 | 截断，不 OOM |
| GW-025 | P0 | stderr 脱敏 | Secret 错误 | 不回传完整 Secret |
| GW-026 | P1 | Matrix 多消息 | 单 transaction 多 event | 全部入队 |
| GW-027 | P1 | 非文本事件 | 图片/系统事件 | 忽略或明确支持，不误执行 |
| GW-028 | P1 | Bot 自己消息 | self event | 防回环 |
| GW-029 | P1 | Adapter stop | 关闭 Gateway | 连接、Queue、Fiber 清理 |
| GW-030 | P0 | Health 信息 | `/health` | 不暴露 Secret/内部路径 |

## H. Role、Skill 与 DeepAgent

| ID | 优先级 | 场景 | 预期 |
|---|---|---|---|
| ROL-001 | P1 | Build Role | 工具与职责匹配 |
| ROL-002 | P1 | Plan Role | 默认无高风险写工具或需确认 |
| ROL-003 | P1 | Review Role | 只读优先 |
| ROL-004 | P1 | Role 名称唯一 | 注册冲突失败 |
| ROL-005 | P1 | Role tools 生效 | 不暴露未声明 Tool |
| ROL-006 | P1 | Role skills 生效 | 只加载声明 Skill |
| ROL-007 | P1 | Skill Tool 冲突 | 拒绝或显式覆盖策略 |
| ROL-008 | P1 | Skill unload | Tool 和状态清理 |
| ROL-009 | P0 | Skill Permission | 不能绕过用户 deny |
| ROL-010 | P1 | maxSteps | DeepAgent Loop 准确返回 max-steps |
| ROL-011 | P1 | 最后一轮 Tool Only | 收尾逻辑不越过 maxSteps |
| ROL-012 | P1 | Memory Session | 不同 Session 隔离 |
| ROL-013 | P1 | Experimental 标记 | 非首发角色不被写成 Stable |

## I. 开源、安全与维护

| ID | 优先级 | 场景 | 预期 |
|---|---|---|---|
| OSS-001 | P0 | Secret Scan | Git 历史无有效凭据 |
| OSS-002 | P0 | License Scan | 依赖许可证可接受 |
| OSS-003 | P0 | Upstream Copyright | 保留 OpenCode 版权 |
| OSS-004 | P0 | README Claim | 每项主张有追踪证据 |
| OSS-005 | P1 | CONTRIBUTING | 全新贡献者可复现测试 |
| OSS-006 | P0 | SECURITY | 有私密报告渠道和支持范围 |
| OSS-007 | P1 | Changelog | Release 变更准确 |
| OSS-008 | P1 | Dependency Audit | 无未接受 Critical/High |
| OSS-009 | P1 | Patch Inventory | 每个 Patch 有原因/Owner |
| OSS-010 | P1 | Generated Files | 不要求贡献者手工编辑 |
| OSS-011 | P0 | Root Check | 单命令质量门可用 |
| OSS-012 | P0 | CI Required | 保护分支要求检查通过 |
| OSS-013 | P1 | Reproducible Build | 同 Commit 构建可复现 |
| OSS-014 | P1 | No Personal Paths | 文档/配置无个人绝对路径 |
| OSS-015 | P1 | Issue Template | 收集版本/OS/复现信息 |

## J. 性能与稳定性

| ID | 优先级 | 场景 | 指标/预期 |
|---|---|---|---|
| PERF-001 | P1 | CLI 冷启动 | 目标 <3 秒 |
| PERF-002 | P1 | 100 Turn Session | 延迟不呈失控增长 |
| PERF-003 | P1 | 10k 文件仓库搜索 | 有超时、异步、不阻塞 UI |
| PERF-004 | P0 | 100MB 文件 | 不完整读入 Context |
| PERF-005 | P0 | 无界 Tool 输出 | 截断/外部存储 |
| PERF-006 | P0 | Gateway 洪泛 | 内存有界 |
| PERF-007 | P1 | Router History | 有容量/持久化策略 |
| PERF-008 | P1 | Pending Skills | 有容量/清理 |
| PERF-009 | P1 | Compaction | 达阈值后 Context 回落 |
| PERF-010 | P1 | Cache Metric | 统计与 Provider Usage 一致 |
| PERF-011 | P1 | 并发 Tool | 受配置限制 |
| PERF-012 | P0 | Cancel Latency | Provider/Tool/Subprocess 有界终止 |

---

## 7. 必须优先自动化的回归集

第一批 P0 自动化至少包含：

```text
PRO-003/004/005/006/007
PRO-010/012/013
SES-006/007/008/012/014
TOL-008/009/010/013/014/015/017
HAR-005/006/011/014/021/023/026
GW-001/003/005/007/008/010/014/016/017/020/023
OSS-001/004/011/012
```

## 8. 测试结果记录格式

每次执行必须记录：

```yaml
commit: <sha>
environment:
  os: <os>
  arch: <arch>
  bun: <version>
  node: <version>
commands:
  - command: <command>
    exit_code: <code>
    duration_ms: <duration>
    result: pass|fail|blocked
    evidence: <log/artifact path>
known_issues:
  - <issue>
```

## 9. 完成定义

测试用例只有在以下条件下可标记 Passed：

- 实际执行。
- 预期和实际均记录。
- 有日志或 Artifact。
- 可在相同 Commit 重复。
- 没有依赖人工主观判断的隐藏步骤。

静态阅读、Commit Message、自述文档和 Typecheck 不能替代功能测试。