# DeepCode Harness 层改造 — 整体系统设计方案

## 概述

DeepCode 是基于 OpenCode 的 DeepSeek V4 深度适配 Harness 层。设计目标是将 DeepSeek V4 的物理特性（1M context、Prefix Cache、CSA/HCA 注意力压缩、Flash/Pro 双模型、Reasoning Content 协议）与 Harness Agent 的理论框架工程化落地。

本文档覆盖七大模块的设计，每个模块包含技术路径对比和选型理由。

**核心设计原则**：
1. **Cache-first**：System Prompt 作为 byte-stable prefix 最大化 KV Cache 命中
2. **Layout-driven**：上下文布局遵循注意力压缩规律（前不收、后收）
3. **Flash/Pro-routed**：默认 Flash，高风险/复杂节点自动升级 Pro
4. **Reasoning-not-memory**：思维链默认剥离，不长期回灌
5. **Plugin-aligned**：所有改造通过 OpenCode 插件机制或 ContextSource 扩展点实施，尽量不侵入核心

---

## 模块一：Byte-Stable Prefix 架构

### 问题分析

DeepSeek V4 API 的 Context Caching 是 **best-effort full-prefix-unit 匹配**。System Prompt 必须在 Session 启动时组装后 **byte-identical** 冻结，任何中间修改都会导致 cache miss。OpenCode 现有 SystemContext 机制已经天然支持这一点（Baseline System Context 在整个 Context Epoch 内不可变），但需要：

1. 确保 OMO 的动态 System Prompt 组装走 ContextSource 路径，而非直接修改
2. Skill/Agent/Memory 等动态内容不进入 prefix 区，通过 Mid-Conversation System Message 注入
3. Skill 索引放入 prefix，Skill body 通过 tool 按需加载

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 与 OpenCode 兼容性 | 推荐度 |
|------|---------|-------|-------------------|-------|
| A | 直接修改 System Prompt 组装函数，冻结后禁止修改 | 中 | 低—可能绕过 ContextSource 机制，导致 Epoch 管理失效 | ⭐ |
| B | 新增 `DeepCodePrefix` ContextSource，注册到 SystemContextRegistry，OMO 组装逻辑作为其 loader | **低** | **高—完全对齐 CONTEXT.md 定义的扩展点** | ⭐⭐⭐ |
| C | 在 OMO Plugin 层面做 hook 拦截，缓存首次渲染结果 | 中 | 中—hook 机制不是 V2 一等路径 | ⭐⭐ |

### 选型：路径 B

**理由**：
- OpenCode 的 SystemContextRegistry 就是为此设计的："Plugin-defined context registration and hot-reload lifecycle remain a follow-up built on the same scoped registry seam"
- 完全利用现有的 initialize/reconcile/replace 生命周期
- Baseline 在 DB 中持久化，跨进程重启也复用（"A Baseline System Context is stored durably and reused verbatim across process restarts within its Context Epoch"）
- Mid-Conversation System Message 天然处理动态更新

### 设计详情

**1. 新增 DeepCodePrefixSource（packages/core 或 plugin 内）**

```typescript
// 作为 ContextSource 注册，key: "deepcode/prefix"
// loader: 组装 OMO system prompt + environment + date + hard constraints
// baseline: 渲染完整 prefix 文本（一次性）
// update: 返回空字符串（prefix 不应更新；动态内容走其他 ContextSource）
```

**2. Prefix 内容分层**

| 层 | 内容 | Cache 行为 | 变更方式 |
|----|------|-----------|---------|
| L1 静态前缀 | OMO 角色定义、工具 catalog、核心规则 | Byte-stable，永久 cache hit | 仅插件安装/卸载时触发 replace |
| L2 硬约束 | 用户指令中的否定词/必须词（模块二注入） | 同一 Session 内稳定 | Session 启动时确定 |
| L3 Skill 索引 | 可用 skill 名称+一句话描述（不包含 body） | Agent 切换时通过 update 追加 | Mid-Conversation System Message |
| L4 动态内容 | Memory 更新、新发现的项目指令 | 不在 prefix 中，通过独立 ContextSource | Mid-Conversation System Message |

