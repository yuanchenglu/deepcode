# Host ↔ Plugin 契约（冻结版 v1.0）

> 冻结时间：2026-08-05（S2-01 完成）
> 冻结人：小路的数字分身
> 状态：**FROZEN** — S2-03 接通 Built-in Agent Plugin 时必须遵守，修改需走 PLAN 变更流程
> 依据：源码审计（packages/core/src/session/runner/llm.ts、packages/core/src/tool/tool.ts、packages/core/src/tool/registry.ts、packages/oh-my-deepagent/src/index.ts）

## 0. 契约目标

Host（packages/core + packages/opencode）与 Built-in Plugin（packages/oh-my-deepagent）之间的**唯一合法边界**。插件不得复制 Host 的 Provider/Tool 执行层；Host 不得直接依赖插件内部 runtime 细节。

## 1. 边界原则（与 PLAN S2-03 执行步骤 1 对齐）

1. 插件规划/角色请求 → 通过最小 Adapter 映射到 Host Session，**不复制 Host Provider/Tool 执行层**。
2. 插件所有 Tool 调用 → 统一进入 Host Permission 与 Workspace。
3. 写入证据必须包含：parent session、agent、tool、decision、workspace。
4. 许可证边界：插件来源 `input/oh-my-openagent`（oh-my-opencode v4.15.1，SUL-1.0 限制性许可），任何从插件复制进 Host 的代码必须保持许可证标注。

## 2. Host 侧契约面（已存在，插件必须适配）

### 2.1 Tool 注册与执行

```ts
// packages/core/src/tool/tool.ts — 工具定义
export interface Definition<Input, Output> {
  name: string          // 工具名
  description: string   // 描述
  input: SchemaType<Input>   // 输入 Schema（Effect Schema）
  output: SchemaType<Output> // 输出 Schema
  // 执行/权限/结算：
}
export const withPermission = (tool, name) => ...   // 工具挂权限
export const permission = (tool, name) => ...       // 查询权限名
export const settle = (tool, call, context) => ...  // 结算副作用

// packages/core/src/tool/registry.ts — 注册表
export class Service extends Context.Service<Service, Interface>()("@opencode/v2/ToolRegistry") {}
```

**契约**：插件声明工具必须用 Host `Tool.make` + `ToolRegistry.Service` 注册，权限通过 `withPermission` 声明，执行副作用通过 `settle` 结算。禁止绕过 Host 直接执行。

### 2.2 Permission / Workspace

```ts
// packages/core/src/permission/sql.ts
export const PermissionTable = sqliteTable(...)  // 持久化权限表
```

**契约**：插件 Tool 的权限检查必须走 Host Permission 表（permission/sql.ts），工作目录边界由 Host Workspace 控制。插件不持有独立权限判断逻辑。

### 2.3 Session Runner 入口（生产消费方）

```ts
// packages/core/src/session/runner/llm.ts
// 已 Service 注入的 Harness 模块（S2-01 调用图审计）：
DeepCodeIntentRouter.Service    → classify / setCurrent / getStrategy
DeepCodeModelRouter.Service     → setOverride
DeepCodeReasoningManager.Service
DeepCodeWindowManager.Service
DeepCodeMetaDirectives.Service  → setFileReader / setModelSwitcher / setSearcher / handle
DeepCodeImmuneSystem.Service
DeepCodeConstraintStore.Service → extractAndAdd / getAll
DeepCodeOKRPlan.Service         → getPlan
DeepCodeReviewAntiDrift.Service
DeepCodeScopeCreepGuard.Service
DeepCodeMemoryGranularity.Service → endStep
```

**契约**：插件要挂接 Harness 能力，只能通过上述已注册 Service（或 location-services 新注册的 node），不能 import deepcode/ 内部模块直连。

## 3. 插件侧契约面（S2-03 需暴露/适配的最小面）

### 3.1 必须映射到 Host 的插件能力（Keep/Adapt）

| 插件能力 | 插件现有实现 | 映射目标 |
|---|---|---|
| Role 注册（13+ 角色） | `role/role-registry.ts` | Host Session 角色字段 / S2-04 |
| Skill 加载 | `skill/skill-manager.ts` | Host Skill 注册 / S2-04 |
| Planning | `planning/planner.ts` | Host Session 规划指令 / S2-04 |
| Tool 执行 | `tool/tool-runner.ts` | **必须改走 Host ToolRegistry + Permission**（S2-03 核心） |
| Memory | `memory/memory-store.ts` | 映射 Host Session 历史，不并存第二套权威存储 |
| LLM Provider | `llm/openai-compatible.ts` 等 | **不接生产**，插件 provider 仅测试/兼容用途 |

### 3.2 不允许（插件侧红线）

- 插件 ToolRunner 直接执行副作用（绕过 Host Permission/Workspace）
- 插件 MemoryStore 作为生产会话权威存储
- 插件独立 Provider 链在生产路径被调用
- 从插件复制 runtime 到 Host 且不带 SUL-1.0 许可证标注

## 4. 输入/输出/错误/取消/证据契约

| 维度 | 契约 |
|---|---|
| 输入 | 插件收到的输入必须是 Host Session 规范化消息（to-llm-message 格式），插件不定义第二套消息协议 |
| 输出 | 插件产出写回 Host Session 消息流，经 publish-llm-event 发布 |
| 错误 | 插件错误统一包装为 Host ToolFailure / GatewayError，不泄漏插件内部栈 |
| 取消 | 插件 Tool 执行必须响应 Host 取消信号（Effect 中断），不允许孤儿子进程 |
| 证据 | 插件工具调用写入证据：parent session + agent + tool + decision + workspace（S2-03 执行步骤 3） |

## 5. 冻结签名（防漂移）

- Host 侧锚点：`packages/core/src/tool/tool.ts`、`packages/core/src/tool/registry.ts`、`packages/core/src/permission/sql.ts`、`packages/core/src/session/runner/llm.ts`
- 插件侧锚点：`packages/oh-my-deepagent/src/index.ts`（导出面：AgentRuntime、runMessageLoop、ToolRunner、MemoryStore、SkillManager、Planner、Transport）
- 任何一侧锚点签名变更必须更新本文档并走 S2-03 变更记录
