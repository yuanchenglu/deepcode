# DeepCode 代码地图

> 最后更新：2026-07-06
> 本文档面向：产品经理（<[PLHD67_never_used_51bce0c785ca2f68081bfa7d91973934]>解业务流程）、新入职开发者（快速理解架构）、维护者（知道改哪影响哪）

---

## 一、目录结构总览

DeepCode Harness 层改造的核心代码集中在 `packages/core/src/deepcode/`。

```
packages/core/src/deepcode/
├── index.ts                          # 模块聚合导出，注册到 location-services
├── __verify__.ts                     # 纯函数验证脚本（20个测试用例）
├── prefix-context.ts                 # 模块一：Byte-Stable Prefix
├── hard-constraint/
│   ├── extractor.ts                  # 模块二：硬约束正则提取器（纯函数）
│   ├── store.ts                      # 模块二：约束会话存储（Ref）
│   └── context-source.ts             # 模块二：约束 ContextSource 注册
├── router/
│   └── model-router.ts               # 模块三：Flash/Pro 智能路由
├── reasoning/
│   └── manager.ts                    # 模块四：Reasoning 内容管理
├── intent-router/
│   └── classifier.ts                 # 模块五：7+1 意图分类器
├── immune-system/
│   └── reviewer.ts                   # 模块六：Agent 免疫系统
├── meta-directives/
│   └── handlers.ts                   # 模块七：双向 Agent 元指令
├── context-layout/
│   └── window-manager.ts             # 模块八：滑动窗口对齐 + Token 预算
└── prompt-signal/
    └── tagger.ts                     # 模块九：MoE 信号标签系统
```

### 关键修改的现有文件

| 文件 | 改动 | 影响范围 |
|------|------|---------|
| `packages/core/src/location-services.ts` | +22 行，import + 注册 10 个 DeepCode node | 所有 DeepCode 模块在此统一注册 |

---

## 二、数据流（用户输入到模型输出）

```
用户输入（文本）
    │
    ▼
┌─────────────────────────────────────────────┐
│ ① IntentClassifier.classify()               │
│    识别意图（simple/refactor/new/...）       │
│    → 绑定执行策略（审查深度/计划粒度）        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ② HardConstraintStore.extractAndAdd()       │
│    提取"不能/必须"等硬约束                   │
│    → 约束存入 Ref，通过 ContextSource 注入   │
│      Baseline Prefix（KV Cache 非压缩区）    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ③ Byte-Stable Prefix（冻结的系统指令）       │
│    + DeepCode 身份/原则/元指令/意图类型说明   │
│    + 用户硬约束                              │
│    → 整个 Context Epoch 内 byte-identical   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ④ ModelRouter.decide() 每个 Provider Turn   │
│    根据意图/风险/失败次数 → flash 或 pro     │
│    RouteDecision 记录到 history              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ⑤ SignalTagger 给关键段落打标签              │
│    [GOAL]/[CONSTRAINT]/[EXECUTION]/...       │
│    → 帮助 MoE 路由稳定 + mHC 多通道           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ⑥ LLM 调用（Flash 或 Pro）                   │
│    reasoning_effort 由 ReasoningManager 决定 │
│    返回文本 + tool_calls + reasoning_content │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────┐    ┌────────────────────────┐
│ 文本回复      │    │ 工具调用                │
│ 直接给用户    │    │ Meta 指令？→ ⑦          │
│              │    │ 普通工具？→ 执行         │
└──────────────┘    └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │ ⑧ WindowManager         │
                   │   检查 token 预算        │
                   │   reasoning 保留/剥离    │
                   │   检查滑动窗口边界       │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │ ⑨ ImmuneSystem          │
                   │   Checkpoint 处审查     │
                   │   违规 → 合成 ImmuneSkill│
                   └────────────────────────┘
```

---

## 三、关键模块详解

### 模块一：`prefix-context.ts` — Byte-Stable Prefix

**一句话职责**：注册 `deepcode/prefix` ContextSource，将 DeepCode 核心指令冻结在 Baseline System Context 中。

**为什么这样设计**：DeepSeek V4 的 Context Caching 要求前缀 byte-for-byte 一致才命中。OpenCode 的 SystemContext 机制天然支持这个——baseline 存 DB，跨进程重启复用，动态更新走 Mid-Conversation Message 而不改 prefix。