**3. 确保 OMO prompt 组装对齐**

OMO 现有的 `dynamic-agent-prompt-builder` 不再直接输出到 system prompt，而是作为 `DeepCodePrefixSource.load()` 的数据源。首次加载后，结果被 codec 编码存入 snapshot。

**4. Skill body 按需加载**

遵循现有模式：Skill Guidance 作为 ContextSource（仅名称+描述），Skill 正文通过 `skill` tool 在需要时加载。这与 DeepSeek-Reasonix 的 index.go 做法一致：索引在 prefix，正文按需拉取。

**关键源码位置**：
- `packages/core/src/system-context/index.ts`：SystemContext algebra（无需修改）
- `packages/core/src/system-context/registry.ts`：Registry（无需修改）
- `packages/core/src/system-context/builtins.ts`：注册参考模式
- `packages/core/src/session/context-epoch.ts`：Epoch 管理（无需修改）
- 新增：`packages/deepcode/src/prefix-context.ts`：DeepCodePrefixSource 实现
- 修改：OMO 的 plugin 入口，移除直接修改 system prompt 的路径

---

## 模块二：KV Cache 硬约束前缀注入

### 问题分析

DeepSeek V4 使用 CSA（compress_ratio=4）+ HCA（compress_ratio=128）+ MQA 混合注意力。注意力稀释意味着放在对话历史后面的内容更容易被"遗忘"。用户 prompt 中的"不能""不要""必须""禁止"等硬约束如果出现在用户消息中，经过多轮压缩后约束可能丢失。

论文 I-04 的核心洞察：**约束不丢是因为约束根本不在被压缩的内容里**。

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 可维护性 | 推荐度 |
|------|---------|-------|---------|-------|
| A | 在用户消息前硬拼接约束文本（修改消息组装） | 低 | 低—约束混在用户消息中，无法保证不被压缩 | ⭐ |
| B | 提取硬约束后作为独立 ContextSource 注册，进入 Baseline prefix | **中** | **高—约束天然在非压缩区，且走标准更新路径** | ⭐⭐⭐ |
| C | 将约束编译为可执行的检查函数（tool call 后自动验证） | 高 | 高—但成本大，适合后续迭代 | ⭐⭐ |

### 选型：路径 B（可演进到 B+C 混合）

### 设计详情

**1. 硬约束提取器**

```typescript
// 位置：packages/deepcode/src/hard-constraint/extractor.ts
// 从用户 prompt 中提取硬约束
interface HardConstraint {
  id: string           // 唯一标识
  type: 'forbid' | 'require' | 'never' | 'always'  // 约束类型
  pattern: string      // 约束描述（原文或规范化）
  scope: string        // 适用范围（文件类型、操作类型等）
  source: 'user' | 'system' | 'derived'
}

// 提取规则：
// - 关键词匹配：不能、不要、必须、禁止、严禁、绝不、一定、只能、只许
// - 模式匹配："不要修改X" "必须先Y再Z" "禁止使用A"
// - 从 AGENTS.md / 项目配置文件中自动提取
```

**2. 约束注入路径**

硬约束作为一个独立的 ContextSource（key: `deepcode/hard-constraints`），loader 从 session 级别的约束存储中读取。

- Session 启动时：解析初始 prompt 中的硬约束 → 写入约束存储 → ContextSource.load() 返回约束文本
- Mid-session：新约束通过 reconcile 检测，以 Mid-Conversation System Message 发射
- 约束文本格式：清晰的编号列表，便于模型逐条引用

**3. 前缀区大小预算**

硬约束前缀区控制在 ~200 tokens 以内：
- 每条约束平均 20-30 tokens
- 最多保留 10 条活跃约束
- 超过时按优先级和新近性淘汰（类似缓存策略）

**4. 约束到可执行检查的映射（后续迭代）**

第一阶段仅做文本注入。第二阶段可将高优先级约束编译为验证函数：
- "不能修改 config 文件" → 文件写入操作时检查路径
- "必须先备份" → 写操作前检查备份是否存在

这与模块六（Agent 免疫系统）形成闭环：免疫系统审查产出的固化 Skill 本质上就是可执行约束。

