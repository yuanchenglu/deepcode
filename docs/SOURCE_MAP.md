# DeepCode 源码地图

> 生成时间：2026-07-12
> 项目规模：6706 个 TypeScript 文件
> 核心改造模块：packages/core/src/deepcode/（14 个模块）

---

## 一、项目整体架构

DeepCode 基于 OpenCode（anomalyco/opencode）深度改造，采用分层架构：

```
┌─────────────────────────────────────────────────────────┐
│  CLI / TUI / Desktop / Web / HTTP API                    │  ← 入口层
├─────────────────────────────────────────────────────────┤
│  packages/opencode/src/                                  │  ← Agent 核心循环
│    ├── session/          Session 管理、Prompt 组装        │
│    ├── context/          System Context、Context Source   │
│    ├── provider/         Provider 层、模型路由            │
│    └── tool/             Tool Registry、内置工具          │
├─────────────────────────────────────────────────────────┤
│  packages/core/src/                                      │  ← 领域核心
│    ├── deepcode/         ★ DeepCode Harness 14个模块      │
│    ├── system-context/   Context Source 基础设施          │
│    ├── location-*.ts     Location 服务组合                │
│    ├── plugin/           插件系统                         │
│    └── config/           配置管理                         │
├─────────────────────────────────────────────────────────┤
│  packages/schema/    类型定义                             │
│  packages/protocol/  HTTP/WS 协议                         │
│  packages/effect-*/  Effect 生态基础设施                  │
└─────────────────────────────────────────────────────────┘
```

---

## 二、DeepCode Harness 模块清单（14 个）

### Saber 9 模块（核心七大模块 + 两个增强模块）

| 编号 | 模块名称 | 文件路径 | 论文编号 | 核心类/函数 | 代码行数 | 状态 |
|------|---------|---------|---------|------------|---------|------|
| 1 | Byte-Stable Prefix | `prefix-context.ts` | I-13 | `renderPrefix()`、`prefixSource` | 218 | ✅ 完整 |
| 2 | 硬约束前缀注入 | `hard-constraint/extractor.ts` | I-04 | `extractHardConstraints()`、`renderConstraints()` | 258 | ✅ 完整 |
|  |  | `hard-constraint/store.ts` |  | `DeepCodeConstraintStore` | 141 | ✅ 完整 |
|  |  | `hard-constraint/context-source.ts` |  | ContextSource 注册 | 130 | ⚠️ 有Bug(require) |
| 3 | Flash/Pro 智能路由 | `router/model-router.ts` | I-10 | `decideRoute()`、`DeepCodeModelRouter` | 418 | ✅ 完整 |
| 4 | Reasoning 管理 | `reasoning/manager.ts` | I-14 | `summarizeReasoning()`、`getEffort()` | ~210 | ⚠️ 配置硬编码 |
| 5 | 7+1 意图路由 | `intent-router/classifier.ts` | I-10 | `codeClassify()`、`STRATEGY_TABLE` | ~300 | ✅ 完整 |
| 6 | Agent 免疫系统 | `immune-system/reviewer.ts` | I-01 | `reviewCheckpoint()`、`synthesizeSkill()` | 257 | ⚠️ Skill重复 |
| 7 | 双向 Agent 原语 | `meta-directives/handlers.ts` | I-02 | 4个元指令处理器 | ~270 | ⚠️ 功能未完整 |
| 8 | 滑动窗口 + Token预算 | `context-layout/window-manager.ts` | I-03 | `getWindowStatus()`、`compressHistory()` | 439 | ⚠️ 注释不一致 |
| 9 | Prompt 信号标签 | `prompt-signal/tagger.ts` | I-04 | `tagSignal()`、`buildSignalBlock()` | 289 | ✅ 完整 |

### Raptor 5 模块（论文 I-06 ~ I-12 补全）

| 编号 | 模块名称 | 文件路径 | 论文编号 | 核心类/函数 | 代码行数 | 状态 |
|------|---------|---------|---------|------------|---------|------|
| 10 | OKR+PlanStep 级联 | `okr-plan.ts` | I-06 | `createPlan()`、`cascade()`、`evaluateKRs()` | 524 | ⚠️ 有2个Bug |
| 11 | Review 切换防漂移 | `review-anti-drift.ts` | I-07 | `computeTier()`、`buildReviewPrompt()` | 308 | ⚠️ 未集成 |
| 12 | Scope Creep 防护 | `scope-creep-guard.ts` | I-08 | `checkToolAccess()`、`classifyDependency()` | 474 | ⚠️ glob匹配Bug |
| 13 | Skills 自进化闭环 | `skill-evolution.ts` | I-09/I-11 | `solidifySkill()`、状态机、Checkpoint审查 | 661 | ⚠️ turn硬编码Bug |
| 14 | 记忆粒度分层 | `memory-granularity.ts` | I-12 | 三级记忆管理、`extractForCompaction()` | 475 | ⚠️ endStep统计Bug |

---

## 三、核心模块源码索引

### 3.1 System Context 基础设施

| 文件 | 功能 |
|------|------|
| `system-context/index.ts` | System Context 代数定义：Source<A>、Key、Snapshot、make/combine/initialize/reconcile |
| `system-context/registry.ts` | Location 级 ContextSource 注册中心，管理所有 ContextSource 的生命周期 |
| `system-context/builtins.ts` | 内置 ContextSource：core/date、core/environment、core/instructions |

