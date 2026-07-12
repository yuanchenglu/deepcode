# DeepCode 技术债务清单

| 编号 | 位置（文件:行号） | 类型 | 描述 | 严重程度 | 建议修复方案 |
|------|-------------------|------|------|----------|-------------|
| TD-001 | deepcode/immune-system/reviewer.ts:196 | TODO 注释 | `TODO(阶段三): 调用 Pro 模型做独立 LLM 审查`。当前审查仅基于简单规则（检查备份关键词），无法覆盖复杂约束违规检测，免疫系统核心功能缺失。 | P1（高） | 阶段三实现：构造审查 prompt（约束列表 + 产出物描述），调用 Pro 模型做语义级约束遵守检查，解析返回的违规列表 JSON。 |
| TD-002 | deepcode/meta-directives/handlers.ts:263 | TODO 注释 | `TODO(阶段三): 验证 Skill 安全性（无危险操作如 rm -rf）后写入磁盘`。当前 propose_skill 仅返回确认，缺少沙箱验证和自动持久化，Skill 固化闭环未完成。 | P1（高） | 阶段三实现：对 Skill body 做静态安全扫描（检测危险命令/文件路径），用户确认后写入磁盘并注册到 SkillRegistry。 |
| TD-003 | deepcode/hard-constraint/store.ts:18 | TD 标记 | 注释中标记 `DB 持久化标记为 TD-004`。硬约束仅存储在内存 Ref 中，进程重启后丢失，需要从用户消息重新提取。 | P2（中） | 将约束状态持久化到 Session DB（与 SystemContext.Snapshot 同生命周期），重连时恢复。 |
| TD-004 | deepcode/immune-system/reviewer.ts:185 | TD 标记 | 注释中标记 `第二阶段（TD-001）：接入 Pro 模型做语义审查`。与 TD-001 重复引用，说明 LLM 审查功能已规划但未实现。 | P2（中） | 同 TD-001 修复方案，实现后移除此注释标记。 |
| TD-005 | deepcode/meta-directives/handlers.ts:278 | any 类型 | `(directive as any).type` 在 default 分支中使用 `as any` 访问 directive.type，绕过类型检查。由于 default 分支中 directive.type 应为 never，此处使用 any 丧失了类型安全。 | P2（中） | 使用 `never` 类型断言或在 default 中将 directive 赋给 `const _exhaustiveCheck: never = directive`，利用 TypeScript 穷尽检查确保所有 case 已覆盖。 |
| TD-006 | deepcode/meta-directives/handlers.ts:181 | 类型不安全转换 | `directive.params as unknown as NeedMoreContextParams` — 双重类型断言绕过类型系统。LLM 发送的 params 是 `Record<string, unknown>`，未经运行时校验直接强转为具体类型。 | P2（中） | 使用 Effect Schema 或 Zod 对 params 做运行时校验，确保 LLM 输出符合预期结构后再使用，避免恶意/异常输入导致运行时错误。 |
| TD-007 | deepcode/meta-directives/handlers.ts:214 | 类型不安全转换 | `directive.params as unknown as RequestModelParams` — 同 TD-006，缺少运行时参数校验。 | P2（中） | 同 TD-006，引入 Schema 校验层。 |
| TD-008 | deepcode/meta-directives/handlers.ts:262 | 类型不安全转换 | `directive.params as unknown as ProposeSkillParams` — 同 TD-006，Skill 参数未经校验直接使用。 | P2（中） | 同 TD-006，引入 Schema 校验层，尤其对 Skill body 做安全校验。 |
| TD-009 | deepcode/hard-constraint/context-source.ts:113 | 动态 require | `const { Schema } = require("effect")` 使用 CommonJS 动态 require 而非顶层 import。注释解释是为避免类型问题，但破坏了 ESM 静态分析、tree-shaking 和 bundler 优化。 | P2（中） | 改为顶层 `import { Schema } from "effect"`。若存在类型问题，通过正确的类型导入（`import type { ... }`）或模块解析配置解决。 |
| TD-010 | deepcode/meta-directives/handlers.ts:194 | 空 catch 块 | `catch { }` 裸 catch 捕获所有异常但不记录错误细节，仅返回 `[Error reading file: path]` 字符串，不包含原始错误信息，调试困难。 | P3（低） | 改为 `catch (error) {` 并通过 `Effect.logError` 或在返回消息中包含 error message，便于问题排查。 |
| TD-011 | deepcode/router/model-router.ts:226 | 脆弱 ID 生成 | `Math.random().toString(36).slice(2, 8)` 生成路由决策 ID。Math.random() 非密码学安全，6 位 base36 仅约 31 bits 熵，高并发场景（同毫秒内多次调用）存在碰撞风险。 | P3（低） | 使用 `crypto.randomUUID()` 或 Effect 的 `Crypto` 服务生成唯一 ID；或增加计数器后缀确保唯一性。 |
| TD-012 | deepcode/meta-directives/handlers.ts:109-110 | 魔法数字 | `modelSwitchPerSession: 5` 和 `filesPerContextRequest: 10` 硬编码限流阈值，虽然有注释解释，但未提取为配置项，无法通过 opencode.json 调整。 | P3（低） | 将限流阈值放入 RoutingConfig 模式的可配置对象中，允许用户通过配置文件覆盖默认值。 |
| TD-013 | deepcode/reasoning/manager.ts:74 | 魔法数字 | `maxSummaryChars: 300` 摘要最大字符数硬编码为 300，不同场景（长对话 vs 短对话）可能需要不同长度。 | P3（低） | 暴露为配置项或通过 intent 策略动态调整（如 architecture 类型允许更长摘要）。 |
| TD-014 | deepcode/reasoning/manager.ts:141 | 魔法数字 | `s.trim().length > 5` 过滤短句子的阈值 5 字符硬编码，中文/英文/代码场景的合理阈值可能不同。 | P3（低） | 提取为命名常量 `MIN_SENTENCE_LENGTH = 5`，或根据语言动态调整。 |
| TD-015 | deepcode/immune-system/reviewer.ts:134 | 魔法数字 | `.slice(0, 30)` Skill 名称截断长度 30 硬编码，中文/多字节字符场景下可能截断在中间位置。 | P3（低） | 提取为命名常量，并考虑使用 Array.from() 按码点截断避免多字节字符截断问题。 |
| TD-016 | deepcode/intent-router/classifier.ts:194-204 | 魔法数字 | 置信度值（0.9, 0.85, 0.8, 0.6）和分类阈值 0.8（line 297）、默认降级置信度 0.3（line 307）均直接硬编码，未提取为命名常量。 | P3（低） | 提取 `CONFIDENCE_HIGH = 0.8`、`CONFIDENCE_MAX = 0.9` 等命名常量，便于后续调优时统一修改。 |
| TD-017 | deepcode/hard-constraint/extractor.ts:125-131 | 魔法数字 | 正则中的 `{0,30}` 和 `{0,20}` 量词限制约束文本捕获长度，但未注释说明选择依据，且不同语言（中文更简洁/英文更长）的合适长度不同。 | P3（低） | 添加注释说明 30/20 字符的设计依据，或改为动态长度适配。 |
| TD-018 | deepcode/reasoning/manager.ts:88 | 弱类型参数 | `getEffort(intent: string | undefined, ...)` 中 intent 参数使用宽泛的 `string` 类型，而非模块中定义的 `IntentType` 联合类型，丢失了类型约束。 | P2（中） | 导入 `IntentType` 类型，将参数类型改为 `intent: IntentType | undefined`，在编译时捕获无效 intent 值。 |
| TD-019 | deepcode/__verify__.ts | 代码重复 | 验证脚本中重复定义了 CODE_RULES（line 77-83）、summarizeReasoning（line 156-166）、decideRoute（line 119-127），与源文件中的实现重复。源逻辑修改后测试脚本可能不同步，导致测试验证的是过时逻辑。 | P2（中） | 将验证脚本改为直接从源模块导入函数（`import { codeClassify }`、`import { decideRoute }`、`import { summarizeReasoning }`），确保测试始终验证生产代码。需要将这些纯函数从各自模块中导出。 |
| TD-020 | deepcode/hard-constraint/extractor.ts:196-203 | 哈希碰撞风险 | `generateConstraintId` 使用简单的 32-bit FNV-1a 风格哈希生成约束 ID。32-bit 哈希空间（~40亿）在约束数量较多时存在碰撞可能，导致去重逻辑失效。 | P3（低） | 对于约束 ID 场景影响有限（单 session 约束数量少），但可考虑使用更长的哈希（如 64-bit）或添加冲突检测。 |
| TD-021 | location-services.ts:133 | TEMP 标记 | `// This is temporary for backwards compatibility` 导出了 `locationServiceMapLayer`，是临时兼容层。 | P3（低） | 在主版本升级时移除 `locationServiceMapLayer` 导出，统一使用 `buildLocationServiceMap()`。 |
| TD-022 | deepcode/reasoning/manager.ts:129 | TD 标记 | 注释中提及 `LLM 摘要可作为后续优化（TD 记录）`，说明当前启发式摘要策略是临时方案，计划用 LLM 提升摘要质量。 | P3（低） | 后续迭代中实现 LLM-based 摘要：在后台异步调用 Flash 模型生成高质量摘要，缓存结果避免重复调用。 |

---

**扫描范围：**
- `/home/claude-user/packages/core/src/deepcode/` 目录下全部 11 个 .ts 文件
- `/home/claude-user/packages/core/src/location-services.ts`（DeepCode 集成部分）

**扫描模式：** TODO、FIXME、HACK、XXX、TEMP、@ts-ignore、`: any` / `as any`、`as unknown as`、魔法数字、弱类型、代码重复、动态 require

**统计：**
- TODO 注释：2 处（均标记为阶段三功能）
- TD 编号标记：3 处
- any 类型使用：1 处
- as unknown as 双重断言：3 处
- @ts-ignore：0 处
- FIXME/HACK/XXX：0 处
- 动态 require：1 处
- 空 catch 块：1 处
- 魔法数字/硬编码阈值：8 处
- 弱类型参数：1 处
- 测试代码重复：1 处
- TEMP 标记：1 处