---

## 模块三：Flash/Pro 智能路由

### 问题分析

DeepSeek V4 提供两个模型变体：
- **Flash**：更小更快更便宜（hidden_size=4096, 43层, 256 experts），适合简单/常规/低风险步骤
- **Pro**：更大更强更贵（hidden_size=7168, 61层, 384 experts），适合复杂推理/高风险操作/审查

当前 OpenCode 在 Session 级别固定一个 model，无法在同一 Session 内动态切换。

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 灵活性 | 推荐度 |
|------|---------|-------|-------|-------|
| A | Hard routing：在代码中硬编码规则（简单任务用Flash，危险操作自动升级Pro） | **中** | 中—规则确定但不透明 | ⭐⭐ |
| B | Soft routing：在 System Prompt 中加指令让模型自己声明需要 Pro | 低 | 低—模型可能不会准确判断 | ⭐ |
| C | Hybrid：Hard rules 捕获确定场景（高风险文件、checkpoint审查、失败重试），其余由 SessionRunnerModel 根据意图/上下文决定 | **中** | **高—确定性+灵活性结合** | ⭐⭐⭐ |

### 选型：路径 C（Hybrid 路由）

### 设计详情

**1. 路由决策点**

| 场景 | 路由 | 理由 |
|------|------|------|
| 默认（读文件、搜索、简单问答） | Flash | 成本低，速度快 |
| 文件写入/修改（edit/apply_patch/write） | Flash（小改动）/ Pro（大改动） | 写入风险较高，大改动需要更强推理 |
| 涉及敏感文件（config、安全相关、数据库migration） | Pro | 高风险操作 |
| Checkpoint 审查、代码 review | Pro | 需要深度分析能力 |
| Plan 制定、架构决策 | Pro | 复杂推理 |
| 连续 2 次工具调用失败 | 升级到 Pro（fallback） | 重试需要更强能力 |
| 意图分类为 Architecture/Refactor | Pro | 高复杂度任务 |
| 意图分类为 Simple | Flash | 低复杂度 |
| 用户明确要求 Pro/Flash | 用户指定 | 尊重用户选择 |

**2. 路由记录格式**

```typescript
interface RouteDecision {
  turnId: string
  selectedModel: 'flash' | 'pro'
  reason: string        // 触发路由决策的原因
  riskLevel: 'low' | 'medium' | 'high'
  fallbackFrom?: string // 如果是从 Flash fallback 来的
  timestamp: number
}
```

Route reason 被持久化到 session 数据中（可通过 SessionEvent 记录），用于事后分析和调试。

**3. 实现位置**

修改点：`packages/core/src/session/runner/model.ts`（SessionRunnerModel）

```typescript
// 在每个 Provider Turn 开始时：
// 1. 检查当前上下文（待执行工具、意图分类结果、历史失败次数）
// 2. 根据路由规则选择 Flash 或 Pro
// 3. 发布 RouteDecided 事件（记录 reason）
// 4. 将选定 model 传入 LLM stream request
```

**4. Provider 配置**

在 opencode.json 中支持配置双模型：
```json
{
  "deepcode": {
    "flashModel": "deepseek-v4-flash",
    "proModel": "deepseek-v4-pro",
    "routing": {
      "autoUpgradeOnFailure": true,
      "highRiskPatterns": ["*.sql", "migrations/*", "config/*"],
      "proForLargeWrites": true
    }
  }
}
```

---

## 模块四：Reasoning Content 管理

### 问题分析

DeepSeek V4 支持 Thinking Mode：
- `reasoning_effort: high/max` 控制推理深度
- 模型返回 `<think>...</think>` 或 reasoning_content 字段
- 工具调用轮次中，API **要求回传 reasoning_content** 才能维持思考连续性
- 但 reasoning 内容冗长（可能数千 token），长期回灌会浪费上下文窗口，且在后续轮次中被注意力稀释

