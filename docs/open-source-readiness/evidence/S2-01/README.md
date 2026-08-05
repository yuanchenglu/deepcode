# S2-01 调用图审计（初版）

> 日期：2026-08-04
> 基线：develop `6096998`
> 方法：从生产入口反向追踪 `packages/core/src/session/runner/llm.ts` 与 `packages/core/src/location-services.ts`

## 1. 已接入生产的模块（Keep）

`packages/core/src/session/runner/llm.ts` 直接 import 并调用 11 个模块（TASK_LOG 深接入成果），另 hard-constraint/extractor 被 store 内部调用，**合计 12 个模块已接入生产**：

| 模块 | import 路径 | llm.ts 中的 Service 注入 |
|------|------------|--------------------------|
| intent-router/classifier | `../../deepcode/intent-router/classifier` | `yield* DeepCodeIntentRouter.Service` → `classify`/`setCurrent`/`getStrategy` |
| router/model-router | `../../deepcode/router/model-router` | `yield* DeepCodeModelRouter.Service` → `setOverride` |
| reasoning/manager | `../../deepcode/reasoning/manager` | `yield* DeepCodeReasoningManager.Service` |
| context-layout/window-manager | `../../deepcode/context-layout/window-manager` | `yield* DeepCodeWindowManager.Service` |
| meta-directives/handlers | `../../deepcode/meta-directives/handlers` | `yield* DeepCodeMetaDirectives.Service` → `setFileReader`/`setModelSwitcher`/`setSearcher`/`handle` |
| immune-system/reviewer | `../../deepcode/immune-system/reviewer` | `yield* DeepCodeImmuneSystem.Service` |
| hard-constraint/store | `../../deepcode/hard-constraint/store` | `yield* DeepCodeConstraintStore.Service` → `extractAndAdd`/`getAll` |
| okr-plan | `../../deepcode/okr-plan` | `yield* DeepCodeOKRPlan.Service` → `getPlan` |
| review-anti-drift | `../../deepcode/review-anti-drift` | `yield* DeepCodeReviewAntiDrift.Service` |
| scope-creep-guard | `../../deepcode/scope-creep-guard` | `yield* DeepCodeScopeCreepGuard.Service` |
| memory-granularity | `../../deepcode/memory-granularity` | `yield* DeepCodeMemoryGranularity.Service` → `endStep` |

`packages/core/src/location-services.ts` 注册全部 14 个 node（30 处引用）。

## 2. 未接入生产的模块（0 生产调用，仅 node 注册或无引用）

| 模块 | 用途 | 状态 | 建议 |
|------|------|------|------|
| prefix-context | Byte-Stable Prefix（系统提示前缀冻结） | 仅 location-services 注册 node，llm.ts 未调用 | Adapt：接入 llm.ts 前缀组装或明确标记未接入 |
| hard-constraint/context-source | 硬约束上下文源 | 无生产引用 | 检查：与 extractor/store 的关系，可能冗余 |
| prompt-signal/tagger | Prompt 信号标签（mHC/MoE） | 无生产引用 | Adapt 或标记 Experimental |
| skill-evolution | 技能进化 | 仅 location-services 注册 node | 标记 Experimental（S2-04 角色/技能接通） |
| deepcode/index.ts | 模块导出索引 | 保持 | 导出层 |

**修正说明**：hard-constraint/extractor 被 store 内部调用（`import { extractHardConstraints, renderConstraints } from "./extractor"`），故 hard-constraint 全链路（extractor→store→llm.ts）**已接入**，不属于未接入清单。

## 3. 测试覆盖缺口

- 18 个模块仅 `store`（tool-output-store.test.ts）和 `index`（index.test.ts）有测试
- 其余 16 个模块无直接单测；llm.ts 深接入路径依赖 session-runner 集成测试（126 pass）

## 4. 与 13_V0.1_MIGRATION_MANIFEST.md 的关系

本审计是更新 migration manifest 的事实基础：11 个模块 Keep，5 个模块 Adapt/Experimental，无 Replace/Remove 证据（均未发现与 OpenCode 上游冲突）。

## 5. 下一步（S2-02）

- 对 11 个已接入模块建立 Provider Contract 测试（wire 层）
- 对 4 个未接入模块决定 Adapt 或明确 Experimental 标记，不允许"代码存在即完成"
- Router 决策记录（model.applied）补齐

## 6. oh-my-deepagent 与 deepcode-gateway 接入状态（S2-01 范围补充）

### oh-my-deepagent（@deepcode/oh-my-deepagent）
- 54 文件，src 含 role（13+ 角色：metis/momus/oracle/planner/coordinator/builder/coding/search/knowledge/system 等）、llm、planning、memory、runtime、skill、tool、transport
- **0 生产消费者**：core/src 和 opencode/src 均无引用 → 插件未接入 Host
- S2-03 范围：将 role/skill/planning 通过最小 Adapter 接入 Host Session

### deepcode-gateway（@deepcode/gateway）
- 55 文件，src 含 feishu/dingtalk/wecom/qq/wechat adapter、session-bridge、lifecycle、connection、router
- **0 生产消费者**：core/src 和 opencode/src 均无引用；仅有独立 `startup.ts`（`bun run startup.ts`）入口
- 已知技术债（TASK_LOG）：飞书 WSClient 连接成功但消息到 session-bridge 传递断（Effect.runFork Runtime 问题）
- S2-06/07 范围：Gateway Core 安全整改 + 飞书 Stable

## 7. 来源图与契约清单（已冻结 2026-08-05）

### 来源图

| 来源 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| `input/oh-my-openagent`（github.com/code-yeongyu/oh-my-openagent） | oh-my-opencode 4.15.1 | SUL-1.0（Sustainable Use License，限制性） | packages/oh-my-deepagent 插件能力来源（role/skill/planning/tool/memory/transport/llm） |
| `input/superpowers`（github.com/obra/superpowers） | - | MIT（Jesse Vincent 2025） | 角色/技能方法论参考 |
| `input/DeepSeek-V4-Flash/Pro(-Base)` | - | MIT（DeepSeek 2023） | 模型契约/权重参考 |
| `input/OpenSpec` | - | - | 规格文档参考 |

**许可证约束**：oh-my-openagent 为 SUL-1.0 限制性许可，从插件复制进 Host 的代码必须保持许可证标注；MIT 来源（superpowers/DeepSeek）可自由合并但需保留版权声明。S1-05 已审计通过。

### 契约清单（FROZEN）

- Host↔Plugin 契约：`docs/open-source-readiness/HOST_PLUGIN_CONTRACT.md`（v1.0 冻结）
- Host↔Gateway 契约：`docs/open-source-readiness/HOST_GATEWAY_CONTRACT.md`（v1.0 冻结）

冻结内容包括：输入/输出/错误/取消/证据契约 + 边界原则 + 锚点签名。S2-03/S2-06 实现必须遵守，变更需走 PLAN 变更流程。

### MIGRATION_MANIFEST

已按审计结论更新：`docs/open-source-readiness/13_V0.1_MIGRATION_MANIFEST.md` §4（oh-my-deepagent 分类）与更新记录。