### 3.2 Location 服务组合

| 文件 | 功能 |
|------|------|
| `location-services.ts` | Location 服务节点清单，LayerNode.group 拓扑排序组装所有服务（含 DeepCode 14节点） |
| `location-service-map.ts` | LocationServiceMap 定义，跨 Location 服务发现 |
| `effect/app-node.ts` | makeLocationNode：Location 级服务的标准包装器 |
| `effect/layer-node.ts` | LayerNode.group/hoist/compile：依赖拓扑排序和 Layer 组装 |

### 3.3 Session 运行时

| 文件 | 功能 |
|------|------|
| `session/runner/llm.ts` | LLM 调用循环：Provider Turn 边界处理、Tool 执行 |
| `session/runner/model.ts` | 模型解析和选择 |
| `session/todo.ts` | Todo 列表管理 |
| `session.ts` | Session 核心逻辑、prompt/resume |

### 3.4 插件系统

| 文件 | 功能 |
|------|------|
| `plugin.ts` | Plugin 接口定义和加载 |
| `plugin/internal.ts` | 内置插件加载 |

---

## 四、DeepCode 模块依赖关系图

```
                              ┌──────────────────┐
                              │ SystemContextReg │
                              └────────┬─────────┘
                                       │ register()
        ┌──────────────────┬───────────┼───────────┬──────────────────┐
        │                  │           │           │                  │
┌───────▼──────┐   ┌───────▼──────┐   │    ┌──────▼───────┐   ┌──────▼───────┐
│ PrefixNode   │   │ ConstraintSt │   │    │ WindowMgr    │   │ SignalTagger │
│ (byte-stable)│   │ ore+Context  │   │    │ (token预算)   │   │ (mHC标签)    │
└──────────────┘   └───────┬──────┘   │    └──────────────┘   └──────────────┘
                           │          │
        ┌──────────────────┼──────────┼──────────────────────────────┐
        │                  │          │                              │
┌───────▼──────┐   ┌───────▼──────┐  │  ┌──────────────────┐ ┌──────▼───────┐
│ ModelRouter  │   │ IntentRouter │  │  │ ImmuneSystem     │ │ ReasoningMgr │
│ (flash/pro)  │   │ (7+1分类)    │  │  │ (checkpoint审查) │ │ (思维链剥离) │
└───────┬──────┘   └───────┬──────┘  │  └────────┬─────────┘ └──────┬───────┘
        │                  │         │           │                  │
        └──────────────────┼─────────┼───────────┼──────────────────┘
                           │         │           │
                    ┌──────▼──────┐  │  ┌────────▼─────────┐
                    │ MetaDirec-  │  │  │ ScopeCreepGuard  │
                    │ tives(4原语)│  │  │ (范围蔓延防护)   │
                    └─────────────┘  │  └──────────────────┘
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        │                             │                              │
┌───────▼──────┐   ┌──────────────────▼───┐   ┌──────────────────┐ ┌─▼──────────────┐
│ OKRPlan      │   │ ReviewAntiDrift      │   │ SkillEvolution   │ │ MemoryGranular-│
│ (级联计划)   │   │ (注意力稀释补偿)      │   │ (自进化+快照)    │ │ ity(三级记忆)  │
└──────────────┘   └──────────────────────┘   └──────────────────┘ └────────────────┘
```

---

## 五、关键数据流

### 5.1 用户消息处理流程

```
用户消息 → IntentRouter.classify() → 意图识别+策略绑定
         → ConstraintStore.extractAndAdd() → 提取硬约束
         → MemoryGranularity.setMode() → 设置记忆λ值
         → OKRPlan.createPlan() → 非simple任务创建计划
         → ModelRouter.decide() → Flash/Pro 路由
         → WindowManager 计算token预算 → 确定上下文布局
         → SystemContext 组装 → Baseline Prefix + Mid-Convo Msg
         → LLM 调用（带SignalTagger标签）
         → MetaDirectives 拦截特殊tool_call
         → ScopeCreepGuard.checkToolAccess() → 工具调用前检查
         → ImmuneSystem/ReviewAntiDrift → Checkpoint触发审查
         → SkillEvolution.solidifySkill() → 错误学习为Skill
         → MemoryGranularity.endStep() → 记忆衰减/提升
```

### 5.2 KV Cache 命中保障

1. Baseline System Context 启动时渲染一次 → `prefixSource.baseline()`
2. Prefix 文本是纯函数 `renderPrefix()` → 无 Date.now()/随机数
3. 动态变更（新增约束/计划更新）→ Mid-Conversation System Message
4. SignalTag 固定顺序 → byte-stable 输出
5. 硬约束注入 prefix 区 → CSA/HCA 压缩不影响

---

## 六、技术栈与依赖

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript 5.x |
| 运行时 | Bun |
| 效应框架 | Effect-TS（Layer/Effect/Ref/Context） |
| ORM | Drizzle ORM（effect-drizzle-sqlite） |
| 数据库 | SQLite |
| HTTP | Effect HttpApi |
| 测试 | Bun Test |

---

*文档维护者：DeepCode 团队
*最后更新：2026-07-12*