论文 I-14（Reasoning Content Stripping）的核心原则：**Reasoning 用于 display/archive，不长期回灌 prompt**。

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 兼容性 | 推荐度 |
|------|---------|-------|-------|-------|
| A | 完全丢弃 reasoning_content | 极低 | 差—工具调用轮次会丢失思考连续性 | ⭐ |
| B | 完整回灌 reasoning_content（当前默认行为） | 无 | 高 | ⭐ |
| C | 当前工具调用轮次回传完整 reasoning，后续轮次只保留摘要；非工具轮次剥离展示 | **中** | **高—遵守API协议，同时节省上下文** | ⭐⭐⭐ |

### 选型：路径 C

### 设计详情

**1. Reasoning Content 生命周期**

```
Provider Turn N（工具调用）:
  → 模型返回 answer + reasoning_content + tool_calls
  → reasoning_content 持久化到 DB（用于展示/归档）
  → 向用户展示 reasoning（折叠/展开）
  → 同一 turn 的 tool_result 回传时，附带完整 reasoning_content（API 要求）

Provider Turn N+1（收到 tool_result 后继续）:
  → 历史中 Turn N 的 reasoning_content 被替换为摘要（1-3 句话）
  → 摘要格式："[之前推理: 分析了X, 决定执行Y, 预期Z]"
  → 新的 reasoning_content 完整回传

Provider Turn M（非工具调用，纯文本回复后）:
  → reasoning_content 不进入历史，仅持久化到 DB
```

**2. 摘要规则**

- 工具调用推理摘要："[推理摘要: 分析了{文件/问题}, 决定{调用什么工具}, 原因是{关键理由}]"
- 摘要控制在 50 tokens 以内
- 用户可通过配置选择摘要详细程度

**3. 实现位置**

- `packages/core/src/session/runner/to-llm-message.ts`：消息投影到 LLM 格式时，处理 reasoning 内容
- `packages/core/src/session/message-v2.ts`：消息 schema 支持 reasoning 字段
- reasoning_content 持久化在 session_message 表中（已有字段，确认现状）
- 摘要逻辑在历史投影（SessionHistory）阶段执行

**4. reasoning_effort 控制**

- 简单任务（Simple 意图）：默认不启用 thinking 或 low effort
- 复杂任务（Architecture/Refactor）：high effort
- Checkpoint 审查：max effort
- Flash 模型默认不启用深度 thinking，Pro 模型默认 high

---

## 模块五：7+1 意图路由

### 问题分析

不同类型的任务需要不同的执行策略。对"帮我把 import 排序一下"和"帮我从零设计一个微服务架构"使用相同的审查深度和计划粒度是浪费的。论文 I-08 提出 7+1 意图分类：

7 种任务类型：Refactor, New, Medium, Architecture, Research, Simple, Collaboration
+1 兜底：Spec-Driven（当 OpenSpec 存在时走 spec 流程）

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 准确度 | 推荐度 |
|------|---------|-------|-------|-------|
| A | Prompt-based 分类：在初始 prompt 后加分类指令，让模型自己判断 | 低 | 中—依赖模型判断 | ⭐⭐ |
| B | Code-based 匹配：关键词+正则+文件模式匹配 | 中 | 中—规则硬编码，覆盖不全 | ⭐⭐ |
| C | Hybrid：代码规则快速拦截简单/明确的 case，prompt-based 分类剩余 case | **中** | **高—两者互补** | ⭐⭐⭐ |

### 选型：路径 C

### 设计详情

**1. 意图定义与策略绑定**

| 意图 | 识别特征 | 面谈策略 | Plan 粒度 | 审查严格度 | 默认模型 |
|------|---------|---------|----------|-----------|---------|
| Simple | "排序import" "修个typo" | 无面谈 | 无 Plan，直接执行 | 无审查 | Flash |
| Refactor | "重构X" "重写Y" | 确认重构范围 | 粒度细(5-10步) | 高(每个checkpoint) | Pro |
| New | "从零创建X" "新建项目" | 深度面谈(需求澄清) | 完整Plan+OKR级联 | 中(关键节点) | Pro |
| Medium | "添加功能X" "修bug Y" | 简单确认 | 中等粒度(3-5步) | 中 | Flash→Pro |
| Architecture | "设计X架构" "技术选型" | 深度面谈+方案对比 | 粗粒度(模块级) | 极高(强制review) | Pro(max) |
| Research | "调研X" "分析Y" | 确认范围 | 无Plan(探索性) | 低 | Flash |
| Collaboration | 多文件/多人协作 | 协调确认 | 分模块 | 高 | Pro |
| Spec-Driven | 目录下有 openspec/ | 走OpenSpec流程 | 按change/tasks | 按spec规则 | 视复杂度 |

