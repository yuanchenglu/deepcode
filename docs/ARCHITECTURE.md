# DeepCode 技术架构文档

> 版本：1.0
> 更新时间：2026-07-12
> 基于 OpenCode 深度改造，专为 DeepSeek V4 优化

---

## 一、设计哲学

DeepCode 的核心设计理念：**物理特性驱动的 Harness 架构**。

传统 Coding Agent 通过 Prompt Engineering 适配模型，而 DeepCode 直接将 DeepSeek V4 的物理架构特性作为一等设计约束：

| 物理特性 | 架构响应 |
|---------|---------|
| CSA（4x 压缩稀疏注意力） | 四区上下文布局、Token 预算管理 |
| HCA（128x 重度压缩注意力） | Review 防漂移对数级补偿、硬约束前缀注入 |
| 1M Context Window + Prefix Cache | Byte-Stable Prefix 架构、Signal 标签字节稳定 |
| Flash/Pro 双模型路由 | 意图感知的智能路由、风险等级升级机制 |
| MoE Hash Routing（前3层） | 固定顺序 Signal 标签、稳定 token ID |
| mHC 多通道超连接（hc_mult=4） | 六类信号四通道映射 |
| Reasoning Content（thinking mode） | 三阶段剥离策略、摘要生命周期管理 |

---

## 二、系统分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         入口层 (Entry Points)                   │
├─────────────────────────────────────────────────────────────────┤
│  CLI  │  TUI  │  Desktop App  │  Web UI  │  HTTP API Gateway     │
│       │       │               │          │  (飞书/微信 Webhook)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Session 运行时 (Session Runtime)              │
├─────────────────────────────────────────────────────────────────┤
│  SessionV2.prompt/resume  │  SessionRunner  │  Tool Call Loop    │
│  Context Epoch 管理       │  Provider Turn 边界处理               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               DeepCode Harness 层（14个核心模块）                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Prefix & Cache 子系统                                   │   │
│  │  ├─ Byte-Stable Prefix        启动冻结、Mid-Convo 消息   │   │
│  │  ├─ Hard Constraint Inject    硬约束提取、前缀注入       │   │
│  │  └─ Prompt Signal Tagger      mHC 标签、Hash 路由稳定    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Routing & Intent 子系统                                 │   │
│  │  ├─ Flash/Pro Model Router   风险感知、自动升级          │   │
│  │  ├─ 7+1 Intent Router        8类意图、策略矩阵           │   │
│  │  └─ OKR+PlanStep Cascade     三级计划、级联修正          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Context & Memory 子系统                                 │   │
│  │  ├─ Context Window Manager   四区预算、滑动窗口对齐      │   │
│  │  ├─ Reasoning Content Mgr    三阶段剥离、摘要替换        │   │
│  │  └─ Memory Granularity       三级记忆、λ值衰减、主动遗忘 │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Safety & Evolution 子系统                               │   │
│  │  ├─ Immune System Reviewer    约束审查、抗体 Skill 生成   │   │
│  │  ├─ Scope Creep Guard         范围防护、工具调用拦截     │   │
│  │  ├─ Review Anti-Drift         对数补偿、原点回拉         │   │
│  │  ├─ Skill Evolution Loop      自进化闭环、Checkpoint 审查│   │
│  │  └─ Meta-Directives (4+1)     need_more_context 等原语   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode 核心基础设施                         │
├─────────────────────────────────────────────────────────────────┤
│  System Context  │  Plugin System  │  Tool Registry             │
│  Effect Layer    │  Ref/STM 状态   │  Drizzle SQLite            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    外部集成                                      │
├─────────────────────────────────────────────────────────────────┤
│  DeepSeek V4 API  │  文件系统  │  Shell/PTY  │  Git  │  飞书/微信 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、核心数据流

### 3.1 用户消息处理管线

```
用户消息
   │
   ├─→ IntentRouter.classify()
   │     └─ 正则匹配 → Simple/Medium/Refactor/New/Arch/Research/Collab/Spec
   │     └─ STRATEGY_TABLE → 面谈深度/计划粒度/审查严格度/reasoning_effort
   │
   ├─→ ConstraintStore.extractAndAdd()
   │     └─ 12个中文正则模式 → forbid/require/never/always
   │     └─ 去重后存入 Ref
   │
   ├─→ MemoryGranularity.setMode()
   │     └─ converge/balanced/diverge 三模式
   │     └─ λ 值（记忆强度）按意图配置
   │
   ├─→ ModelRouter.decide()
   │     └─ 11条优先级规则 → flash/pro
   │     └─ Checkpoint/Plan/高风险文件/失败重试 → <[SPEAK_never_used_51bce0c785ca2f68081bfa7d91973934]>
   │     └─ Route Decision 记录到历史
   │
   ├─→ OKRPlan.createPlan() [非 Simple 任务]
   │     └─ Objective → KeyResults → PlanSteps
   │     └─ 链式依赖、状态机 (pending→in_progress→done→verified)
   │
   ├─→ WindowManager.setZoneText()
   │     └─ 3字符/token 估算
   │     └─ prefix/anchor/active/compressed/tail 五区计数
   │
   └─→ SystemContext 组装
         ├─ Baseline Prefix（byte-stable，启动时冻结）
         │   ├─ DeepCode 身份标识
         │   ├─ 四大核心承诺
         │   └─ 元指令使用说明
         ├─ 动态 Context Sources（Mid-Conversation 更新）
         │   ├─ hard-constraints（硬约束注入 prefix 区）
         │   ├─ core/date, core/environment
         │   └─ skills/okr/memory 等
         └─ SignalTagger.buildSignalBlock()
               └─ 固定顺序：goal→constraint→evidence→execution→review→next
               └─ 字节稳定输出 → MoE Hash 路由稳定
```

