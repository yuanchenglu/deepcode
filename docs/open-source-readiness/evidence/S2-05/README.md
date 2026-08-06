# S2-05 Delegation、Subagent 与 Multi-Agent

> 日期：2026-08-05
> 基线：develop `86e594e`（S2-04 DONE 后）
> 状态：DONE（协调规则层；运行时接入随 S2-08 核心能力发布）

## 1. 真实缺口审计

Host（packages/core）有 `parentID` 会话字段 + `mode: "subagent"` agent 定义，但**无 delegation 协调规则层**（权限继承/工作区校验/冲突检测均无实现）。oh-my-deepagent 有 coordinator 角色但 tools 为空，无委托逻辑。

## 2. 交付内容

### 2.1 Delegation 协调模块（新增 `src/delegation/delegation.ts`）

纯逻辑层（无 LLM/Host 依赖，便于 Contract 测试），覆盖 PLAN 验收点：

| 函数 | 规则 | PLAN 对应 |
|---|---|---|
| `inheritPermissions` | 子 Agent 只能缩小权限：parent allow→ask（更保守）、deny 保持、子任务可新增 deny、不可新增/升级 allow | 步骤 3 权限不可升级 |
| `validateWorkspace` | 子任务 workspace 必须等于父或位于父内；跨 Workspace 需重新授权 | 步骤 3 跨 Workspace 重新授权 |
| `detectWriteConflicts` | 并行任务改同一文件 → 冲突交回协调者（merge-back），不后写覆盖 | 步骤 4 冲突检测 |
| `SubTask` 结构 | parentSession/childSession/taskID/agentID/workspace/permissions/status | 步骤 1 可追踪到 parent |

### 2.2 测试（新增 `tests/delegation.test.ts`，12 用例）

- 权限继承：allow 降级 / deny 保持 / 显式收紧 / 不可新增 allow / 不可覆盖 deny
- 工作区：等于/位于父内合法；父外/前缀相似（project-sibling）非法
- 冲突：无重叠无冲突；两任务/三任务同文件冲突检测 + merge-back
- SubTask 追踪结构契约

### 2.3 导出（`src/delegation/index.ts` + `src/index.ts`）

## 3. 验证结果

```bash
cd packages/oh-my-deepagent && bun typecheck  # ✅
cd packages/oh-my-deepagent && bun test       # 235 pass / 0 fail（含新增 12）
cd packages/core && bun typecheck             # ✅
cd packages/core && bun test                  # 1108 pass / 0 fail
```

## 4. PLAN 执行步骤对照

| 步骤 | 状态 | 说明 |
|---|---|---|
| 1. parent/child、Agent ID、任务 ID 继承规则 | ✅ | SubTask 结构 + delegation 模块 |
| 2. 并发上限/预算/深度/取消 | ⏳ 运行时 | 规则层已定义 status 状态机；并发执行在 S2-08 接入 |
| 3. 子 Agent 只缩小权限；跨 Workspace 重新授权 | ✅ | inheritPermissions + validateWorkspace 契约测试 |
| 4. 冲突检测交回协调者 | ✅ | detectWriteConflicts 契约测试 |
| 5. 覆盖：单子任务/并行/冲突/失败/取消/恢复 | ⏳ 运行时 | S2-08 核心能力发布时做运行时 E2E |

## 5. 技术债务

- 并发上限/预算/深度/取消的**运行时执行**未接入（当前为规则层）；S2-08 需要将 delegation 接入 Host Session 执行
- 真实多 Agent 提升证据（任务证据而非演示日志）依赖 S2-08 运行时 E2E
- 冲突检测当前为"检测后交回"策略；自动合并策略留待后续
