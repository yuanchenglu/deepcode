# DeepSeek V4 物理特性深度分析 — DeepCode Harness 适配评估

> 基于 `/home/claude-user/docs/stage1/05_DSV4_NOTES.md` 的全面分析  
> 生成日期：2026-07-06  
> 分析范围：所有 V4 物理架构特性与现有 DeepCode 七大模块的覆盖度对照

---

## 一、DeepSeek V4 物理特性全清单

以下列出从官方源码/config.json/模型卡确认的全部物理特性（S0-S1 证据等级），逐项标注 DeepCode 现有覆盖情况。

---

### 特性 1：CSA + HCA + MQA 混合注意力架构

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | 所有变体使用混合注意力：CSA（压缩稀疏，ratio=4）+ HCA（重度压缩，ratio=128）+ MQA（`num_key_value_heads=1`）。每层根据 `compress_ratio` 选择路径。Flash 前两层无压缩(dense)，Pro 前两层用 HCA(128x)。sliding_window=128，所有变体一致。 |
| **证据等级** | S0（config.json 实测） |
| **DeepCode 已使用？** | **部分使用**。模块一(prefix-context)将稳定内容放 prefix 区；模块二(hard-constraint)将硬约束注入 prefix 非压缩区。但未实现 sliding_window=128 对齐的主动上下文布局管理。 |
| **未利用机会** | ① 滑动窗口对齐：最近128 token 是唯一获得全密度注意力的区域，当前操作/目标/硬约束必须物理上位于尾部窗口内；② 窗口预算追踪：未按注意力密度分区(prefix/anchor/active/compressed/tail)管理 token 预算；③ 输出边界对齐：未限制单次输出长度以确保关键信息落在128窗口内。 |
| **实现复杂度** | 中等。需要 token 计数服务 + 上下文布局感知 + 输出长度建议逻辑。纯 TypeScript，无外部依赖。 |

---

### 特性 2：Flash vs Pro 配置差异

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | Flash: 284B总参/13B激活, 43层, hidden=4096, 256 experts, index_topk=512；Pro: 1.6T总参/49B激活, 61层, hidden=7168, 384 experts, index_topk=1024。两者每token均激活6个路由专家，Flash成本优势来自整体规模缩小而非专家数减少。 |
| **证据等级** | S0（config.json 实测） |
| **DeepCode 已使用？** | **已使用**。模块三(model-router)实现 Flash-first, Pro-on-checkpoint 路由，覆盖 C-004。 |
| **未利用机会** | ① index_topk 差异未利用：Pro 的稀疏检索预算翻倍(1024 vs 512)，长上下文检索/审查任务可更激进地在 Pro 上加载更多历史；② Pro 前两层 HCA(128x) vs Flash 前两层 dense(0) 的架构差异意味着 Pro 更适合处理超长历史压缩，Flash 更适合短上下文快速响应。 |
| **实现复杂度** | 低-中。可在路由层扩展 index_topk 感知。 |

---

### 特性 3：Context Caching（前缀缓存）

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | 默认开启硬盘 context caching，best-effort full-prefix-unit 匹配。缓存命中要求 byte-stable：完全相同的字符串、顺序、字节。任何微小变化导致整段 prefix cache miss。API 返回 `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens`。 |
| **证据等级** | S1（官方 API 文档） |
| **DeepCode 已使用？** | **部分使用**。模块一(prefix-context)实现 byte-stable prefix baseline，ContextSource 机制保证跨 session 复用。但缺少：① 启动时主动预热(warm-up)空请求触发缓存填充；② 缓存命中率遥测；③ 动态内容的 cache-friendly 排序策略。 |
| **未利用机会** | ① Session 启动时发送一个最小预热请求（仅 prefix，无用户消息），让服务端提前计算 prefix KV cache；② Tool schema 按 name 排序（C-006）未在代码层强制执行；③ 缓存命中率 telemetry 未采集。 |
| **实现复杂度** | 低（缓存预热）- 中（遥测集成）。 |

---

