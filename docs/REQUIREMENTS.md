# DeepCode 需求文档

> 版本：1.0
> 更新时间：2026-07-12

---

## 一、产品定位

**DeepCode** 是一款为 DeepSeek V4 模型量身定制的 Coding Agent Harness 层产品。

**核心用户：** 财务/行政/PM/律师等中文 B 端本地任务用户，以及需要高效编码助手的开发者。

**四大核心承诺：**

| 承诺 | 说明 |
|------|------|
| **Completion-first** | 优先完成用户任务，而非反复询问澄清 |
| **Runtime-first** | 充分利用工具和运行时验证，不凭记忆猜测 |
| **Evidence-first** | 所有结论基于实际文件内容和执行结果 |
| **DeepSeek-native** | 为 DeepSeek V4 物理特性深度优化，发挥全部能力 |

---

## 二、核心功能模块需求

### 模块 1：Byte-Stable Prefix 架构（I-13）

**需求描述：**
System Prompt 在 Session 启动时组装一次后冻结为不可变前缀，最大化 Prefix Cache 命中率。

**验收标准：**
- ✅ Baseline System Context 启动时渲染一次，整个 Epoch 字节不变
- ✅ 动态变更（约束新增/计划更新）通过 Mid-Conversation System Message 追加
- ✅ renderPrefix() 是纯函数（无时间戳/随机数）
- ✅ ContextSource 走标准 V2 注册路径，不使用 legacy transform hook

**技术实现要点：**
- 使用 SystemContext.make() 定义 source
- baseline() 恒等函数，update() 返回空或增量文本
- 注册到 SystemContextRegistry

---

### 模块 2：KV Cache 硬约束前缀注入（I-04）

**需求描述：**
从用户 prompt 中自动提取"不能/不要/必须/禁止"等硬约束，注入到 System Context 前缀区（非压缩区），物理隔离防止注意力稀释。

**验收标准：**
- ✅ 支持 4 类约束：forbid/require/never/always
- ✅ 中文正则模式覆盖常用表达（不要/不能/禁止/严禁/必须/一定要/只能）
- ✅ 约束作为独立 ContextSource 注入，进入 Baseline prefix 区
- ✅ 约束去重（按 id 哈希）
- ✅ 约束更新时发射 Mid-Conversation Message

**正则模式清单：**
1. 不要/别动 X → forbid
2. 不能用/改 X → forbid
3. 禁止/严禁 X → forbid/never
4. 不可/不得 X → forbid
5. 必须先/要 X → require
6. 一定/只能/只许 X → require/always

---

### 模块 3：Flash/Pro 智能路由（I-10）

**需求描述：**
根据任务复杂度和风险等级自动选择 DeepSeek V4 Flash 或 Pro 模型，平衡成本、速度和质量。

**验收标准：**
- ✅ 11 条优先级路由规则（用户override > Checkpoint > Plan > 高风险意图 > 高风险文件 > 失败升级 > ...）
- ✅ Route Decision 记录（selected/reason/riskLevel/timestamp）
- ✅ 高风险文件 glob 模式可配置
- ✅ 连续 N 次失败自动升级 Pro
- ✅ 用户手动 override 支持

**默认高风险文件模式：**
- `*.sql` / `migrations/*`（数据库）
- `*.secret.*` / `*.env*`（密钥配置）
- `package.json` / `tsconfig.json`（项目配置）
- `Dockerfile*` / `.github/*`（部署/CI）

---

### 模块 4：Reasoning Content 管理（I-14）

**需求描述：**
DeepSeek V4 的 reasoning_content（思维链）采用三阶段生命周期管理，不长期回灌历史推理内容节省上下文空间。

**验收标准：**
- ✅ reasoning_effort 按意图/档位分配（Flash=low, Arch=max, 其他=high）
- ✅ 工具调用轮次保留完整 reasoning
- ✅ N+1 轮替换为启发式摘要（首句+末句）
- ✅ 历史轮次剥离完整 reasoning
- ✅ 纯函数 summarizeReasoning() 零 LLM 成本

