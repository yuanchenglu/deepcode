# Host ↔ Gateway 契约（冻结版 v1.0）

> 冻结时间：2026-08-05（S2-01 完成）
> 冻结人：小路的数字分身
> 状态：**FROZEN** — S2-06 接通 Gateway Core 时必须遵守，修改需走 PLAN 变更流程
> 依据：源码审计（packages/deepcode-gateway/src/adapter.ts、message.ts、session-bridge.ts、plugin.ts、router.ts、server.ts）

## 0. 契约目标

Gateway（packages/deepcode-gateway，多平台消息网关）与 Host（packages/core + packages/opencode）之间的唯一合法边界。Gateway 负责平台适配与消息路由，**不复制 Host 的会话/工具/权限语义**。

## 1. 边界原则

1. Gateway 只做：平台消息解析 → 标准化消息 → 转发 Host 执行 → 结果回发。
2. 会话权威在 Host（opencode session）；Gateway 只维护平台 chatId → Host sessionId 的**映射缓存**（sessionMap），不是第二套会话存储。
3. 权限/工具/工作目录判断全部在 Host 侧，Gateway 不做业务决策。
4. Gateway 通过 `opencode run` CLI 子进程与 Host 交互（当前实现），S2-06 若改为 API 直连需重新冻结本契约。

## 2. Gateway 侧契约面（已存在）

### 2.1 消息模型（packages/deepcode-gateway/src/message.ts）

```ts
export type GatewayMessage   // 入站：平台消息 → 标准化
export type OutboundMessage  // 出站：Host 结果 → 平台格式
export type SendResult       // 发送结果
export type PlatformType = "feishu" | "dingtalk" | "wecom" | "qq" | "wechat" | "telegram" | "slack" | "signal" | "whatsapp" | "matrix" | "email"
export type MessageType / ChatType / OutboundType
```

### 2.2 适配器接口（packages/deepcode-gateway/src/adapter.ts）

```ts
export interface PlatformAdapter {
  // 解析入站消息 → 标准化 GatewayMessage
  // 发送 OutboundMessage → 平台
}
export interface PlatformCrypto { ... }   // 平台签名/加密
export interface AdapterConfig { ... }
```

已实现适配器：Feishu、WeCom、QQ、WeChat、Telegram、Slack、Signal、WhatsApp、DingTalk、Matrix、Email（各平台 crypto/parser/adapter 三件套）。

### 2.3 会话桥（packages/deepcode-gateway/src/session-bridge.ts）

```ts
export function getOrCreateSession(chatId: string): string | null  // 映射缓存
export function processMessage(msg: GatewayMessage, adapter: PlatformAdapter, workdir: string): Promise<...>
  // 流程：提取文本 → 获取/创建 session → opencode run CLI 执行 → 解析 sessionID → 回发
export function setSessionId(chatId: string, sessionId: string): void
```

### 2.4 生命周期与路由（packages/deepcode-gateway/src/lifecycle.ts / router.ts / server.ts）

```ts
export function registerAdapter(adapter) / startGateway(port) / stopGateway() / getMessageQueue()
export class Router         // 平台消息路由
export function startServer(port) / stopServer()
```

### 2.5 插件入口（packages/deepcode-gateway/src/plugin.ts）

```ts
export const gatewayPlugin = define({
  id: "@deepcode/gateway",
  effect: (context) => ...   // 读 context.options.gateway 配置，注册 Feishu/WeChat 适配器，startGateway(3099)
})
```

## 3. Host 侧消费面

当前 Host 无生产消费 Gateway 的代码路径（S2-01 审计确认 0 consumers）。Gateway 通过 CLI 子进程 + `@opencode-ai/plugin/v2/effect/plugin` 插件钩子与 Host 交互。

**契约**：S2-06 接通时必须满足：
1. 插件钩子（gatewayPlugin）保持 `@opencode-ai/plugin/v2` 接口，不得改回旧版插件协议。
2. 配置入口唯一：Host 配置 `options.gateway.*` 段。
3. 平台凭证只从配置/环境读取，不得硬编码在源码。

## 4. 输入/输出/错误/取消/证据契约

| 维度 | 契约 |
|---|---|
| 输入 | 平台原始消息 → PlatformAdapter 解析 → 标准化 GatewayMessage（text/chatId/platformType） |
| 输出 | Host 执行结果 → OutboundMessage → PlatformAdapter 发送回平台 |
| 错误 | 平台适配错误统一 GatewayError（error.ts 有 GatewayErrorCode）；回发失败可重试，不吞错 |
| 取消 | 会话生命周期由 Host 控制；Gateway 不主动 kill Host 子进程（S2-06 需评审） |
| 证据 | Gateway 不产生产品级证据；会话证据由 Host session 记录 |

## 5. 已知技术债（S2-06/S2-07 处理）

1. **飞书 WSClient 消息到 session-bridge 传递断**（Effect.runFork Runtime 问题，TASK_LOG 遗留）→ S2-07 飞书 Stable 必修。
2. sessionMap 是内存 Map，重启丢失 → S2-06 评审是否需要持久化。
3. CLI 子进程交互 vs API 直连 → S2-06 决定，变更需更新本契约。
4. 无鉴权入队路径、无界 Queue 等 → S2-06 安全整改清单（来自 13_MIGRATION_MANIFEST §7 Replace/Remove 候选）。

## 6. 冻结签名（防漂移）

- Gateway 侧锚点：`packages/deepcode-gateway/src/index.ts`（导出面）、`adapter.ts`、`message.ts`、`session-bridge.ts`、`plugin.ts`
- Host 侧锚点：`packages/core/src/session/runner/llm.ts`、`packages/core/src/tool/*`、`packages/core/src/permission/sql.ts`
- 任何一侧锚点签名变更必须更新本文档并走 S2-06 变更记录