### 特性 4：Thinking Mode 与 reasoning_content 生命周期

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | reasoning_effort 控制 none/low/high/max；thinking 模式下模型返回 reasoning_content；drop_thinking 默认 True；有 tools 时自动禁用 drop_thinking 导致 reasoning 累积；Max 模式注入特殊前缀（破坏 cache stability）。Reasoning 不是记忆，应结晶为 checkpoint/decision。 |
| **证据等级** | S1（官方 API 文档） |
| **DeepCode 已使用？** | **已使用**。模块四(reasoning/manager)实现三阶段生命周期（当前轮全保留→下一轮摘要→历史轮剥离）+ effort 档位分配。 |
| **未利用机会** | ① Checkpoint 结晶格式（reasoning_summary → decision → discarded_paths → risks → next_action）未实现自动化；② Max thinking 特殊前缀对 cache 的破坏未在路由层做显式保护（切换 Max 时应新开 context epoch）。 |
| **实现复杂度** | 中（结晶自动化需要结构化模板，纯函数即可）。 |

---

### 特性 5：DSML 专用 Encoding（非 Jinja/OpenAI 格式）

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | V4 不使用传统 Jinja chat template，提供专用 encoding 脚本。Tool calling 使用 DSML 格式：`<｜DSML｜tool_calls>` → `<｜DSML｜invoke>` → `<｜DSML｜parameter>`；tool results 包装在 user message 的 `<tool_result>` 标签内。需要 parser/malformed detector/repair/fallback/retry。 |
| **证据等级** | S0（官方 encoding 目录）+ S1（模型卡） |
| **DeepCode 已使用？** | **未使用**。C-007 要求 DSML Repair 层，但现有七大模块中无 DSML 专用模块。Tool 调用格式由 provider 层处理，harness 层未感知 DSML 特性。 |
| **未利用机会** | ① DSML 标签的 token 效率优化：DSML 是专用 token 序列，比 OpenAI function calling JSON 更 token-efficient，可以利用这一点优化 tool schema 展示；② Malformed detector + repair prompt 策略；③ Tool result 顺序保证（按 call 顺序排列以保持 prefix 稳定）。 |
| **实现复杂度** | 中-高。需要了解 DSML token 序列 + 与 provider 层协作。 |

---

### 特性 6：mHC（Manifold-Constrained Hyper-Connections）

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | hc_mult=4：embedding 后将 hidden state 扩展为4份 copy；Block 维护多份 hidden state copy；使用 Sinkhorn 约束(20次迭代)做 pre/post/comb mixing；总流程：embed → HC-expand → N blocks → HC-head → logits。架构暗示多信号通道在各层并行传播。 |
| **证据等级** | S0（源码中 hc_split_sinkhorn 等函数） |
| **DeepCode 已使用？** | **未使用**。C-010 建议 prompt 标签化（[GOAL_SIGNAL][CONSTRAINT_SIGNAL]等），但无实现模块。现有 prefix 是单一文本块，未利用 mHC 的多通道传播特性。 |
| **未利用机会** | ① Prompt 信号分层标签：将上下文内容标记为 GOAL/CONSTRAINT/EVIDENCE/EXECUTION/REVIEW/NEXT_ACTION 六类信号，与 mHC 的多副本 hidden state 对齐；② 稳定标签促进 hash routing（见特性7）；③ 标签位置优化：标签 token 的 id 分布影响前3层 hash routing 路径。 |
| **实现复杂度** | 低-中。纯文本注入，在 ContextSource 或消息转换层添加标签标记即可。 |

---

### 特性 7：MoE 路由机制（Hash + Score Routing）

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | 前 num_hash_layers=3 层使用 hash-based routing（基于 token-id hash），后续层使用 score-based routing。路由方法 noaux_tc（no-auxiliary-loss top-k with corrected scoring），评分函数 sqrtsoftplus。每 token 选6个路由专家 + 1个共享专家。Flash 256 experts，Pro 384 experts。 |
| **证据等级** | S0（config.json + 源码 Gate 模块） |
| **DeepCode 已使用？** | **未使用**。hash routing 意味着前3层的专家分配由 token ID 确定性决定，稳定的标签 token 可以形成更稳定的早期路由路径，减少路由抖动。这在 notes 中被推论为可能的优化方向，但未实现。 |
| **未利用机会** | ① 稳定标签 token 促进一致的 hash routing：在会话中使用固定格式标签，相同语义内容映射到相似专家子集；② 避免标签变异：同一种信号始终用相同文本标签（不用"目标："有时又用"Goal:"）；③ 标签分隔符选择：选择 tokenizer 中单 token 的分隔符减少碎片化。 |
| **实现复杂度** | 低。只需在 prompt 构造时统一标签格式和分隔符。与 mHC 信号标签可合并实现。 |

---