**三阶段策略：**
| 轮次 | 处理方式 |
|------|---------|
| 当前工具轮次 | 完整回传 + DB 持久化 |
| 下一轮 (N+1) | 替换为 ~50-80 token 摘要 |
| N+2 及以后 | 完全剥离 |

---

### 模块 5：7+1 意图路由（I-10）

**需求描述：**
在执行开始前自动识别任务类型，绑定对应的执行策略（面谈深度、计划粒度、审查严格度）。

**验收标准：**
- ✅ 8 类意图分类：
  - `simple`：简单机械任务（排序 import、修 typo）
  - `medium`：常规功能/小 bug 修复
  - `refactor`：代码重构（细粒度计划+高频审查）
  - `new`：新建项目/功能（深度澄清+完整计划）
  - `architecture`：架构设计（最大推理深度+最严审查）
  - `research`：调研分析（高 λ 记忆）
  - `collaboration`：多模块协作（分模块处理）
  - `spec-driven`：存在 OpenSpec 配置时自动激活
- ✅ 两级分类：正则快速匹配 + LLM 可覆盖
- ✅ 每类意图绑定 STRATEGY_TABLE（needsClarification/planGranularity/reviewStrictness/checkpointFreq）

---

### 模块 6：Agent 免疫系统（I-01）

**需求描述：**
Checkpoint 处独立审查约束遵守情况，发现违规自动固化为 ImmuneSkill 抗体，形成负反馈闭环。

**验收标准：**
- ✅ Checkpoint 触发独立审查
- ✅ 当前支持备份约束检查（有写入无 .bak → 违规）
- ✅ 违规生成对应 ImmuneSkill（name/trigger/check/action）
- ✅ Skill 按 name 去重（BUG-014 已修复）
- ✅ 审查历史记录
- ⏳ LLM 语义审查（TD-005，待阶段三实现）

---

### 模块 7：双向 Agent 原语（I-02）

**需求描述：**
LLM 可通过四个元指令主动向 Harness 声明需求，从单向指令流变为双向协同决策。

**验收标准：**
- ✅ 元指令以 tool_call 形式实现（兼容现有协议）
- ✅ `need_more_context(files, search_terms, reason)`
  - 限制每次最多 10 个文件（防滥用）
  - 通过注入回调读文件
- ✅ `request_specialized_model(target, reason)` / `request_flash_model()`
  - 每 session 最多切换 5 次
- ✅ `trigger_self_review(focus, depth)`：标记 Checkpoint
- ✅ `propose_skill(name, description, trigger, body)`：提议 Skill
- ⏳ search_terms 实际搜索（BUG-012，待修复）
- ⏳ propose_skill 安全验证+持久化（TD-003）

---

### 模块 8：滑动窗口对齐 + Token 预算管理（I-03）

**需求描述：**
感知 DeepSeek V4 sliding_window=128 的物理限制，管理五区 Token 布局，确保关键内容不滑出全密度窗口。

**验收标准：**
- ✅ 五区追踪：prefix/anchor/active/compressed/tail
- ✅ Flash/Pro 两套预算（基于 index_topk）
- ✅ 3字符/token 保守估算
- ✅ 窗口状态检测（criticalInWindow）
- ✅ 输出 token 数建议
- ✅ compressHistory()：checkpoint 后压缩
- ✅ 注释数值与实际一致（BUG-015 已修复）

---

### 模块 9：Prompt 信号标签（I-04）

**需求描述：**
基于 mHC 多通道超连接和 MoE Hash Routing 的物理特性，为六类语义信号添加字节稳定标签，保障路由稳定性。

