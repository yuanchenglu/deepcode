# DeepCode 维护指南

> 面向：产品经理、新加入的开发者、运维人员
> 目标：理解代码结构、知道如何新增功能、常见问题排查

---

## 一、一分钟理解 DeepCode

DeepCode 不是从零开始的项目，它是：

**OpenCode（一个成熟的开源 Coding Agent）+ 14 个 Harness 层改造模块 + 飞书/微信网关**

```
如果你之前用过 Claude Code / Cursor / Codex CLI，OpenCode 就是类似的东西。
DeepCode 在它上面加了：
  ✓ 为 DeepSeek V4 模型做的物理特性优化（Prefix Cache、Flash/Pro 路由等）
  ✓ 14 个智能增强模块（意图识别、硬约束保护、防漂移、免疫系统等）
  ✓ 飞书/微信消息入口（用户可以直接在聊天工具里 @DeepCode 写代码）
```

---

## 二、代码在哪里？

### 核心目录速查

| 你想找什么 | 去哪里找 |
|-----------|---------|
| DeepCode 的 14 个核心模块 | `packages/core/src/deepcode/` |
| OpenCode 的 Agent 主循环 | `packages/opencode/src/session/runner/` |
| 系统提示词组装 | `packages/core/src/system-context/` |
| 飞书/微信网关 | `packages/deepcode-gateway/src/` |
| 模型/Provider 配置 | `packages/llm/src/` |
| 工具实现（read/write/shell） | `packages/core/src/tool/` |
| 插件系统 | `packages/core/src/plugin/` |
| 数据库/Schema | `packages/schema/src/` |

### DeepCode 14 模块速查表

不用记住所有代码，需要改的时候按这个表找：

| 你想改什么行为 | 改哪个文件 |
|--------------|-----------|
| 系统提示词开头的 DeepCode 自我介绍 | `prefix-context.ts` 的 `renderPrefix()` |
| 增加新的硬约束关键词（如"严禁用AI生成"） | `hard-constraint/extractor.ts` 的 `CONSTRAINT_PATTERNS` |
| 调整什么情况下用 Flash 什么时候用 Pro | `router/model-router.ts` 的 `decideRoute()` |
| 修改意图分类规则（什么关键词算 Refactor） | `intent-router/classifier.ts` 的 `CODE_RULES` |
| 调整各意图的审查严格度/计划粒度 | `intent-router/classifier.ts` 的 `STRATEGY_TABLE` |
| 免疫系统除了备份还检查什么 | `immune-system/reviewer.ts` 的 `reviewCheckpoint()` |
| 元指令增加新原语 | `meta-directives/handlers.ts` |
| 调整 Token 预算（各区域分配多少） | `context-layout/window-manager.ts` 的 `FLASH_BUDGET/PRO_BUDGET` |
| 修改信号标签类型/顺序 | `prompt-signal/tagger.ts` |
| 计划级联逻辑/步骤状态机 | `okr-plan.ts` |
| Review 触发频率/档位公式 | `review-anti-drift.ts` 的 `computeTier()` |
| 哪些文件属于高风险/不能随便改 | `scope-creep-guard.ts` 的 `isHighRiskFile()` 相关 |
| Skill 进化的成功率阈值 | `skill-evolution.ts` 的状态机逻辑 |
| 记忆保留时间/λ值配置 | `memory-granularity.ts` 的 `INTENT_LAMBDA_MAP` |

---

## 三、如何新增一个功能

### 3.1 新增一个 Harness 模块（以"增加敏感信息扫描"为例）

**步骤：**

1. **在 `packages/core/src/deepcode/` 下创建新文件**
   ```
   sensitive-scanner/
   └── scanner.ts
   ```