### 特性 8：Indexer 模块（稀疏 KV 检索）

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | 仅 compress_ratio=4 的层创建 Indexer，通过 learned scoring 选择 top-k compressed KV positions。Flash index_topk=512，Pro index_topk=1024。Indexer 决定长上下文中哪些历史信息被稀疏检索到当前层。 |
| **证据等级** | S0（config.json + 源码 Indexer 模块） |
| **DeepCode 已使用？** | **未直接使用**。prefix-context 将重要内容放 prefix 间接有助于 Indexer 检索，但未主动优化内容格式以提高 Indexer 检索命中率。 |
| **未利用机会** | ① Anchor 标记：在上下文中插入显式锚点标记（如 `[ANCHOR:关键决策]`），提高 learned scoring 将其选为 top-k 位置的概率；② 历史内容结构化：checkpoint 格式比自由文本更容易被 Indexer 高分检索；③ Pro 上可加载更多历史(index_topk=1024)。 |
| **实现复杂度** | 中。需要了解 Indexer 的 scoring 机制推论，属于行为侧优化。 |

---

### 特性 9：Sparse Attention Kernel + attn_sink

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | 通过 topk_idxs 显式 gather KV positions 而非 dense attention；softmax 分母加入 attn_sink 稳定项。这意味着模型对序列起始位置有隐式偏好（attention sink 现象）。 |
| **证据等级** | S0（kernel.py sparse_attn） |
| **DeepCode 已使用？** | **间接使用**。prefix-context 将核心指令放序列开头，正好利用 attention sink 效应。但未显式利用。 |
| **未利用机会** | ① 关键硬约束和身份指令放 prefix 最前面（已有）；② 避免在 prefix 中间插入高信息量内容（sink 偏好起始，稀疏检索偏好锚点）。 |
| **实现复杂度** | 低。主要是排序策略，已大部分覆盖。 |

---

### 特性 10：FP4/FP8 量化

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | Instruct 模型(Flash/Pro)专家权重 FP4；Base 模型专家权重 FP8；所有模型 activation FP8 dynamic quantization (block 128)。FP4 GEMM = FP8 activation × FP4 weight。 |
| **证据等级** | S0（config.json quantization_config） |
| **DeepCode 已使用？** | **不适用**（服务端推理细节，harness 层无法影响）。 |
| **未利用机会** | 无 harness 层可操作项。影响的是部署侧(inference kernel)。 |
| **实现复杂度** | N/A。 |

---

### 特性 11：RoPE YaRN 外推

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | YaRN RoPE scaling, factor=16，从 65536 外推到 1M。rope_theta=10000, compress_rope_theta=160000。压缩注意力使用不同的位置编码频率。 |
| **证据等级** | S0（config.json） |
| **DeepCode 已使用？** | **不适用**（位置编码是模型内部机制，harness 层只需知道 context window = 1M）。 |
| **未利用机会** | 无直接 harness 操作项。理解 1M ≠ 全 dense attention 是布局驱动上下文的理论基础。 |
| **实现复杂度** | N/A。 |

---

### 特性 12：next-n Prediction Head

| 项目 | 详情 |
|------|------|
| **V4 实际行为** | num_nextn_predict_layers=1。模型有一个 next-n 预测辅助头，训练时预测未来 n 个 token。 |
| **证据等级** | S0（config.json） |
| **DeepCode 已使用？** | **不适用**（训练侧技术，推理时不直接暴露）。 |
| **未利用机会** | 可能让模型在生成长序列时更"流畅"，但 harness 层无法直接利用。 |
| **实现复杂度** | N/A。 |

---

## 二、现有 DeepCode 七大模块覆盖矩阵

| V4 物理特性 | 模块一<br>Prefix | 模块二<br>硬约束 | 模块三<br>路由 | 模块四<br>Reasoning | 模块五<br>意图 | 模块六<br>免疫 | 模块七<br>元指令 | 覆盖度 |
|-------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| CSA/HCA/MQA + 滑动窗口 | 部分 | 部分 | - | - | - | - | - | 30% |
| Flash/Pro 差异 | - | - | ✅ | - | - | - | - | 80% |
| Context Caching | ✅ | - | - | - | - | - | - | 50% |
| Thinking/Reasoning | - | - | - | ✅ | - | - | - | 70% |
| DSML Encoding | - | - | - | - | - | - | - | 0% |
| mHC 多通道连接 | - | - | - | - | - | - | - | 0% |
| MoE Hash Routing | - | - | - | - | - | - | - | 0% |
| Indexer 稀疏检索 | 间接 | - | - | - | - | - | - | 10% |
| attn_sink | 间接 | - | - | - | - | - | - | 20% |

