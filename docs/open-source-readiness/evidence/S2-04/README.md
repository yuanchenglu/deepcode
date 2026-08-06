# S2-04 完成角色、技能、规划与评审能力

> 日期：2026-08-05
> 基线：develop `7590601`（S2-03 DONE 后）
> 状态：DONE（三角闭环；其余角色按证据分级待后续）

## 1. 真实缺口审计

| 缺口 | 证据 |
|---|---|
| **无 reviewer 角色**（三角闭环缺一角） | 13 个角色中无 reviewer（grep 无结果） |
| RoleDefinition 无权限字段 | types.ts 原无 permissions |
| Skill loader 受控目录无契约测试 | skill-manager.test.ts 未覆盖"目录外不被发现" |

## 2. 交付内容

### 2.1 reviewer 角色（新增 `src/role/reviewer-agent.ts`）

- id=`reviewer`（遵循新角色命名规范：不含 `-agent` 后缀）
- 职责：审查 diff/测试/证据，结论必须引用具体证据，问题分级（blocker/major/minor）
- 默认权限：read allow / edit deny / bash deny（只读，不能改代码）

### 2.2 RoleDefinition 权限字段（`src/types.ts`）

新增 `permissions?: Array<{ action, resource, effect }>`，格式对齐 Host Permission。`defineRole` 深拷贝 permissions。

### 2.3 三角角色权限矩阵（Coding/Planner/Reviewer）

| 角色 | 权限 | 设计理由 |
|---|---|---|
| coding-agent | read allow / edit allow / bash ask | 可读写，执行命令需确认 |
| planner-agent | read allow / bash deny | 只规划，不写代码不执行 |
| reviewer | read allow / edit deny / bash deny | 只审查，最小权限 |

### 2.4 Host 插件注册 reviewer（`src/host-plugin.ts`）

- 注册角色扩展为 coding/planner/reviewer 三角
- roleToAgent 传递 permissions（`role.permissions ?? []`）

### 2.5 测试（+9 用例）

**`tests/role-triad.test.ts`（新增 8）**：三角齐全、权限矩阵、失败场景（planner/reviewer 不写代码）、成功场景约束（reviewer 引用证据、planner 可执行步骤、coding 小而可回滚）、默认角色集含三角。

**`tests/skill-manager.test.ts`（+1）**：只加载受控 roots 目录，目录外技能不被发现（PLAN 步骤 3 契约）。

**同步更新**：role-registry/role-names/e2e 角色数 13→14；host-plugin 权限断言改为"映射来自角色定义"。

## 3. 验证结果

```bash
cd packages/oh-my-deepagent && bun typecheck  # ✅
cd packages/oh-my-deepagent && bun test       # 223 pass / 0 fail（含新增 9）
cd packages/core && bun typecheck             # ✅
cd packages/core && bun test                  # 1108 pass / 0 fail
cd packages/opencode && bun typecheck         # ✅
```

## 4. PLAN 执行步骤对照

| 步骤 | 状态 |
|---|---|
| 1. 每角色定义价值/输入/输出/工具/权限/模型/失败条件 | ✅ 三角角色权限矩阵；其余角色待逐个接入（步骤 2 要求先三角） |
| 2. 先交付 Coding/Planner/Reviewer 三角闭环 | ✅ 三角齐全 + 权限 + Contract 测试 |
| 3. Skill loader 只加载受控目录 | ✅ 契约测试验证 roots 边界 |
| 4. Planner 可执行/可恢复/可取消 | ✅ systemPrompt 约束；恢复/取消机制在 S2-05 |
| 5. 每角色 Contract + E2E + 分级 | ✅ 三角 Contract；E2E 依赖 S2-05 Delegation |

## 5. 技术债务

- 其余 11 角色（builder/knowledge/coordinator/search/oracle/metis/momus/multimodal/artistry/codingMini/system）未定义权限矩阵，保持 Experimental，按 PLAN 步骤 2 不得全部标 Stable
- Planner 恢复/取消的运行时机制（非 prompt 约束）在 S2-05 落实
- 真实 Plan→Build→Review E2E 在 S2-05 三角闭环后执行
