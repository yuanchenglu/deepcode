# 设计自我评审

## 一、完整性检查

### 1.1 每个模块的论文要点覆盖

| 模块 | 对应论文 | 论文核心要点 | 是否覆盖 |
|------|---------|------------|---------|
| 一、Byte-Stable Prefix | I-13 | Cache-first 作为架构约束，system prompt 冻结 + turn tail 注入 | ✅ 利用 OpenCode ContextSource 机制实现冻结，Mid-Conversation 处理动态内容 |
| 二、硬约束前缀注入 | I-04 | 约束物理隔离在非压缩区，约束到代码路径的映射 | ✅ 独立 ContextSource 进入 prefix；代码路径映射标记为后续迭代 |
| 三、Flash/Pro 路由 | I-08 + DSV4 调研 | Flash-first + checkpoint 升级 Pro + route reason | ✅ 8 种路由场景，reason 持久化 |
| 四、Reasoning 管理 | I-14 | 剥离展示不回灌，工具轮次临时回传，摘要注入 | ✅ 完整的三阶段生命周期（完整→摘要→剥离） |
| 五、7+1 意图路由 | I-08 | 8 种意图分类 + 策略绑定表 + Spec-Driven 兜底 | ✅ Hybrid 分类器 + 完整策略表 |
| 六、Agent 免疫系统 | I-01 | 负向纠偏，自查→Skill 固化 | ✅ Checkpoint 级审查，Skill 自动生成，与 SuperPowers 格式兼容 |
| 七、双向 Agent | I-02 | 四个元原语，LLM 主动声明需求 | ✅ Tool-call 形式，防滥用机制，自动/确认分级响应 |

### 1.2 论文覆盖补充检查

**I-03 注意力预算管理**：四条策略：
- 硬约束前缀注入 → 模块二 ✅
- Skill 按需加载 → 现有 skill tool 机制 + 模块一 L3/L4 分层 ✅
- 子任务隔离 → 通过 checkpoint 自然形成（模块六），未单独设计"子任务上下文窗口" ⚠️
- 压缩前提取 → Reasoning 摘要（模块四）✅

**I-05 文档 KV Cache 优化**：论文提出把 Agent 推理优化原理应用到自己的产出物（如生成的文档要结构稳定以利 cache）。这是更高级的优化，第一阶段不实施，记录为技术债务。

**I-06 OKR+PlanStep 级联**：意图路由的 Plan 粒度控制部分覆盖了这一点（New/Architecture 意图用更细的 Plan 粒度），但完整的 DAG 依赖管理未实现 ⚠️。

**I-07 Review 切换防漂移**：免疫系统的 Checkpoint 审查覆盖了这一点 ✅。

**I-09 Skills 自进化闭环**：免疫系统的 Skill 固化 + propose_skill 原语形成正向+负向双向闭环 ✅。

**I-10 7+1 意图路由**：模块五完整覆盖 ✅。

**I-11 Checkpoint 快照审查**：模块六覆盖 ✅。

**I-12 记忆粒度分层**：Reasoning 摘要（50 token 粒度 vs 完整 reasoning）、硬约束优先级淘汰部分覆盖，但完整的 λ∈[0,1] 连续频谱记忆粒度未实现 ⚠️。

### 1.3 边角情况

| 边角情况 | 是否处理 |
|---------|---------|
| ContextSource unavailable 时 Session 阻塞 | ✅ OpenCode 已有 InitializationBlocked 机制 |
| Plugin 热加载/卸载导致 prefix 变化 | ✅ 通过 ContextSource 的 register/unregister + reconcile 处理 |
| Flash 模型不支持 tool calling 的场景 | ⚠️ 需确认 DeepSeek V4 Flash 是否支持 tool calling；如不支持需降级策略 |
| reasoning_effort=max 时 token 消耗过大 | ✅ 路由策略确保 max 仅用于 Pro 且仅限审查/架构 |
| 意图分类置信度低时的行为 | ✅ 默认降级到 Medium 保守策略 |
| 跨 Session 的免疫记忆 | ⚠️ 第一阶段仅 session-local，持久化作为后续 |
| 双向原语恶意/错误使用 | ✅ 防滥用机制（次数上限、用户确认） |
| 多 Plugin 同时注册 ContextSource 的 key 冲突 | ✅ OpenCode 已有 DuplicateKeyError |

---

## 二、一致性检查

### 2.1 模块间冲突分析

**冲突 1：Byte-Stable Prefix 要求 System Prompt 不动 vs 意图路由需要加分类指令**

**调和方案**：
- 意图分类在 Session 启动时、第一个 Provider Turn 前完成
- 分类结果（intent type + strategy）通过 Mid-Conversation System Message 注入
- Prefix 中包含意图分类器的元指令（"请判断任务类型"），不包含具体任务类型
- 具体的策略绑定（如"Simple 任务无需详细 Plan"）在 Mid-Conversation 消息中传递