---

## 三、优化机会优先级表

按 **预期收益 × 可实现性** 排序：

| 优先级 | 优化机会 | 对应 V4 特性 | 预期收益 | 复杂度 | 推荐状态 |
|--------|----------|-------------|---------|--------|---------|
| **P0** | 滑动窗口对齐 + Token 预算管理 | CSA/HCA sliding_window=128 | 高：确保关键信息在128 token 全密度窗口内，减少注意力稀释 | 中 | **立即实现** |
| **P0** | Prompt 信号标签（mHC/MoE 对齐） | mHC hc_mult=4 + Hash routing | 高：多信号分层传播 + 稳定标签促进一致路由 | 低 | **立即实现** |
| P1 | Prefix Cache 预热 | Context Caching | 中：首次请求延迟降低，cache hit 提前建立 | 低 | 下一迭代 |
| P1 | DSML 格式优化与 Repair 层 | DSML Encoding | 中：减少 tool call 解析失败，提高格式稳定性 | 中-高 | 下一迭代 |
| P2 | Checkpoint 推理结晶自动化 | Reasoning 生命周期 | 中：长任务 reasoning 压缩，减少累积噪声 | 中 | 后续 |
| P2 | Cache 命中率遥测 | Context Caching | 中：可观测性驱动优化 | 中 | 后续 |
| P3 | Anchor 标记提升 Indexer 检索 | Indexer learned scoring | 低-中：理论推论，需实测验证 | 中 | 研究 |
| P3 | Tool schema 稳定排序强制执行 | Context Caching | 低：属于细节加固 | 低 | 可合并到 P1 |

---

## 四、P0 优化详细设计

### P0-1：滑动窗口对齐 + Token 预算管理

**核心洞察**：sliding_window=128 意味着任何时刻只有最近 128 个 token 获得 CSA/HCA 路径上的全密度注意力。更早的内容通过压缩路径（4x 或 128x 压缩）稀疏访问。当前操作指令、目标、硬约束如果"掉出"了尾部128窗口，就只能通过压缩路径被模糊检索。

**模块职责**：
1. **Token 预算分区**：定义 prefix/anchor/active/tail 四区的 token 预算
2. **窗口位置感知**：追踪当前会话中各区段的 token 位置
3. **输出边界建议**：根据当前窗口占用建议最大输出 token 数，确保输出后关键指令仍在窗口内
4. **压缩区管理**：历史超过阈值的内容建议压缩为 checkpoint
5. **模型差异感知**：Flash index_topk=512 vs Pro index_topk=1024 的不同预算

**关键参数**：
- sliding_window = 128 tokens（全密度注意力区）
- anchor_zone = 128-512 tokens（CSA 4x 压缩，Indexer 可检索）
- compressed_zone = 512+ tokens（HCA 128x 压缩，稀疏访问）
- Flash 安全 active budget = ~400 tokens（512 - 128 留给输出）
- Pro 安全 active budget = ~900 tokens（1024 - 128 留给输出）

### P0-2：Prompt 信号标签（mHC/MoE 对齐）

**核心洞察**：
1. mHC (hc_mult=4) 在 embedding 后立即分裂为4份 hidden state copy，通过 Sinkhorn 约束在各层混合。不同语义信号在不同 copy 中传播可能更高效。
2. MoE 前3层使用 hash routing（基于 token-id hash），稳定标签文本 → 稳定 token ID → 稳定专家分配 → 减少路由抖动。
3. C-010 明确要求标签化：[CURRENT_GOAL][CURRENT_STEP][HARD_CONSTRAINTS][ACTIVE_FILES][CHECKPOINT][TEST_RESULT][NEXT_ACTION]。

**模块职责**：
1. **标准化信号标签**：定义六类信号标签（GOAL/CONSTRAINT/EVIDENCE/EXECUTION/REVIEW/NEXT_ACTION），统一中文/英文标签文本
2. **标签注入服务**：提供将结构化内容包装为带标签文本的工具函数
3. **Hash 路由稳定性**：确保同类型信号始终使用相同标签字符串（不混用"目标"和"Goal:"）
4. **Token 效率**：选择 tokenizer 友好的标签格式（单 token 分隔符优先）

**标签格式**：`[SIGNAL:TYPE]` 前缀，`[/SIGNAL]` 后缀，形成清晰的语义边界。
