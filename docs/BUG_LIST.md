# DeepCode Bug 清单

> 生成时间：2026-07-12
> 审核范围：packages/core/src/deepcode/ 所有模块

---

## Bug 严重程度说明

| 级别 | 定义 | 处理优先级 |
|------|------|-----------|
| P0 | 功能错误、数据损坏、阻塞流程 | 立即修复 |
| P1 | 逻辑错误、行为不符合预期 | 本轮修复 |
| P2 | 代码质量、注释不一致、性能问题 | 建议修复 |
| P3 | 设计取舍、TODO项、待增强功能 | 后续迭代 |

---

## BUG-001: hard-constraint/context-source.ts — 使用 CommonJS require()

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/hard-constraint/context-source.ts:113 |
| **严重程度** | P1 |
| **问题描述** | ESM/TypeScript 项目中使用 `require("effect")` 而非 `import` |
| **复现条件** | 运行 bun typecheck 或 ESM 打包时可能出现类型或导入问题 |
| **预期行为** | 顶部统一使用 ES Module import |
| **实际行为** | 第 113 行在函数内部使用 `const { Schema } = require("effect")` |
| **修复方案** | 顶部添加 `import { Schema } from "effect"`，删除 makeStringCodec 中的 require |

---

## BUG-002: okr-plan.ts — 运算符优先级导致默认关联逻辑错误

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/okr-plan.ts:180 |
| **严重程度** | P0 |
| **问题描述** | `??` 运算符优先级低于 `===` 和三元运算，导致空数组 okr 关联错误 |
| **复现条件** | 创建 PlanStep 时显式传入 `okr: []`（不关联任何 KR） |
| **预期行为** | `s.okr ?? (krs.length === 1 ? [0] : [])` — 显式空数组应保持为空 |
| **实际行为** | `(s.okr ?? (krs.length===1)) ? [0] : []` — 空数组 truthy，错误得到 `[0]` |
| **修复方案** | 添加括号明确优先级：`okr: s.okr ?? (krs.length === 1 ? [0] : [])` |

---

## BUG-003: okr-plan.ts — 级联更新时字段名不匹配，status 未更新

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/okr-plan.ts:298, 333 |
| **严重程度** | P0 |
| **问题描述** | stepUpdates 接口中状态字段名为 `newStatus`，但直接展开到 PlanStep 导致 status 字段未更新 |
| **复现条件** | 调用 cascade() 修改步骤状态时 |
| **预期行为** | 步骤 status 字段更新为 newStatus |
| **实际行为** | newStatus 成为多余属性，真正的 status 保持不变 |
| **修复方案** | 在展开前做字段映射，或将接口字段名统一为 `status` |

---

## BUG-004: scope-creep-guard.ts — approvedOptionals 使用子串匹配而非 glob 匹配

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/scope-creep-guard.ts:251 |
| **严重程度** | P1 |
| **问题描述** | 批准的可选路径使用 `filePath.includes(a)` 子串匹配，与其他路径检查的 glob 匹配不一致 |
| **复现条件** | 批准路径如 `"src/core"` 会错误匹配 `"src/core2/utils.ts"` |
| **预期行为** | 统一使用 `isPathAllowed(filePath, scope.approvedOptionals)` |
| **实际行为** | 子串包含可能导致误放行 |
| **修复方案** | 将 `filePath.includes(a)` 替换为 `isPathAllowed(filePath, [a])` 或重构为批量 glob 匹配 |

---

## BUG-005: scope-creep-guard.ts — glob 转正则时未转义特殊字符

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/scope-creep-guard.ts:200 |
| **严重程度** | P1 |
| **问题描述** | glob 模式转换为正则时，只替换了 `*` 为 `.*`，但路径中的 `.` 等正则元字符未转义 |
| **复现条件** | 模式 `"src/file.util.ts"` 转为 `^src/file.util.ts$`，其中 `.` 匹配任意字符，错误匹配 `"src/fileXutilYts"` |
| **预期行为** | 先转义正则特殊字符（`.`, `(`, `)`, `+`, etc.），再替换 `*` |
| **实际行为** | 包含点号的路径模式匹配范围过宽 |
| **修复方案** | 在 replace `*` 前先将模式中的 `.` 替换为 `\.`，其他元字符类似处理 |

---

## BUG-006: skill-evolution.ts — createCheckpoint 中 turn 字段硬编码为 0

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/skill-evolution.ts:443 |
| **严重程度** | P1 |
| **问题描述** | CheckpointSnapshot 的 turn 字段硬编码为 0，注释说"由外部设置"但返回不可变对象无法修改 |
| **复现条件** | 调用 createCheckpoint() 创建快照时 |
| **预期行为** | turn 字段反映真实的对话轮次 |
| **实际行为** | 所有快照 turn 永远为 0，无法追溯轮次 |
| **修复方案** | 将 turn 作为函数参数传入，或从注入的 Session 状态读取 |