### 3.2 Tool Call 执行循环

```
LLM 返回 Tool Call
   │
   ├─→ ScopeCreepGuard.checkToolAccess()
   │     ├─ 只读工具 → 放行
   │     ├─ allowedFiles 内 → 放行
   │     ├─ approvedOptionals → 放行（BUG-004修复：glob匹配）
   │     ├─ readonlyFiles → 标记 required，需确认
   │     └─ 其他 → 分类 required/optional/unrelated
   │
   ├─→ MetaDirectives.intercept()
   │     └─ need_more_context → 回调读文件/搜索
   │     └─ request_specialized_model → 切换模型
   │     └─ trigger_self_review → 标记 checkpoint
   │     └─ propose_skill → SkillEvolution.solidifySkill()
   │
   ├─→ 执行实际工具（read/write/shell/grep...）
   │
   ├─→ MemoryGranularity.addWorking()
   │     └─ 工具结果存入工作记忆
   │     └─ 默认 3 turn 后过期
   │
   ├─→ ReviewAntiDrift.recordToolCall()
   │     └─ K++（tool 轮次计数）
   │     └─ tier = min(4, floor(ln(K+1) * (1 + P/12)))
   │     └─ tier 升高或 =4 → 触发审查
   │
   ├─→ ModelRouter.recordFailure() [失败时]
   │     └─ failureCount++ → 达到阈值升级 Pro
   │
   └─→ Checkpoint 触发条件满足时
         ├─→ ImmuneSystem.reviewCheckpoint()
         │     └─ 约束 vs 产物比对（当前：备份规则）
         │     └─ 违规 → synthesizeSkill() → 抗体生成
         │
         ├─→ SkillEvolution.createCheckpoint(turn=N)
         │     └─ 结构化快照（不存过程日志）
         │     └─ 逐轮递减上下文策略（前5轮100%，第10轮50%）
         │     └─ buildReviewPrompt → 独立审查子 Agent
         │
         ├─→ OKRPlan.advanceToNext() / evaluateKRs()
         │     └─ 步骤推进、KR 达成评估
         │     └─ done 且 KR met → verified
         │
         ├─→ MemoryGranularity.endStep()
         │     └─ 过期工作记忆：λ>0.5 提升为情景记忆（λ*0.8）
         │     └─ 冷记忆（>20 turn compressed）→ 清理（BUG-009修复）
         │     └─ 返回 promoted/discarded/pruned 统计
         │
         └─→ WindowManager.compressHistory()
               └─ active 区 → compressed 区
               └─ anchor 更新为 checkpoint 摘要
```

### 3.3 KV Cache 命中保障链

```
┌─────────────────────────────────────────────────────────────┐
│ Byte-Stable Prefix                                          │
│ ├─ renderPrefix() 是纯函数（无 Date.now/Math.random）       │
│ ├─ load() 返回 Effect.succeed(immutableText)               │
│ ├─ ContextSource.baseline = (text) => text                 │
│ └─ 整个 Context Epoch 内保持 byte-identical                │
├─────────────────────────────────────────────────────────────┤
│ Mid-Conversation Updates Only                               │
│ ├─ 硬约束新增 → update() 返回新约束文本                     │
│ ├─ OpenCode 自动发射 Mid-Conversation System Message        │
│ └─ Baseline Prefix 文本本身永不变（Epoch 重建才会变）        │
├─────────────────────────────────────────────────────────────┤
│ Signal Tag Byte Stability                                  │
│ ├─ buildSignalBlock() 固定顺序输出                          │
│ ├─ 标签文本全大写 ASCII（GOAL/CONSTRAINT/EVIDENCE/...）     │
│ └─ Tokenizer 跨语言一致 → Hash Routing 稳定                 │
├─────────────────────────────────────────────────────────────┤
│ Hard Constraints In Prefix Zone                             │
│ ├─ forbid/require 注入 deepcode/hard-constraints source    │
│ ├─ 位于 prefix 区（非压缩区）                               │
│ └─ 不受 CSA/HCA 压缩影响，注意力 100%                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、模块依赖拓扑

```
Layer 0（无依赖，基础服务）
  ├─ DeepCodeConstraintStoreNode      内存 Ref 存储
  ├─ DeepCodeModelRouterNode          无外部依赖
  ├─ DeepCodeIntentRouterNode         无外部依赖
  ├─ DeepCodeWindowManagerNode        无外部依赖
  ├─ DeepCodeSignalTaggerNode         纯函数无状态
  ├─ DeepCodeOKRPlanNode              无外部依赖
  ├─ DeepCodeReviewAntiDriftNode      无外部依赖
  ├─ DeepCodeScopeCreepGuardNode      无外部依赖
  ├─ DeepCodeSkillEvolutionNode       无外部依赖
  └─ DeepCodeMemoryGranularityNode    无外部依赖