**验收标准：**
- ✅ 标签格式：`[SIGNAL:TYPE]\n内容\n[/SIGNAL]\n`
- ✅ 全大写 ASCII 标签（跨语言 tokenizer 一致）
- ✅ 六类信号：goal/constraint/evidence/execution/review/next_action
- ✅ buildSignalBlock() 固定顺序输出（字节稳定）
- ✅ stripSignalTags() 剥离标签用于用户可见输出
- ✅ 4 通道映射（mHC hc_mult=4）

---

### 模块 10：OKR+PlanStep 级联（I-06）

**需求描述：**
三级计划体系（Objective → KeyResult → PlanStep），支持约束变化/假设推翻时自动级联修正。

**验收标准：**
- ✅ createPlan(objective, krs, steps)：自动编号、链式依赖
- ✅ 状态机：pending → in_progress → done → verified
- ✅ cascade(reason, changes)：级联修正（仅非 done/verified 步骤）
- ✅ evaluateKRs()：KR 达成评估，done+KR met → verified
- ✅ renderPlan()：Markdown 渲染，带状态 emoji
- ✅ 运算符优先级 Bug 修复（BUG-002）
- ✅ 字段映射 Bug 修复（BUG-003）
- ⏳ 与意图路由/Tool 生命周期集成（TD-001）

---

### 模块 11：Review 切换防漂移（I-07）

**需求描述：**
基于注意力稀释物理定律的四档梯度补偿审查，对抗长对话中目标漂移。

**验收标准：**
- ✅ tier = min(4, floor(ln(K+1) * (1 + P/12)))
  - K = tool 轮次，P = 约束数
  - K=10→Tier1, K=50→Tier2, K=200→Tier3, K=1000→Tier4
- ✅ 四档审查 prompt 递进强度
- ✅ Tier4 原点回拉：硬约束+Objective 重注入
- ✅ 审查历史记录（最近 20 条）
- ⏳ 与 tool 执行流集成（TD-001）

---

### 模块 12：Scope Creep 防护（I-08）

**需求描述：**
防止 Agent "顺手改"超出用户原始需求的代码，两层防护（信号词检测 + 工具调用拦截）。

**验收标准：**
- ✅ 三分类依赖管理：required/optional/unrelated
- ✅ 中文信号词检测："顺便..."、"既然都..."、"也可以改..."
- ✅ 英文信号词检测："while I'm at it"、"might as well"
- ✅ 简化 glob 匹配（前缀/后缀/中间通配/精确）
- ✅ glob 转义特殊字符修复（BUG-005）
- ✅ approvedOptionals 统一 glob 匹配修复（BUG-004）
- ✅ deferredFindings 记录无关问题，任务结束报告
- ⏳ 用户确认 UI 流程（TD-010）

---

### 模块 13：Skills 自进化 + Checkpoint 快照审查（I-09/I-11）

**需求描述：**
从错误中学习自动固化 Skill，Checkpoint 快照驱动多轮审查（不读完整日志）。

**验收标准：**
- ✅ Skill 状态机：candidate → active → hardened/deprecated
  - useCount≥5 开始评估
  - 成功率<30% → deprecated
  - 成功率>80%且useCount≥10 → hardened
- ✅ 四类触发器：regex/tool/intent/constraint-violation
- ✅ constraint-violation 仅审查场景激活（BUG-007 修复）
- ✅ createCheckpoint turn 参数传入（BUG-006 修复）
- ✅ 逐轮递减上下文策略（decayFactor=min(1,5/seq)）
- ✅ 审查结果 → solidifySkill 闭环
- ✅ 渲染为 SuperPowers 兼容 Markdown
- ⏳ Skill 磁盘持久化（TD-002）
- ⏳ getActiveSkills 自动注入 system prompt（TD-001）

---

### 模块 14：记忆粒度分层（I-12）

**需求描述：**
三级记忆体系（工作/情景/语义）+ λ 值动态调节，按任务类型管理记忆保留强度。