2. **按现有模式写代码**（参考 `hard-constraint/` 的结构）：
   ```typescript
   /**
    * 敏感信息扫描模块
    * （中文文件头注释说明功能、设计背景）
    */
   import { Context, Effect, Layer, Ref } from "effect"
   import { makeLocationNode } from "../../effect/app-node"

   // 1. 定义服务接口
   export interface Interface {
     readonly scan: (content: string) => Effect.Effect<string[]>
   }

   // 2. 定义 DI token
   export class Service extends Context.Service<Service, Interface>()(
     "@opencode/v2/DeepCodeSensitiveScanner",
   ) {}

   // 3. 实现 Layer
   const layer = Layer.effect(Service, Effect.gen(function* () {
     return Service.of({
       scan: // ...实现
     })
   }))

   // 4. 导出 LocationNode
   export const node = makeLocationNode({
     name: "deepcode-sensitive-scanner",
     layer,
     deps: [], // 依赖的其他 node
   })
   ```

3. **在 `packages/core/src/deepcode/index.ts` 导出 node**
   ```typescript
   export { node as DeepCodeSensitiveScannerNode } from "./sensitive-scanner/scanner"
   ```

4. **在 `packages/core/src/location-services.ts` 注册到数组**
   ```typescript
   // 导入
   DeepCodeSensitiveScannerNode,
   // 添加到 locationServices 数组
   DeepCodeSensitiveScannerNode,
   ```

5. **如果需要接入执行流（非自动运行的服务）**：找到合适的 Hook 点注入
   - 工具调用前拦截：参考 `scope-creep-guard.ts`
   - System Context 注入：参考 `hard-constraint/context-source.ts`
   - Checkpoint 审查：参考 `immune-system/reviewer.ts`

### 3.2 新增一个平台适配器（以"新增钉钉"为例）

在 `packages/deepcode-gateway/src/adapters/` 下：

1. 实现 `PlatformAdapter` 接口（见 `platform-adapter.ts`）
2. 在 `event-router.ts` 注册路由
3. 在 `http-server.ts` 添加 Webhook endpoint

---

## 四、常见问题排查

### 4.1 编译/类型错误

```bash
# 进入对应 package 目录
cd packages/core
# 运行类型检查
bun typecheck
# 或者用 tsc 直接检查（但推荐用 bun run typecheck）
npx tsc --noEmit
```

**常见错误：**
- `Cannot find name 'Effect'` → 忘记 import
- `Layer mismatch` → deps 数组写错了，缺少依赖或多写了
- `Type 'X' is not assignable to type 'Y'` → 接口字段名不一致（参考 BUG-003）

### 4.2 KV Cache 命中率低

**现象：** 每轮请求 Prefix Cache 都 miss，响应变慢。

**排查清单：**
1. 检查 System Prompt 是否每轮都在变化：
   - ❌ 错误：`const now = new Date()` 放在 prefix 里
   - ✅ 正确：动态内容走 Mid-Conversation System Message
2. 检查 `renderPrefix()` 是否有随机数/时间戳
3. 检查 SignalTag 的顺序是否固定（不能因为 Map 遍历顺序变化）

### 4.3 Flash 模型总是失败

**排查清单：**
1. 看路由日志：`getHistory()` 输出 route reason
2. 如果是高风险文件触发升级，检查 `highRiskPatterns` 配置
3. 如果是连续失败升级，看 `recordFailure()` 的计数
4. 手动 override：调用 `setOverride("pro")` 强制用 Pro

### 4.4 约束没生效/模型还是改了不能改的文件

**排查清单：**
1. 检查正则是否匹配到了约束（`extractHardConstraints()` 单测）
2. 确认约束是否注入到了 System Context（查看 Mid-Conversation Message）
3. Scope Creep Guard 是否拦截了工具调用
4. 检查约束是否因为中文表达问题未被正则匹配（如"千万别删"不在模式里）

### 4.5 网关收不到飞书/微信消息

**排查清单：**
1. 飞书开放平台 → 事件订阅 → 验证 URL 是否能通
2. 检查 Encrypt Key 和 Verification Token 配置
3. 看 HTTP Server 日志：`bun run gateway` 看 console 输出
4. 确认公网可访问（用 ngrok/frp 做内网穿透测试）

---

## 五、配置说明

### 5.1 DeepCode 配置（opencode.json）