**和谁交互**：
- 被 `location-services.ts` 注册到 `SystemContextRegistry`
- 不依赖其他 DeepCode 模块（独立节点）
- 最终被 `SessionContextEpoch` 在 Session 启动时 initialize()

**改动影响点**：修改 `renderPrefix()` 函数会触发新 Context Epoch（Cache 重建），不要频繁改动。

---

### 模块二：`hard-constraint/` — 硬约束注入

**三个文件分工**：

| 文件 | 类型 | 职责 |
|------|------|------|
| `extractor.ts` | 纯函数 | `extractHardConstraints(text)` — 12 个正则模式提取禁止/必须约束；`renderConstraints(list)` — 渲染为带 ❌/✅ 标记的 Markdown |
| `store.ts` | Effect Service | 用 `Ref<HardConstraint[]>` 存储当前 session 约束，提供 add/getAll/extractAndAdd/render 方法 |
| `context-source.ts` | ContextSource 注册 | 把约束注册为 `deepcode/hard-constraints` ContextSource，每次 reconcile 时读取最新约束并渲染 |

**数据流**：用户消息 → `store.extractAndAdd()` → Ref 更新 → 下一个 Safe Provider-Turn Boundary → `context-source.load()` 读取 Ref → reconcile 检测变化 → Mid-Conversation System Message 追加新约束

**为什么分三个文件**：extractor 是纯函数（可单独测试），store 是状态管理，context-source 是 OpenCode 集成层——单一职责。

---

### 模块三：`router/model-router.ts` — Flash/Pro 路由

**一句话职责**：每个 Provider Turn 前决定用 Flash 还是 Pro，记录决策理由。

**11 条路由规则优先级**（高→低）：
1. 用户 override → 尊重用户
2. Checkpoint 审查 → Pro
3. 架构/计划讨论 → Pro
4. architecture/refactor 意图 → Pro
5. 写入高风险文件（*.sql、migrations、.env）→ Pro
6. 连续 2 次失败 → Pro（fallback）
7. new/collaboration 意图 → Flash（可升级）
8. simple/research 意图 → Flash
9. 写操作（write/edit）→ Flash（中风险）
10. 读操作（read/grep）→ Flash
11. 默认 → Flash-first

**RouteDecision 记录**：每次决策存到 history，用于事后分析（成本/准确率）。

---

### 模块四：`reasoning/manager.ts` — Reasoning 管理

**一句话职责**：控制 thinking 深度，并在历史投影时剥离/摘要 reasoning content。

**三阶段生命周期**：
- Turn N（当前工具调用轮）：完整 reasoning 回传（API 协议要求）
- Turn N+1：替换为首句+尾句摘要（~80 tokens）
- Turn N+2+：完全剥离

**effort 分配**：Flash 一律 low（参数量决定不擅长长 CoT）；Pro + architecture → max；其他 Pro → high。

---

### 模块五：`intent-router/classifier.ts` — 意图分类

**一句话职责**：从用户消息识别任务类型，绑定对应的执行策略组合。

**STRATEGY_TABLE**（核心配置）：每种意图对应 6 个维度的执行参数：
- requiresClarification（是否面谈）
- planGranularity（计划粒度：none/coarse/medium/fine）
- reviewStrictness（审查严格度）
- checkpointFrequency（审查频率）
- reasoningEffort（思考深度）
- interviewDepth（面谈深度）

**两级分类**：code-based 正则（6 条规则）+ 默认 medium 降级。正则顺序很重要（research 必须在 architecture 前，否则"调研...对比"误匹配）。

---

### 模块六：`immune-system/reviewer.ts` — 免疫系统

**一句话职责**：Checkpoint 处独立审查约束遵守情况，发现违规则自动生成 ImmuneSkill。

**审查输入**：硬约束列表 + 产出物（不读执行日志，节省 token）
**审查输出**：`ReviewResult { violations, suggestedSkills, passed }`
**Skill 合成**：根据违规类型生成纠正动作（备份类 → 自动备份；删除类 → 确认删除）

**当前版本**：规则检查（备份约束），LLM 语义审查标记为 TD-001。

---

### 模块七：`meta-directives/handlers.ts` — 双向原语