---

## BUG-007: skill-evolution.ts — constraint-violation 类型触发器总是返回 true

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/skill-evolution.ts:342-344 |
| **严重程度** | P1 |
| **问题描述** | getActiveSkills 中 `constraint-violation` 类型触发器无条件返回 true |
| **复现条件** | 调用 getActiveSkills() 获取应激活的 Skill 列表时 |
| **预期行为** | 仅在约束违规审查场景中才激活此类 Skill |
| **实际行为** | 任何场景下此类 Skill 都被激活，可能导致非预期 Skill 大量加载 |
| **修复方案** | 添加上下文判断，检查当前是否在 review/checkpoint 场景中 |

---

## BUG-008: memory-granularity.ts — endStep() 返回值统计错误

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/memory-granularity.ts:319-321 |
| **严重程度** | P1 |
| **问题描述** | promoted 统计所有 `em-` 开头且 compressed 的记忆，而非本次 endStep 新提升的数量 |
| **复现条件** | 多次调用 endStep() 后检查返回值 |
| **预期行为** | 返回值 promoted/discarded 反映本次调用的增量 |
| **实际行为** | promoted 数累积增长，不能反映当次提升数 |
| **修复方案** | 在 Ref.updateAndGet 内部，先标记哪些条目是在本次提升的，再统计 |

---

## BUG-009: memory-granularity.ts — 冷记忆未真正删除导致内存泄漏

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/memory-granularity.ts:317 |
| **严重程度** | P2 |
| **问题描述** | 统计了超过 20 turn 的压缩记忆数量，但这些条目从未从数组中移除 |
| **复现条件** | 长时间运行 session，多次 endStep() |
| **预期行为** | 超期冷记忆被清理出数组 |
| **实际行为** | 记忆永久累积，长期运行内存无限增长 |
| **修复方案** | 在 endStep 中过滤掉 turn 超出阈值的 compressed 条目 |

---

## BUG-010: meta-directives/handlers.ts — trigger_self_review 参数未使用

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/meta-directives/handlers.ts |
| **严重程度** | P2 |
| **问题描述** | 解析了 `focus` 和 `depth` 参数，但 case 分支中完全未使用 |
| **复现条件** | LLM 调用 trigger_self_review 传入 focus/depth 参数 |
| **预期行为** | 参数应影响审查行为（如 quick 只检查最近步骤，thorough 全量审查） |
| **实际行为** | 参数被忽略，审查无差异化 |
| **修复方案** | 将参数传递给免疫系统 reviewer，或至少在返回消息中确认参数生效 |

---

## BUG-011: meta-directives/handlers.ts — propose_skill 功能仅有 TODO 占位

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/meta-directives/handlers.ts |
| **严重程度** | P3 |
| **问题描述** | propose_skill 元指令只返回确认消息，无安全验证、无持久化、无激活逻辑 |
| **复现条件** | LLM 调用 propose_skill 提议固化 Skill |
| **预期行为** | 验证 Skill 安全性 → 持久化到磁盘 → 注册到 Skill 系统 |
| **实际行为** | 仅返回 "Skill proposed" 消息，无后续动作 |
| **修复方案** | 阶段三：接入 skill-evolution 的 solidifySkill，添加用户确认流程 |

---

## BUG-012: meta-directives/handlers.ts — need_more_context 的 search_terms 未实现搜索

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/meta-directives/handlers.ts |
| **严重程度** | P2 |
| **问题描述** | 接收了 search_terms 参数但原样返回，未执行实际代码搜索 |
| **复现条件** | LLM 调用 need_more_context 传入 search_terms |
| **预期行为** | 使用 ripgrep 或 FileSystemSearch 搜索代码库 |
| **实际行为** | search_terms 被忽略 |
| **修复方案** | 注入 search 回调，执行搜索并返回结果 |

---

## BUG-013: reasoning/manager.ts — 三阶段策略只实现两阶段，摘要衔接缺失

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/reasoning/manager.ts |
| **严重程度** | P2 |
| **问题描述** | 文件头描述三阶段（完整/摘要/完全剥离），但 shouldStrip 只返回 boolean，无"替换为摘要"的阶段判断 |
| **复现条件** | 多轮对话中处理 reasoning_content |
| **预期行为** | N+1 轮替换为摘要，N+2 轮完全剥离 |
| **实际行为** | 本文件仅提供 summarize 纯函数，生命周期管理需外部调用方处理 |
| **修复方案** | 与 SessionRunner 集成，在 Provider Turn 边界实现三阶段切换逻辑 |

---