```json
{
  "deepcode": {
    "routing": {
      "highRiskPatterns": ["*.sql", "*.env*"],
      "failureUpgradeThreshold": 2,
      "autoFallback": true
    },
    "reasoning": {
      "stripHistory": true,
      "maxSummaryChars": 200
    },
    "memory": {
      "workingMemoryTurns": 3,
      "coldMemoryPruneTurns": 20
    }
  },
  "gateway": {
    "feishu": {
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "verificationToken": "xxx",
      "encryptKey": "xxx"
    },
    "wecom": {
      "corpId": "xxx",
      "agentId": "xxx",
      "secret": "xxx",
      "token": "xxx",
      "encodingAESKey": "xxx"
    }
  }
}
```

### 5.2 环境变量

| 变量名 | 用途 | 必填 |
|-------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek V4 API 密钥 | ✅ |
| `DEEPSEEK_FLASH_MODEL` | Flash 模型名（默认 `deepseek-v4-flash`） | ⭕ |
| `DEEPSEEK_PRO_MODEL` | Pro 模型名（默认 `deepseek-v4-pro`） | ⭕ |
| `FEISHU_APP_ID` | 飞书应用 ID（网关功能需要） | ⭕ |
| `FEISHU_APP_SECRET` | 飞书应用 Secret | ⭕ |
| `WECOM_CORP_ID` | 企业微信 Corp ID | ⭕ |
| `GATEWAY_PORT` | 网关 HTTP 端口（默认 8787） | ⭕ |

---

## 六、测试策略

### 6.1 核心模块单元测试

每个 DeepCode 模块的纯函数可以独立测试：

```typescript
// 例如 hard-constraint/extractor.test.ts
import { describe, expect, test } from "bun:test"
import { extractHardConstraints } from "./extractor"

describe("extractHardConstraints", () => {
  test("识别禁止类约束", () => {
    const result = extractHardConstraints("不要修改 config 文件")
    expect(result[0].type).toBe("forbid")
  })
})
```

### 6.2 集成测试清单

| 测试项 | 怎么测 |
|-------|-------|
| 类型检查通过 | `cd packages/core && bun typecheck` |
| 所有模块注册成功 | 启动 OpenCode，看日志是否有 booting location services |
| 硬约束注入 | 发消息"不要修改 package.json"，检查 System Context |
| Flash/Pro 路由 | 发简单任务看 route reason 是 Flash，架构任务是 Pro |
| 飞书 Webhook | curl POST 模拟飞书事件，看是否返回 challenge |
| 微信 Webhook | curl POST 模拟微信验证URL，看 echostr 返回 |

---

## 七、已知技术债务（TODO 追踪）

| 编号 | 模块 | 债务描述 | 优先级 |
|------|------|---------|-------|
| TD-001 | 所有模块 | 与主流程（SessionRunner）的集成 Hook 未完成 | P0 |
| TD-002 | skill-evolution | Skill 持久化到磁盘（当前只在内存） | P1 |
| TD-003 | meta-directives | propose_skill 安全验证 + 持久化 | P1 |
| TD-004 | hard-constraint | DB 持久化约束（当前 Ref 内存） | P2 |
| TD-005 | immune-system | LLM 语义审查（当前只有备份规则） | P1 |
| TD-006 | reasoning | 三阶段策略与 SessionRunner 集成 | P1 |
| TD-007 | memory-granularity | Semantic Memory（跨 session 持久化）未实现 | P2 |
| TD-008 | model-router | route reason 持久化到 DB | P2 |
| TD-009 | review-anti-drift | Tier4 origin reinjection 集成 | P2 |
| TD-010 | scope-creep-guard | 用户确认审批流程 UI | P1 |

---

## 八、Git 提交规范

所有提交遵循双语标题：

```
type(scope): 英文描述 | 中文描述

示例：
feat(deepcode): implement hard constraint extractor | 实现硬约束提取器
fix(router): fix operator precedence bug in okr-plan | 修复okr-plan运算符优先级Bug
docs(architecture): update module dependency graph | 更新模块依赖图
```

Type 必须是：`feat` / `fix` / `docs` / `chore` / `refactor` / `test`

---

*文档维护者：DeepCode 团队*
*有问题先读这个文件，再看代码注释，最后再问人*