**2. 分类器实现**

```typescript
// 位置：packages/deepcode/src/intent-router/classifier.ts
type Intent = 'simple' | 'refactor' | 'new' | 'medium' | 'architecture' | 'research' | 'collaboration' | 'spec-driven'

interface IntentClassification {
  intent: Intent
  confidence: number  // 0-1
  reason: string      // 分类依据
  strategy: IntentStrategy  // 绑定的执行策略
}
```

Code-based 快速规则（高置信度直接判定）：
- 包含 "重构/refactor" → Refactor
- 包含 "从零/新建/从头/create from scratch" → New
- 包含 "排序/typo/格式化" → Simple
- 包含 "设计/架构/选型/architecture" → Architecture
- 工作目录有 `openspec/changes/` → Spec-Driven

剩余 case 用 prompt-based 分类（在第一个 Provider Turn 之前做一次）。

**3. 策略绑定机制**

分类结果存储在 session metadata 中，影响：
- Byte-Stable Prefix 中注入当前意图的执行指南
- Flash/Pro 路由决策
- Review/Checkpoint 频率
- Plan 粒度
- 是否触发 brainstorming skill

**4. 新意图降级**

未匹配到任何已知意图时，默认策略：Medium 意图的保守版本（面谈确认+Flash+低审查度），确保安全。

---

## 模块六：Agent 免疫系统

### 问题分析

LLM Agent 在执行过程中经常"遗忘"之前的约束。例如用户说"修改前先备份"，Agent 在第 5 步可能直接修改文件而忘记备份。论文 I-01（Agent 免疫系统）提出：执行完成后独立审查，发现约束违反则固化为 Skill 防止未来重犯。

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 审查质量 | 推荐度 |
|------|---------|-------|---------|-------|
| A | 每个 tool use 后立即审查（细粒度） | 高 | 高—但延迟大，打断执行流 | ⭐⭐ |
| B | 每个 checkpoint（完成一组相关操作后）审查 | **中** | **高—平衡延迟和覆盖** | ⭐⭐⭐ |
| C | 任务结束时一次性审查 | 低 | 中—发现太晚，已造成损害 | ⭐ |

### 选型：路径 B（Checkpoint 级审查）

### 设计详情

**1. 审查触发时机**

- 每个 PlanStep 完成后（自然 checkpoint）
- 用户 prompt 中包含硬约束后的首次写入操作后
- 连续 3 次工具调用后（防止 Agent 跑偏太远）
- Agent 声明任务完成时（最终审查）

**2. 审查机制**

```typescript
// 位置：packages/deepcode/src/immune-system/reviewer.ts
// 审查方式：spawn 一个独立的 review turn（不影响主执行流）
// 输入：
//   - 原始硬约束列表
//   - 本轮产出物（写入的文件、执行的操作）
//   - 不读取执行日志（避免上下文膨胀）
// 输出：
//   - violatedConstraints: Violation[]  // 违反的约束列表
//   - suggestedSkills: SkillSpec[]      // 建议固化的 Skill
```

审查流程：
1. 收集本轮 checkpoint 后的产出物快照（修改了哪些文件）
2. 构建审查 prompt："以下约束是否被遵守？检查这些产出物..."
3. 使用 Pro 模型执行一次独立的 LLM 调用（不在主 agent loop 中）
4. 解析审查结果，发现违规则：
   a. 向用户报告（Mid-Conversation System Message）
   b. 将违规模式转化为可执行 Skill
   c. 注册该 Skill 到后续执行流（自动触发）

**3. Skill 固化格式**