## BUG-014: immune-system/reviewer.ts — Skill 重复生成无去重

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/immune-system/reviewer.ts |
| **严重程度** | P2 |
| **问题描述** | 每次相同约束违规都生成同名 Skill，直接追加到数组无去重 |
| **复现条件** | 多次触发同一约束违规的审查 |
| **预期行为** | 同名 Skill 只保留一份，更新统计计数 |
| **实际行为** | 重复 Skill 条目累积 |
| **修复方案** | synthesizeSkill 返回前按 name 去重，已存在的 Skill 增加 violationCount |

---

## BUG-015: window-manager.ts — 注释数值与实际预算值不一致

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/context-layout/window-manager.ts:48-49, 132 |
| **严重程度** | P2 |
| **问题描述** | 注释写"Flash active ~400 tokens / Pro ~900 tokens"，实际代码是 256 / 640；注释说"60%非窗口预算"实际是 ~67%/71% |
| **复现条件** | 维护代码时阅读注释会被误导 |
| **预期行为** | 注释数值与代码常量一致 |
| **实际行为** | 多处注释与 FLASH_BUDGET/PRO_BUDGET 常量不符 |
| **修复方案** | 更新注释匹配实际值，或调整常量匹配注释设计意图 |

---

## BUG-016: reasoning/manager.ts — 配置硬编码，无法动态修改

| 字段 | 值 |
|------|-----|
| **文件** | packages/core/src/deepcode/reasoning/manager.ts |
| **严重程度** | P3 |
| **问题描述** | shouldStrip/summarize 直接引用模块级 DEFAULT_CONFIG，虽然定义了 ReasoningConfig 接口但运行时无法修改 |
| **复现条件** | 用户尝试通过 opencode.json 配置 reasoning 行为 |
| **预期行为** | 配置通过 Layer 注入，可从 opencode.json 读取覆盖 |
| **实际行为** | 配置项写死，无法自定义 |
| **修复方案** | 将 config 放入 Service 构造时从 Config 服务读取 |

---

## 集成状态 TODO（非 Bug，待集成）

以下模块核心逻辑完成但未接入主流程，需在后续集成阶段处理：

| 模块 | TODO 项 |
|------|---------|
| okr-plan.ts | 意图路由后自动 createPlan、TodoWrite后 advanceToNext、Checkpoint时evaluateKRs、cascade触发 |
| review-anti-drift.ts | tool execute 后 recordToolCall、消息流注入审查 prompt、Tier4 context reinjection |
| memory-granularity.ts | 意图路由后 setMode、tool结果 addWorking、决策/错误 addEpisodic、cascade后 forgetByTag、step完成 endStep、compaction前 extractForCompaction |
| scope-creep-guard.ts | setInitialScope 接入 Plan 创建、checkToolAccess 拦截工具调用 |
| skill-evolution.ts | Skill 持久化、getActiveSkills 自动注入 system prompt、subagent 审查 spawn |
| reasoning/manager.ts | 三阶段生命周期与 SessionRunner 集成、reasoning_effort 传给 Provider |
| model-router.ts | decide() 接入 Provider 模型选择、recordFailure 接入错误处理、route reason 持久化 |
| meta-directives | need_more_context 接入文件读取/搜索、propose_skill 接入 skill-evolution、回调初始化时序 |

---

## Bug 修复追踪

| Bug 编号 | 严重程度 | 修复状态 | 修复文件 | 验证结果 |
|---------|---------|---------|---------|---------|
| BUG-001 | P1 | ⏳ 待修复 | hard-constraint/context-source.ts | |
| BUG-002 | P0 | ⏳ 待修复 | okr-plan.ts | |
| BUG-003 | P0 | ⏳ 待修复 | okr-plan.ts | |
| BUG-004 | P1 | ⏳ 待修复 | scope-creep-guard.ts | |
| BUG-005 | P1 | ⏳ 待修复 | scope-creep-guard.ts | |
| BUG-006 | P1 | ⏳ 待修复 | skill-evolution.ts | |
| BUG-007 | P1 | ⏳ 待修复 | skill-evolution.ts | |
| BUG-008 | P1 | ⏳ 待修复 | memory-granularity.ts | |
| BUG-009 | P2 | ⏳ 待修复 | memory-granularity.ts | |
| BUG-010 | P2 | ⏳ 待修复 | meta-directives/handlers.ts | |
| BUG-011 | P3 | ⏳ 待后续 | meta-directives/handlers.ts | |
| BUG-012 | P2 | ⏳ 待修复 | meta-directives/handlers.ts | |
| BUG-013 | P2 | ⏳ 待集成 | reasoning/manager.ts | |
| BUG-014 | P2 | ⏳ 待修复 | immune-system/reviewer.ts | |
| BUG-015 | P2 | ⏳ 待修复 | context-layout/window-manager.ts | |
| BUG-016 | P3 | ⏳ 待后续 | reasoning/manager.ts | |

---

*审核人：gleam (anonymous model)*
*审核时间：2026-07-12*
