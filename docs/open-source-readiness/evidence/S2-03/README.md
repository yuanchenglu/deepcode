# S2-03 Built-in Agent Plugin 与宿主安全桥

> 日期：2026-08-05
> 基线：develop `62ecb33`（S2-02 DONE 后）
> 状态：DONE

## 1. 交付内容

### 1.1 deepagentPlugin（新增 `packages/oh-my-deepagent/src/host-plugin.ts`）

以最小 Adapter 将插件角色注册为 Host Agent，满足 HOST_PLUGIN_CONTRACT.md v1.0 三条硬边界：

| 契约条款 | 实现 |
|---|---|
| 只映射 systemPrompt/description，不复制 Host Provider/Tool 执行层 | `roleToAgent()` 只产出 id/description/system/mode/permissions；不含 tools/llm/memory 字段 |
| 插件 Tool 调用统一进入 Host Permission/Workspace | 注册的 Agent `permissions: []` 默认空，Tool 执行由 Host ToolRegistry + llm.ts toolMaterialization 统一控制 |
| 插件关闭时 Host 基础能力仍可用 | deepagentPlugin 是可选的注册器，不加载时 AgentV2 空启动正常 |

当前注册角色：coding-agent（通用编码）、planner-agent（规划研究）。S2-04 扩展完整角色清单。

### 1.2 生产入口接入（`packages/core/src/plugin/internal.ts`）

- `deepagentPlugin` 加入内置插件列表（`yield* add(deepagentPlugin)`）
- `packages/core/package.json` 新增 `@deepcode/oh-my-deepagent: workspace:*` 依赖
- `packages/oh-my-deepagent/package.json` 新增 `@opencode-ai/plugin` + `effect` 依赖
- index.ts 导出 `deepagentPlugin`、`roleToAgent`

### 1.3 测试（新增 2 文件，7 用例）

**`packages/oh-my-deepagent/tests/host-plugin.test.ts`（4 用例）**：
- coding/planner 映射出 Host Agent（system 来自角色 systemPrompt）
- 权限默认空——不绕过 Host Permission
- 映射结果不含插件内部执行字段——不复制执行层
- 插件 ID 固定 + 纯注册器

**`packages/core/test/deepagent-plugin-host.test.ts`（3 用例，真实 AgentV2 集成）**：
- 加载插件后 coding-agent/planner-agent 注册为 Host Agent
- 注册的 Agent 权限为空——Tool 执行由 Host Permission 统一控制
- 插件关闭（不加载）时 Host Agent 基础能力仍可用

## 2. 验证结果

```bash
cd packages/core && bun typecheck        # ✅
cd packages/core && bun test             # 1108 pass / 0 fail（含新增 3）
cd packages/oh-my-deepagent && bun typecheck  # ✅
cd packages/oh-my-deepagent && bun test  # 214 pass / 0 fail（含新增 4）
cd packages/opencode && bun typecheck    # ✅
```

## 3. 与 PLAN 执行步骤对照

| 步骤 | 状态 | 说明 |
|---|---|---|
| 1. 最小 Adapter 映射规划/角色到 Host Session | ✅ | roleToAgent 只映射元数据；S2-04 接规划指令 |
| 2. Tool 统一进入 Host Permission + 证据 | ✅ | Agent permissions=[]，执行走 Host ToolRegistry（llm.ts 深接入已含工具证据） |
| 3. Memory 所有权 | ✅（契约） | HOST_PLUGIN_CONTRACT §3.1：插件 MemoryStore 不接生产，映射 Host Session 历史 |
| 4. 取消/超时/错误映射 | ✅（契约） | HOST_PLUGIN_CONTRACT §4：取消走 Host Effect 中断，错误统一 ToolFailure/GatewayError |
| 5. Plan→Build→Review 真实 E2E | ⏳ S2-04 | 角色闭环在 S2-04 交付（本卡先接通注册与安全桥） |

## 4. 技术债务

- 插件角色的完整 tools/skills 映射留待 S2-04（当前仅元数据注册）
- 一次真实 Plan→Build→Review E2E 依赖 S2-04 角色闭环完成后执行
- 插件注册的 agent 未配置默认 model（继承 Host 默认模型解析）