**验收标准：**
- ✅ Working Memory（step 内）：3 turn 过期，λ 打折
- ✅ Episodic Memory（session 内）：结构化存储，高 λ 保留
- ✅ λ 值按意图配置：
  - converge（simple/debug）：0.2-0.3
  - balanced（refactor/medium）：0.5-0.6
  - diverge（new/arch/research）：0.7-0.9
- ✅ endStep()：过期工作记忆提升或丢弃
- ✅ 增量统计修复（BUG-008）：返回本次 promoted/discarded/pruned
- ✅ 冷记忆清理修复（BUG-009）：>20 turn compressed 删除
- ✅ extractForCompaction()：λ 降序贪心选择
- ✅ forgetByTag()：主动遗忘
- ⏳ Semantic Memory 跨 session 持久化（TD-007）
- ⏳ 与 tool 执行流集成（TD-001）

---

## 三、飞书/微信消息网关需求

### 功能目标
让用户可以直接通过飞书和企业微信给 DeepCode 发消息，DeepCode 接收、处理、回复。

### 3.1 核心能力

| 能力 | 说明 |
|------|------|
| Webhook 接收 | HTTP Server 接收飞书/微信事件回调 |
| 签名验证 | 验证请求来源合法性，防止伪造 |
| 消息解析 | 平台消息格式 → DeepCode 统一消息模型 |
| Session 桥接 | 按用户/群聊 ID 映射到 OpenCode Session |
| 回复发送 | 处理结果 → 平台消息格式 → API 发送 |
| 插件注册 | 作为 OpenCode Plugin 加载 |

### 3.2 飞书适配器

- 支持飞书开放平台 Bot 应用
- 事件订阅：im.message.receive_v1
- 消息类型：文本消息接收和回复
- 支持群聊 @DeepCode 和单聊

### 3.3 企业微信适配器

- 企业微信自建应用
- 回调 URL 验证（echostr）
- 消息加解密（AES）
- 支持文本消息收发

### 3.4 非功能需求

- 纯 TypeScript 实现，不引入 Python 依赖
- 企业微信优先（官方 API 稳定，避免封号）
- 所有密钥通过环境变量/配置注入，不硬编码
- Webhook 端点 ≤ 200ms 内返回 200（异步处理实际任务）

---

## 四、通用质量要求

### 代码质量
- 所有函数/类/接口必须有简体中文注释
- 注释包含：功能说明、入参、返回值、设计决策理由
- Effect 框架遵循最佳实践（Layer/Service/Ref 模式）
- 无 `any` 类型（除非显式标注理由）

### 测试要求
- 每个模块完成后运行 `bun typecheck`
- 纯函数逻辑建议写单元测试
- 网关模块完成后 curl 端到端测试
- 截图留存关键功能验证

### 文档要求
- 架构变更更新 ARCHITECTURE.md
- 新增模块更新 SOURCE_MAP.md
- Bug 修复更新 BUG_LIST.md 状态
- 新增功能更新 MAINTENANCE.md 排障指南

---

## 五、验收清单总览

| 类别 | 验收项 |
|------|-------|
| **源码阅读** | SOURCE_MAP.md 源码地图完成 |
| **Bug 修复** | P0/P1 Bug 全部修复并记录在 BUG_LIST.md |
| **代码注释** | 所有函数有中文注释 |
| **技术文档** | ARCHITECTURE.md / MAINTENANCE.md / REQUIREMENTS.md / README.md 完整 |
| **模型整合** | 14 个 DeepCode 模块全部在 location-services.ts 注册 |
| **类型检查** | `bun typecheck` 通过 |
| **飞书网关** | /webhook/feishu 路由可用，curl 测试通过 |
| **微信网关** | /webhook/wecom 路由可用，URL 验证通过 |
| **Git 提交** | 每步独立 commit，双语标题 |
| **截图证据** | 关键功能点有截图验证 |

---

*文档版本：v1.0*