```yaml
# 自动生成的 Skill 文件（.opencode/skills/immune-{timestamp}.md）
---
name: immune-backup-check
description: 自动检查写操作前是否已备份
trigger:
  - before: [write, edit, apply_patch]
condition: |
  检查目标文件是否存在 .bak 备份，
  或 git status 是否有该文件的已提交版本
action: |
  如果未备份，先执行 cp {file} {file}.bak
---
```

**4. 与 SuperPowers Skill 系统整合**

固化的 Skill 遵循 SuperPowers 的 skill 格式，存放在项目 `.opencode/skills/` 目录下，自动被 OpenCode 的 skill 系统加载。

**5. 免疫记忆**

已发现并修复的违规模式记录在 session-local 的免疫库中，跨 session 可持久化为全局配置。

---

## 模块七：双向 Agent（LLM ⇄ Harness 协同决策）

### 问题分析

标准 Agent Loop 是单向的：Harness 发 prompt → LLM 回复 → Harness 执行 tool → 循环。LLM 无法主动声明"我需要更多上下文""我想要更强大的模型""我需要自我审查""我想创建一个新 Skill"。论文 I-02 提出四个元原语：

1. `need_more_context`：LLM 声明需要额外文件/信息
2. `request_specialized_model`：LLM 声明需要切换到更强/更专业的模型
3. `trigger_self_review`：LLM 声明要对刚才的工作做自我审查
4. `propose_skill`：LLM 提议将一个常用模式固化为 Skill

### 技术路径对比

| 路径 | 方案简述 | 改造量 | 与现有协议兼容 | 推荐度 |
|------|---------|-------|--------------|-------|
| A | 作为特殊 tool_calls（LLM 调用特殊 tool，Harness 拦截） | **低** | **高—tool_calls 是标准协议** | ⭐⭐⭐ |
| B | 新增独立的 meta channel（响应中增加 meta 字段） | 高 | 低—需要修改 LLM 协议层 | ⭐ |
| C | 用特殊格式的文本标记（如 [NEED_CONTEXT: ...]） | 低 | 中—解析脆弱 | ⭐ |

### 选型：路径 A（Tool-call 形式的元原语）

### 设计详情

**1. 四个元原语注册为特殊工具**

```typescript
// 这些工具不出现在模型的工具 catalog 中（对模型"不可见"），
// 但 LLM 可以通过调用它们触发 harness 行为。
// 实际上是注册为普通工具但标记为 "meta": true，
// Harness 拦截后执行 harness 逻辑而非作为普通 tool。

const metaDirectives = {
  need_more_context: {
    description: "声明需要查看更多上下文文件或信息",
    parameters: {
      files: ["string"],       // 需要读取的文件路径列表
      search_terms: ["string"], // 需要搜索的关键词
      reason: "string"          // 为什么需要
    }
  },
  request_specialized_model: {
    description: "请求切换到更强或更专业的模型",
    parameters: {
      target: "pro" | "flash",
      reason: "string"
    }
  },
  trigger_self_review: {
    description: "触发对当前工作的自我审查",
    parameters: {
      focus: "string",  // 审查重点
      depth: "quick" | "thorough"
    }
  },
  propose_skill: {
    description: "提议将一个常用工作模式固化为可复用的 Skill",
    parameters: {
      name: "string",
      description: "string",
      trigger: "string",
      body: "string"
    }
  }
}
```

**2. Harness 响应策略**

| 原语 | Harness 行为 | 是否需要用户确认 |
|------|-------------|----------------|
| need_more_context | 自动读取指定文件/执行搜索，将结果注入下一轮上下文 | 否（自动满足） |
| request_specialized_model | 检查合理性（不能无限升级），记录 reason，切换模型 | 否（自动，但有上限） |
| trigger_self_review | 触发模块六的免疫审查（使用 Pro 模型） | 否（自动） |
| propose_skill | 验证 Skill 格式和安全性，注册到临时 skills，用户确认后持久化 | 是（持久化需确认） |

**3. 防滥用机制**

- `request_specialized_model`：每 Session 最多自动切换 5 次，超过则需用户确认
- `need_more_context`：单次最多请求 10 个文件，超过分批
- `propose_skill`：自动验证 Skill 无危险操作（如不包含 rm -rf），再提交用户确认

**4. System Prompt 注入**