**一句话职责**：处理 LLM 主动发起的四个元指令，实现 LLM→Harness 反向通信。

| 原语 | Harness 行为 | 防滥用 |
|------|-------------|--------|
| `need_more_context` | 读指定文件（上限 10 个） | 每轮 ≤10 文件 |
| `request_specialized_model` | 切换到 Pro | 每 session ≤5 次 |
| `request_flash_model` | 切换到 Flash | 同上 |
| `trigger_self_review` | 下次 Checkpoint 触发审查 | 无限制 |
| `propose_skill` | 返回确认，需用户持久化 | 自动验证安全性 |

**回调注入模式**：fileReader 和 modelSwitcher 通过 setter 注入，不直接依赖 FileSystem/ModelRouter——解耦便于测试。

---

### 模块八：`context-layout/window-manager.ts` — Token 预算管理

**一句话职责**：基于 V4 sliding_window=128 和 index_topk 参数，提供上下文布局建议和 token 预算控制。

**四区预算模型**：
- Prefix 区：byte-stable 系统指令
- Anchor 区：最近 128 个全密度 token（sliding window）
- Active 区：当前轮对话
- Compressed 区：历史（CSA/HCA 压缩）

**关键方法**：`recommendMaxOutput()` 根据剩余预算建议最大输出 token；`compressHistory()` 在 Checkpoint 后标记可压缩历史。

---

### 模块九：`prompt-signal/tagger.ts` — MoE 信号标签

**一句话职责**：给 prompt 关键段落添加 `[SIGNAL:TYPE]...[/SIGNAL]` 标签，帮助 MoE hash routing 和 mHC 超连接稳定。

**六类信号**：GOAL（目标）、CONSTRAINT（硬约束）、EVIDENCE（证据）、EXECUTION（执行）、REVIEW（审查）、NEXT_ACTION（下一步）

**设计要点**：标签全大写 ASCII，字节稳定，不随文本措辞变化——MoE 路由的 hash 基于 token ID，稳定标签 = 稳定专家分配。

---

## 四、改动清单

### 新增文件（13 个 TS 文件，~9500 行注释+代码）

| 文件 | 行数 |
|------|-----|
| `deepcode/prefix-context.ts` | ~280 |
| `deepcode/hard-constraint/extractor.ts` | ~300 |
| `deepcode/hard-constraint/store.ts` | ~150 |
| `deepcode/hard-constraint/context-source.ts` | ~130 |
| `deepcode/router/model-router.ts` | ~370 |
| `deepcode/reasoning/manager.ts` | ~200 |
| `deepcode/intent-router/classifier.ts` | ~320 |
| `deepcode/immune-system/reviewer.ts` | ~240 |
| `deepcode/meta-directives/handlers.ts` | ~290 |
| `deepcode/context-layout/window-manager.ts` | ~430 |
| `deepcode/prompt-signal/tagger.ts` | ~350 |
| `deepcode/index.ts` | ~90 |
| `deepcode/__verify__.ts` | ~230 |

### 修改文件（1 个）

| 文件 | 改动 |
|------|------|
| `packages/core/src/location-services.ts` | +22 行：import 10 个 DeepCode node + 加入 LayerNode.group |

---

## 五、OpenCode 核心机制回顾（新入职开发者必读）

### SystemContext 是什么？

OpenCode V2 的核心抽象。一组 `ContextSource<A>` 定义独立可刷新的类型化上下文片段：
- `key`: 稳定标识（如 "deepcode/prefix"）
- `load`: 加载当前值（Effect）
- `baseline/update/removed`: 渲染函数
- SystemContext.initialize() 生成冻结的 Baseline（存 DB）
- SystemContext.reconcile() 检测变化，生成 Mid-Conversation System Message

### LocationNode 是什么？

OpenCode 的插件注册模式。每个功能模块封装为 `{ name, layer, deps }`，在 `location-services.ts` 的 `LayerNode.group([...])` 中组合。LayerNode 自动处理依赖拓扑排序和 Layer 生命周期。

### Effect 是什么？

OpenCode 使用 Effect 4.0（函数式效应框架）。`Effect<A, E, R>` 表示"可能失败（E）、需要依赖（R）、产出 A"的计算描述。`yield*` 在 `Effect.gen` 中组合 Effect，类似 async/await 但处理错误和依赖注入。