Layer 1（依赖 Layer 0）
  ├─ DeepCodeReasoningManagerNode     （无外部服务依赖）
  ├─ DeepCodeImmuneSystemNode         （无外部服务依赖）
  └─ DeepCodeConstraintContextNode    → ConstraintStore + Registry

Layer 2（依赖 Layer 1 + SystemContextRegistry）
  ├─ DeepCodePrefixNode               → Registry
  └─ DeepCodeMetaDirectivesNode       （回调注入，无静态依赖）

Layer 3（集成层，非 LocationNode）
  └─ SessionRunner 钩子、Plugin 注册、Tool 拦截器
     这些在 OpenCode 插件层组合上述服务
```

---

## 五、关键设计决策

| 决策 | 选择 | 否决方案 | 理由 |
|------|------|---------|------|
| ContextSource vs chat.system.transform | ContextSource V2 API | legacy transform hook | 获得 DB 持久化、cross-restart 复用、Mid-Conversation Message 等基础设施 |
| 硬约束提取：正则 vs LLM | 先正则后 LLM 增强 | 纯 LLM 提取 | 确定性、零延迟、零 token 成本，覆盖 90% 场景 |
| 路由策略：硬编码规则 vs 模型自判 | 11条优先级硬规则 | 让 LLM 自己选 | 可解释、可调试、无额外推理成本、故障可复现 |
| Skill 存储：Ref vs 磁盘 | 当前 Ref（内存） | 直接写文件 | 进程重启丢失可接受（session-scoped），TODO 持久化 |
| 元指令形式：tool_call vs meta 字段 | tool_call 形式 | 新增协议字段 | 兼容现有 Tool Registry，无需改 Provider 协议 |
| 记忆衰减：固定 turn vs λ 值 | λ∈[0,1] 连续值 | 布尔开关 | 不同意图有不同记忆需求，细粒度控制 |
| Review 触发：固定频率 vs f(K,P) | 对数级函数 | 每 N 步固定 | 符合 HCA=128x 注意力稀释的物理定律 |

---

## 六、目录结构

```
packages/core/src/deepcode/
├── index.ts                    # 模块导出索引、LocationNode 导出
├── prefix-context.ts           # 模块1：Byte-Stable Prefix
├── hard-constraint/
│   ├── extractor.ts            #   正则提取器、渲染函数（纯函数）
│   ├── store.ts                #   Ref 存储服务
│   └── context-source.ts       #   ContextSource 注册
├── router/
│   └── model-router.ts         # 模块3：Flash/Pro 智能路由
├── reasoning/
│   └── manager.ts              # 模块4：Reasoning Content 管理
├── intent-router/
│   └── classifier.ts           # 模块5：7+1 意图分类
├── immune-system/
│   └── reviewer.ts             # 模块6：Agent 免疫系统
├── meta-directives/
│   └── handlers.ts             # 模块7：双向 Agent 原语
├── context-layout/
│   └── window-manager.ts       # 模块8：滑动窗口对齐 + Token预算
├── prompt-signal/
│   └── tagger.ts               # 模块9：Prompt 信号标签
├── okr-plan.ts                 # 模块10：OKR+PlanStep 级联
├── review-anti-drift.ts        # 模块11：Review 切换防漂移
├── scope-creep-guard.ts        # 模块12：Scope Creep 防护
├── skill-evolution.ts          # 模块13：Skills 自进化 + Checkpoint审查
└── memory-granularity.ts       # 模块14：记忆粒度分层
```

---

## 七、飞书/微信网关架构（规划）

```
packages/deepcode-gateway/
├── src/
│   ├── index.ts                # 包入口
│   ├── message-types.ts        # 统一消息模型
│   ├── platform-adapter.ts     # PlatformAdapter 接口
│   ├── http-server.ts          # HTTP Webhook Server
│   ├── event-router.ts         # 事件分发路由
│   ├── session-bridge.ts       # 平台消息 ↔ OpenCode Session 桥接
│   ├── adapters/
│   │   ├── feishu.ts           # 飞书适配器
│   │   └── wecom.ts            # 企业微信适配器
│   └── plugin.ts               # OpenCode Plugin 注册
```

**消息流：**
```
飞书/微信 用户消息
    ↓ HTTP Webhook
HTTP Server（签名验证）
    ↓
Event Router → PlatformAdapter.parseMessage()
    ↓ 统一消息格式
Session Bridge.findOrCreateSession()
    ↓
OpenCode Session.prompt() → 正常 DeepCode 处理管线
    ↓
PlatformAdapter.sendMessage() → 飞书/微信 API
    ↓
用户收到回复
```

---

*文档维护者：DeepCode 团队*