在 Byte-Stable Prefix 中注入元原语的使用指南：

```
你可以通过以下工具调用来主动控制执行流程：
- need_more_context: 当你需要查看更多文件/信息时使用
- request_specialized_model: 当你遇到复杂推理需要更强模型时使用
- trigger_self_review: 当你完成一段重要工作想自我审查时使用
- propose_skill: 当你发现一个重复模式可以固化为技能时使用
```

**5. 实现位置**

- `packages/deepcode/src/meta-directives/`：四个原语的定义和 handler
- 修改 `packages/core/src/session/runner/llm.ts`：在 tool call 处理循环中识别 meta directive
- meta directive 工具注册到 ToolRegistry，标记为 internal/hidden

---

## 模块间依赖与协同

```
模块一 (Byte-Stable Prefix)
  ↓ 提供 prefix 基础设施
模块二 (硬约束注入) → 作为 ContextSource 注册到模块一的框架中
模块五 (意图路由)   → 在 prefix 中注入意图策略，影响路由
模块三 (Flash/Pro)  → 消费意图分类结果，消费原语 request_specialized_model
模块四 (Reasoning)  → 独立运作，但 reasoning 摘要影响上下文空间
模块六 (免疫系统)    → 消费硬约束列表，产出可执行 Skill；可被 trigger_self_review 触发
模块七 (双向原语)    → need_more_context 扩展上下文，request_specialized_model 触发路由，trigger_self_review 触发免疫系统，propose_skill 产生新 Skill
```

**关键调和点**：

1. **Byte-Stable Prefix vs 意图路由**：意图分类在第一次 Provider Turn 前完成，分类结果作为 Mid-Conversation System Message 注入（不修改 prefix）。意图对应的策略指南（如"你正在做Simple任务，无需过度设计"）放在 update 文本中。

2. **硬约束 vs 动态约束**：硬约束在 Session 启动时确定并注入 prefix；运行时新发现的约束通过独立 ContextSource 走 Mid-Conversation 路径。

3. **Reasoning 剥离 vs 免疫系统**：免疫系统审查只看产出物，不看 reasoning 日志，天然隔离。

4. **Flash/Pro 路由 vs 双向原语**：request_specialized_model 是路由的额外信号源，不是唯一决策点。Harness 保留最终决策权（防滥用）。

---

## 文件结构规划

```
packages/
├── core/src/
│   └── system-context/           # 无需修改，利用现有扩展点
├── deepcode/                     # 新包：DeepCode Harness 改造
│   ├── package.json
│   ├── src/
│   │   ├── index.ts              # Plugin 入口
│   │   ├── prefix-context.ts     # 模块一：Byte-Stable Prefix
│   │   ├── hard-constraint/      # 模块二：硬约束
│   │   │   ├── extractor.ts
│   │   │   ├── context-source.ts
│   │   │   └── store.ts
│   │   ├── router/               # 模块三：Flash/Pro 路由
│   │   │   ├── model-router.ts
│   │   │   ├── rules.ts
│   │   │   └── route-logger.ts
│   │   ├── reasoning/            # 模块四：Reasoning 管理
│   │   │   ├── stripper.ts
│   │   │   ├── summarizer.ts
│   │   │   └── effort-controller.ts
│   │   ├── intent-router/        # 模块五：意图路由
│   │   │   ├── classifier.ts
│   │   │   ├── strategy-table.ts
│   │   │   └── prompt-classifier.ts
│   │   ├── immune-system/        # 模块六：免疫系统
│   │   │   ├── reviewer.ts
│   │   │   ├── skill-synthesizer.ts
│   │   │   └── checkpoint-tracker.ts
│   │   └── meta-directives/      # 模块七：双向原语
│   │       ├── directives.ts
│   │       └── handlers.ts
│   └── tsconfig.json
└── opencode/
    └── src/
        └── plugin/loader.ts      # 可能需要小改以支持 deepcode 包注册
```

**改造策略**：
- 尽量在新包 `packages/deepcode/` 中实现，通过 OpenCode plugin 机制注册
- packages/core 和 packages/opencode 的修改保持最小化
- 所有新增代码包含详细中文注释