**冲突 2：Reasoning 剥离 vs 工具调用连续性**

**调和方案**：
- 同一 Turn 内（模型输出 tool_calls + reasoning → Harness 执行工具 → 返回 tool_result），reasoning_content 完整回传
- 跨 Turn（N+1 轮及以后），历史 reasoning 替换为摘要
- 这利用了 OpenCode 的消息投影层（to-llm-message.ts），不影响存储层

**冲突 3：免疫系统 spawn 独立审查 vs 上下文膨胀**

**调和方案**：
- 审查是独立的 LLM 调用（不在主 agent loop 中）
- 审查输入**只包含硬约束列表 + 产出物**，不包含执行日志
- 审查结果是结构化的违规列表，不注入完整审查推理

**冲突 4：双向原语 need_more_context 读取文件 vs 上下文预算**

**调和方案**：
- 单次最多 10 个文件
- 读取的文件内容通过 Mid-Conversation System Message 注入（不修改 prefix）
- 大文件自动截断（复用 OpenCode 已有的 tool output bounding）

**冲突 5：模块三路由切换 vs Context Epoch**

**调和方案**：
- CONTEXT.md 明确说："A model/provider switch preserves the current Context Epoch and chronological conversation history"
- 模型切换不触发 baseline 重建，prefix cache 保持命中
- 路由切换记录为 SessionEvent，不影响 SystemContext

### 2.2 数据流一致性

所有模块的数据流遵循 OpenCode V2 架构：
1. 所有上下文变更通过 SystemContextRegistry → ContextSource → reconcile 路径
2. 所有持久化状态通过 SessionEvent 发布
3. 所有消息投影在 to-llm-message.ts 层面处理
4. 没有模块直接修改 System Prompt 字符串

---

## 三、可行性分析

### 3.1 OpenCode 现有架构支撑度

| 模块需要的能力 | OpenCode 是否已有 | 改造量 |
|--------------|-----------------|-------|
| ContextSource 注册自定义上下文源 | ✅ SystemContextRegistry + register() | 零—已有完美扩展点 |
| Context Epoch 管理（baseline 冻结） | ✅ SessionContextEpoch | 零 |
| Mid-Conversation System Message 发射 | ✅ reconcile → Updated → SessionEvent.ContextUpdated | 零 |
| Per-turn model 选择 | ✅ SessionRunnerModel 每轮采样 | 低—加路由规则即可 |
| Reasoning content 持久化 | ✅ SessionRunner/llm.ts 已有 reasoning 持久化 | 低—加摘要/剥离逻辑 |
| Tool 注册 | ✅ ToolRegistry | 零—注册 meta directive 工具即可 |
| Plugin 入口 | ✅ plugin/loader.ts | 低—注册新的 deepcode 包 |
| Message 投影（控制发给 LLM 的内容） | ✅ to-llm-message.ts | 低—加 reasoning 处理 |
| Skill 注册和发现 | ✅ SkillGuidance + skill tool | 零—免疫系统生成标准格式 skill 文件 |

### 3.2 预估代码改造量

| 模块 | 新增代码行数 | 修改现有代码行数 | 风险 |
|------|------------|---------------|------|
| 一、Byte-Stable Prefix | ~200 | ~20（OMO 注册） | 低 |
| 二、硬约束注入 | ~250 | ~0 | 低 |
| 三、Flash/Pro 路由 | ~300 | ~50（SessionRunnerModel） | 中 |
| 四、Reasoning 管理 | ~200 | ~30（to-llm-message） | 低 |
| 五、意图路由 | ~350 | ~20（prefix 注入分类指令） | 中 |
| 六、免疫系统 | ~400 | ~10（checkpoint 钩子） | 中 |
| 七、双向原语 | ~300 | ~40（tool dispatch 拦截） | 低 |
| **合计** | **~2000** | **~170** | |

**总体评估**：改造量适中，85%以上是新增代码，核心框架几乎不需要修改。主要风险点在 SessionRunnerModel 的路由改造和免疫系统的审查 prompt 质量。

### 3.3 关键依赖

1. DeepSeek V4 Flash 和 Pro 的 API endpoint 配置（需要用户配置 API Key）
2. OMO 插件需要能以 ContextSource 方式注册（需要验证 OMO 当前是否直接输出 prompt 字符串）
3. packages/deepcode/ 新包需要正确配置 TypeScript 项目引用

### 3.4 不可行的替代方案

- **直接修改 packages/core/src/system-context/**：不需要，现有扩展点足够
- **替换 OpenCode 的整个 Session 循环**：不需要，per-turn 模型选择和消息投影已有钩子
- **在 V2 plugin 外通过 legacy transform hook 篡改 prompt**：可行但与 V2 架构冲突，不推荐
