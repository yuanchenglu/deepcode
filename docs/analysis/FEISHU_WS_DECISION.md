# 飞书 WebSocket 长连接方案决策文档

> 架构师：高见远 | 日期：2026-07-20  
> 工作目录：`/Volumes/Doc/Code/deepcode`  
> 涉及包：`packages/deepcode-gateway`

---

## 目录

1. [飞书长连接的正确实现方式（官方文档确认）](#1-飞书长连接的正确实现方式官方文档确认)
2. [basalt 方案为什么错](#2-basalt-方案为什么错get_endpoint-api-不存在)
3. [Node SDK 的 WSClient 正确用法 + 之前收不到事件的可能原因](#3-node-sdk-的-wsclient-正确用法--之前收不到事件的可能原因)
4. [三方案对比表](#4-三方案对比表)
5. [推荐方案 + 理由](#5-推荐方案--理由)
6. [具体实现细节](#6-具体实现细节)
7. [待明确事项](#7-待明确事项)

---

## 1. 飞书长连接的正确实现方式（官方文档确认）

### 1.1 官方文档原文

飞书官方文档（[使用长连接接收事件](https://open.feishu.cn/document/server-side-sdk/python--sdk/handle-events?lang=zh-CN) / [Node.js SDK 处理事件](https://open.larkoffice.com/document/server-side-sdk/nodejs-sdk/handling-events)）明确说明：

> **长连接是飞书 SDK 内提供的能力**，你可以在本地服务器集成飞书 SDK，与开放平台建立一条 WebSocket 全双工通道（你的服务器需要能够访问公网）。后续当应用订阅的事件发生时，开放平台会通过该通道向你的服务器发送消息。

关键点：**长连接是 SDK 内部封装的能力，不是公开的 REST API**。开发者不能直接调用某个 HTTP 接口获取 WebSocket 地址然后自己建连——必须通过 SDK 来完成。

### 1.2 SDK 内部的连接流程（源码确认）

通过阅读 `@larksuiteoapi/node-sdk` 的 `ws-client/index.ts` 源码（[GitHub](https://github.com/larksuite/node-sdk/blob/main/ws-client/index.ts)），SDK 内部的连接流程如下：

```
WSClient.start()
  → pullConnectConfig()
      → POST /callback/ws/endpoint    ← 注意：不是 /event/v1/ws/get_endpoint
      → 请求体: { AppID, AppSecret }
      → 返回: { URL (WSS地址,含device_id+service_id), ClientConfig (ping间隔等) }
  → connect()
      → new WebSocket(URL)            ← 使用 ws npm 包
      → on('open') → pingLoop()       ← 立即启动心跳
  → communicate()
      → on('message') → protobuf 解码 → 分发到 handleControlData / handleEventData
      → on('close') → reConnect()     ← 自动重连
```

### 1.3 协议细节（源码确认）

SDK 内部使用 **protobuf (pbbp2) 协议**，不是 JSON：

| 层级 | 编码方式 |
|------|---------|
| WebSocket 帧外层 | **Protobuf** (`pbbp2.Frame`) — `protoBuf.decode(buffer)` 解码，`pbbp2.Frame.encode(data).finish()` 编码 |
| Pong 控制帧 payload | **JSON** (TextDecoder 解码，含 `PingInterval`, `ReconnectCount` 等) |
| 事件数据 payload | **JSON + Base64** (事件体 JSON → Base64 编码) |
| 帧类型 (method) | `control (0)` = 连接管理帧, `data (1)` = 事件数据帧 |
| 消息类型 (type) | `event` / `card` / `ping` / `pong` |

SDK 内部还处理了：
- **数据分片合并**（DataCache.mergeData）：大事件会被分成多个帧传输，SDK 自动合并
- **心跳保活**（pingLoop）：按服务端返回的 PingInterval 定期发送 ping 帧
- **自动重连**（reConnect）：连接断开后按指数退避策略重连
- **握手超时看门狗**：可配置 handshakeTimeoutMs，超时后 terminate 连接

### 1.4 使用限制（官方文档）

- 长连接模式**仅支持企业自建应用**（不支持商店应用）
- 接收到消息后需要在 **3 秒内处理完成**，否则触发超时重推
- 每个应用最多建立 **50 个连接**
- 消息推送为**集群模式**（不支持广播）：多个 client 只有随机一个收到消息
- Node.js SDK 版本需要 **≥ 1.24.0**

---

## 2. basalt 方案为什么错（get_endpoint API 不存在）

### 2.1 错误的 API 端点

当前 `ws-client.ts`（第 430-457 行）调用：

```
POST https://open.feishu.cn/open-apis/event/v1/ws/get_endpoint
```

**这个 API 根本不存在**（手动 curl 返回 404）。

SDK 源码中实际使用的端点是：

```
POST https://open.feishu.cn/callback/ws/endpoint
```

注意差异：
| | basalt 方案 | SDK 实际 |
|---|---|---|
| 路径 | `/open-apis/event/v1/ws/get_endpoint` | `/callback/ws/endpoint` |
| 请求体 | `{}` (空) | `{ AppID, AppSecret }` |
| 认证 | Bearer app_access_token | 请求体内携带 AppID+AppSecret |
| 返回 | `{ data: { endpoint } }` | `{ URL, ClientConfig }` |

### 2.2 错误的帧协议

当前 `ws-client.ts` 假设 WebSocket 帧是 **JSON 字符串**，用 `JSON.parse(data.toString())` 解析。

实际上飞书 WS 帧是 **protobuf 二进制数据**，需要用 `protoBuf.decode(buffer)` 解码。JSON.parse 会直接抛出异常。

### 2.3 错误的帧类型定义

当前 `ws-client.ts` 定义的帧类型：

```typescript
const FrameType = {
  WELCOME: 0, PING: 1, PONG: 2, EVENT: 3,
  CLIENT_HELLO: 10, CLIENT_PONG: 11,
}
```

SDK 实际的帧类型：

```typescript
// ws-client/enum.ts
FrameType = { control: 0, data: 1 }     // 只有两种
MessageType = { event, card, ping, pong } // 在 headers.type 中区分
```

### 2.4 错误的认证方式

当前 `ws-client.ts` 用 `app_access_token` 作为 Bearer token 在 CLIENT_HELLO 帧中发送认证。

实际上 SDK 在 `pullConnectConfig` 阶段就把 `AppID + AppSecret` 放在 HTTP 请求体中完成认证，WebSocket 连接时 URL 自带 `device_id` 和 `service_id` 参数，不需要额外的握手帧。

### 2.5 结论

basalt 方案是一个**完全错误的实现**——API 端点、帧协议、帧类型、认证方式全部不正确。这不是一个"需要修复"的问题，而是需要**整体替换**。

---

## 3. Node SDK 的 WSClient 正确用法 + 之前收不到事件的可能原因

### 3.1 WSClient 正确用法（官方文档 + 源码确认）

```typescript
import * as Lark from '@larksuiteoapi/node-sdk';

const baseConfig = {
  appId: 'cli_aabbc8199ab89bea',
  appSecret: 'your-app-secret',
};

// 可选：创建 Client 实例用于发消息（REST API）
const client = new Lark.Client(baseConfig);

// 创建 WSClient
const wsClient = new Lark.WSClient({
  ...baseConfig,
  loggerLevel: Lark.LoggerLevel.debug,  // 调试时用 debug
});

// 启动长连接 + 注册事件处理器
wsClient.start({
  eventDispatcher: new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      // data 结构: { message: { chat_id, content, message_id }, sender: { sender_id: { open_id } } }
      const { message: { chat_id, content } } = data;
      console.log('收到消息:', JSON.parse(content).text);
      // 在这里处理消息...
    },
  }),
});
```

### 3.2 WSClient 配置参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| appId | string | 是 | - | 应用 ID |
| appSecret | string | 是 | - | 应用 Secret |
| domain | Domain \| string | 否 | `Domain.Feishu` | 平台域名 |
| loggerLevel | LoggerLevel | 否 | `info` | 日志级别 |
| autoReconnect | boolean | 否 | `true` | 是否自动重连 |

### 3.3 之前收不到事件的可能原因（按可能性排序）

根据飞书官方 FAQ（[常见问题](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/event-card-faq?lang=zh-CN)）和社区问题（[GitHub Issue #11719](https://github.com/openclaw/openclaw/issues/11719)）分析：

#### 原因 1：应用未发版（最常见）

> 官方 FAQ："切换至长连接模式后，应用是否完成发版？"

飞书应用配置变更后**必须发版**才能生效。如果只是保存了事件订阅配置但没有创建新版本并发布，配置不会生效。

**排查方法**：登录开发者后台 → 应用发布 → 检查是否有待发版的变更。

#### 原因 2：事件未正确订阅

> 官方 FAQ："若需要机器人能够接收到消息并处理，还需要添加「接收消息」的事件和配置相关权限"

必须在开发者后台的 **事件与回调 → 事件配置** 中添加 `im.message.receive_v1` 事件。

**排查方法**：开发者后台 → 事件与回调 → 事件配置 → 确认 `im.message.receive_v1` 已添加且状态为已启用。

#### 原因 3：权限未开通

需要开通以下权限：
- `im:message`（接收消息）
- `im:message:send_as_bot`（发送消息）
- `im:message.p2p_msg:readonly`（读取私聊消息）
- `im:message.group_at_msg:readonly`（读取群聊@消息）

**排查方法**：开发者后台 → 权限管理 → 检查上述权限是否已开通。

#### 原因 4：保存长连接配置时客户端未在线

> 官方文档："Make sure the local client is running normally and the long connection is online, in order to save successfully."

飞书要求在保存"使用长连接接收事件"订阅方式时，**本地客户端必须已经在线**。如果保存配置时客户端没有运行，配置可能保存失败或不生效。

**排查方法**：先启动 WSClient（确保日志显示连接成功），再去开发者后台保存订阅方式配置。

#### 原因 5：SDK 版本过低

> 官方文档："Node.js SDK 版本需要大于等于 1.24.0"

如果之前使用的 SDK 版本低于 1.24.0，WSClient 功能可能不完整或不存在。

#### 原因 6：机器人未启用或不可见

> 社区经验："bot is invisible to user ids 错误"

机器人功能需要启用，且用户需要能看到机器人才能发消息。

**排查方法**：开发者后台 → 应用功能 → 机器人 → 确认已启用。

#### 原因 7：Bun 兼容性问题（本项目特有）

`@larksuiteoapi/node-sdk` 内部使用 `ws` npm 包的 WebSocket 实现（`new WebSocket(url, { agent })`）。Bun 运行时的全局 `WebSocket` 与 `ws` 包的 API 签名不同：

- `ws` 包：`new WebSocket(url, options)` — options 含 agent, headers 等
- Bun 全局：`new WebSocket(url)` — 不支持 options 参数

**如果 SDK 内部 import 的 `ws` 包被 Bun 的全局 WebSocket 覆盖**，连接可能静默失败。这是一个需要在实现时验证的关键点。

**排查方法**：启动后观察日志是否出现 `connected to wss://` 字样。如果没有，可能是 WebSocket 创建失败。

### 3.4 排查清单

```
□ 1. SDK 版本 >= 1.24.0？
□ 2. 应用类型是企业自建应用？
□ 3. 事件 im.message.receive_v1 已订阅？
□ 4. 权限 im:message 已开通？
□ 5. 应用已发版（当前版本包含事件配置）？
□ 6. 机器人功能已启用？
□ 7. 保存长连接配置时客户端在线？
□ 8. WSClient 日志显示 "connected to wss://"？
□ 9. Bun 下 ws 包正常工作（非全局 WebSocket 覆盖）？
```

---

## 4. 三方案对比表

| 维度 | 方案A：Node SDK WSClient | 方案B：Webhook 模式 | 方案C：Python lark-oapi 桥接 |
|------|--------------------------|---------------------|------------------------------|
| **可行性** | ✅ 高 — 官方推荐方式，SDK 内部处理 protobuf/心跳/重连 | ✅ 高 — 网关已有 server.ts + router.ts + challenge 验证 | ✅ 高 — Python SDK 长连接成熟可靠 |
| **纯 TypeScript** | ✅ 是 — `@larksuiteoapi/node-sdk` 是纯 TS 包 | ✅ 是 — 现有代码已实现 | ❌ 否 — 需要 Python 进程 + IPC |
| **需要公网 IP/域名** | ❌ 不需要 — 客户端主动连接飞书 | ✅ 需要 — 飞书主动推送 HTTP 请求 | ❌ 不需要 |
| **内网穿透** | ❌ 不需要 | ✅ 开发环境需要 ngrok/cloudflare tunnel | ❌ 不需要 |
| **协议复杂度** | 低 — SDK 封装了 protobuf/认证/心跳/重连/分片合并 | 中 — 需要处理 challenge 验证、事件解密（如果开启加密） | 低 — Python SDK 封装 |
| **工作量** | 中 — 替换 ws-client.ts + 改 adapter.ts + 加依赖 | 低 — 现有 server.ts/router.ts 已有基础，改 adapter.ts 即可 | 高 — 需要引入 Python 运行时 + 进程管理 + IPC 通信 |
| **风险** | 中 — Bun 兼容性需验证（ws 包 vs 全局 WebSocket） | 低 — HTTP 回调是标准模式，无兼容性问题 | 高 — 违反"不引入 Python"约束，增加运维复杂度 |
| **之前失败原因** | 需排查配置问题（事件订阅/权限/发版/Bun兼容） | 不适用（之前用的是 WS 模式） | 不适用 |
| **维护成本** | 低 — SDK 维护协议更新 | 低 — HTTP 回调稳定 | 高 — 需维护 Python 进程 + IPC |
| **部署复杂度** | 低 — 单进程 | 中 — 需要公网暴露 + HTTPS + ICP 备案（国内） | 高 — 双语言运行时 |
| **事件处理时效** | 实时 — WebSocket 推送 | 实时 — HTTP 推送 | 实时 — WebSocket 推送 + IPC 转发 |
| **集群模式** | 支持（多实例随机收到） | 支持（飞书轮询推送） | 支持 |

---

## 5. 推荐方案 + 理由

### 推荐方案：A — 恢复 @larksuiteoapi/node-sdk 的 WSClient

### 理由

1. **官方推荐方式**：飞书官方文档明确推荐"使用长连接接收事件"为首选方式，Webhook 为备选。

2. **纯 TypeScript**：`@larksuiteoapi/node-sdk` 是纯 TS 包，与 DeepCode 的技术栈一致，不违反"不引入 Python"约束。

3. **无需公网暴露**：长连接是客户端主动连接飞书服务器，不需要公网 IP/域名/ICP 备案。Webhook 模式在国内部署需要备案的公网域名，成本高。

4. **协议封装完整**：SDK 内部处理了 protobuf 编解码、认证、心跳、重连、数据分片合并等所有复杂逻辑。自己实现这些（如 basalt 方案尝试的）极易出错且难以维护。

5. **之前失败可排查**：WSClient 之前收不到事件，最可能的原因是配置问题（事件未订阅/权限未开通/应用未发版/保存配置时客户端未在线），而非 SDK 本身的问题。这些问题通过排查清单可以逐一解决。

6. **工作量可控**：只需替换 `ws-client.ts` + 修改 `adapter.ts` + 添加依赖，不影响其他模块（router.ts/server.ts/session-bridge.ts 保持不变）。

### 关键风险及缓解

| 风险 | 缓解措施 |
|------|---------|
| Bun 与 `ws` 包兼容性 | 启动后检查日志是否出现 `connected to wss://`；如果失败，考虑安装 `ws` 包显式声明依赖 |
| 配置问题导致收不到事件 | 实现时加 `loggerLevel: Lark.LoggerLevel.debug`，按照排查清单逐一检查飞书后台配置 |
| SDK 与 Effect.js 的集成 | WSClient 是回调式 API，通过 `Effect.tryPromise` + `Effect.runFork` 桥接到 Effect 生态 |

### 备选方案

如果方案 A 验证后发现 Bun 兼容性问题无法解决（`ws` 包在 Bun 下不工作），则**降级到方案 B（Webhook 模式）**：

- 网关已有 `server.ts`（Bun.serve）+ `router.ts`（/webhook/feishu 路由）+ `crypto.ts`（challenge 验证）
- 只需修改 `adapter.ts`：移除 WSClient 启动逻辑，改为从 router 分发的事件中获取消息
- 开发环境用 cloudflare tunnel 或 ngrok 暴露本地端口
- 生产环境需要公网域名 + HTTPS + ICP 备案

---

## 6. 具体实现细节

### 6.1 依赖变更

#### `packages/deepcode-gateway/package.json`

```diff
  "dependencies": {
    "effect": "catalog:",
-   "@opencode-ai/plugin": "workspace:*"
+   "@opencode-ai/plugin": "workspace:*",
+   "@larksuiteoapi/node-sdk": "^1.40.0"
  },
```

> 版本选择：最新稳定版（当前约 1.40.0+），满足 >= 1.24.0 的要求。  
> 也可以加入根 `package.json` 的 catalog 统一管理版本。

#### 根 `package.json` catalog（可选，推荐）

```diff
  "catalog": {
+   "@larksuiteoapi/node-sdk": "1.40.0",
    ...
  }
```

然后 gateway 的 package.json 用 `"@larksuiteoapi/node-sdk": "catalog:"`。

### 6.2 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/deepcode-gateway/src/feishu/ws-client.ts` | **重写** | 用 SDK 的 WSClient 封装，替换错误的 basalt 实现 |
| `packages/deepcode-gateway/src/feishu/adapter.ts` | **修改** | 适配新的 ws-client 接口，保持 Effect 接口不变 |
| `packages/deepcode-gateway/src/feishu/api.ts` | **不改** | REST API（发消息）逻辑正确，保持不变 |
| `packages/deepcode-gateway/src/feishu/crypto.ts` | **不改** | challenge 验证逻辑保留（Webhook 备选方案用） |
| `packages/deepcode-gateway/package.json` | **修改** | 添加 `@larksuiteoapi/node-sdk` 依赖 |
| `packages/deepcode-gateway/src/router.ts` | **不改** | 路由逻辑不变 |
| `packages/deepcode-gateway/src/server.ts` | **不改** | HTTP 服务器保留（健康检查 + Webhook 备选） |
| `packages/deepcode-gateway/src/lifecycle.ts` | **不改** | 生命周期管理不变 |
| `packages/deepcode-gateway/src/session-bridge.ts` | **不改** | 会话桥接不变 |
| `packages/deepcode-gateway/src/config.ts` | **不改** | 配置结构不变 |
| `packages/deepcode-gateway/src/plugin.ts` | **不改** | 插件入口不变 |

### 6.3 新 ws-client.ts 代码结构

```typescript
/**
 * DeepCode 消息网关 — 飞书长链接（WebSocket）客户端
 *
 * 使用 @larksuiteoapi/node-sdk 的 WSClient 建立长连接。
 * SDK 内部处理 protobuf 编解码、认证、心跳、重连、数据分片合并。
 *
 * @module feishu/ws-client
 */

import * as Lark from '@larksuiteoapi/node-sdk'
import type { FeishuConfig } from '../config'

/** 事件回调类型 — 收到 im.message.receive_v1 事件时调用 */
export type OnEventCallback = (data: unknown) => void

/**
 * 飞书长链接客户端（基于官方 Node SDK）
 *
 * 封装 @larksuiteoapi/node-sdk 的 WSClient，
 * 提供 start/stop/setEventHandler 接口供 FeishuAdapter 调用。
 */
export class FeishuWSClient {
  private readonly config: FeishuConfig
  private wsClient: Lark.WSClient | null = null
  private onEvent: OnEventCallback | null = null
  private readonly logPrefix = '[FeishuWS]'

  constructor(config: FeishuConfig) {
    this.config = config
  }

  /** 设置事件回调 */
  setEventHandler(callback: OnEventCallback): void {
    this.onEvent = callback
  }

  /**
   * 启动长连接
   *
   * 使用 SDK 的 WSClient.start() + EventDispatcher.register() 注册事件处理器。
   * SDK 内部处理认证、心跳、重连。
   */
  async start(): Promise<void> {
    this.log('正在启动飞书长链接客户端（Node SDK WSClient）...')

    const baseConfig = {
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    }

    this.wsClient = new Lark.WSClient({
      ...baseConfig,
      loggerLevel: Lark.LoggerLevel.debug,
    })

    // 启动长连接 + 注册事件处理器
    this.wsClient.start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data) => {
          this.log(`收到消息事件: message_id=${(data as any)?.message?.message_id}`)
          if (this.onEvent) {
            this.onEvent(data)
          }
        },
      }),
    })

    this.log('飞书长链接客户端已启动（等待连接建立）')
  }

  /** 停止长连接 */
  stop(): void {
    // SDK 的 WSClient 没有显式 stop 方法，
    // 关闭方式是断开底层 WebSocket 连接
    // 由于 SDK 内部管理连接，这里记录日志即可
    // 进程退出时连接会自动断开
    this.wsClient = null
    this.log('飞书长链接客户端已停止')
  }

  private log(msg: string): void {
    console.log(`${this.logPrefix} ${msg}`)
  }
}
```

### 6.4 adapter.ts 改动

`adapter.ts` 的改动很小——只需要调整事件回调中数据结构的解析方式。

**关键变化**：SDK 的 `EventDispatcher.register('im.message.receive_v1', handler)` 中的 `data` 参数结构是**直接的事件 body**（即 `{ header, event }` 或 `{ message, sender }`），与之前 ws-client.ts 传给回调的 `frame.event` 结构不同。

需要确认 SDK 传给 handler 的 `data` 的确切结构。根据官方文档示例：

```typescript
'im.message.receive_v1': async (data) => {
  const { message: { chat_id, content } } = data;
}
```

这说明 `data` 是事件的 `event` 字段内容（即 `{ sender, message }`），**不包含 `header`**。

因此 `adapter.ts` 中的 `handleEvent` 和 `parseFeishuEvent` 需要调整：

```typescript
// 修改前（ws-client.ts 传 frame.event，包含 { header, event }）
wsClient.setEventHandler((eventBody) => {
  self.handleEvent(eventBody as Record<string, unknown>, mq)
})

// 修改后（SDK 直接传 event 字段内容，即 { sender, message }）
wsClient.setEventHandler((data) => {
  // data 已经是 { sender: {...}, message: {...} } 结构
  // 需要包装成 { event: data } 格式以复用现有 parseFeishuEvent
  self.handleEvent({ event: data } as Record<string, unknown>, mq)
})
```

或者在 `handleEvent` / `parseFeishuEvent` 中直接处理新结构。具体实现时需要根据 SDK 实际传入的 `data` 结构来调整。

### 6.5 Bun 兼容性验证要点

1. **安装后检查**：`bun install` 后检查 `node_modules/@larksuiteoapi/node-sdk` 是否正常安装
2. **启动后检查日志**：
   - 应出现 `[ws] ws connect success` 或 `connected to wss://`
   - 应出现 `event-dispatch is ready`
   - 如果出现 `ws connect failed` 或无任何 WS 日志，可能是 Bun 的 WebSocket 与 `ws` 包不兼容
3. **如果 Bun 不兼容**：
   - 方案 1：在 gateway 入口显式 `import WebSocket from 'ws'` 并赋值到 globalThis
   - 方案 2：降级到方案 B（Webhook 模式）
4. **测试验证**：启动网关后在飞书 App 中发消息，观察日志是否出现 `收到消息事件`

### 6.6 飞书后台配置检查

实现前需要确认以下飞书后台配置（小路确认或主理人确认）：

```
□ 应用类型：企业自建应用（cli_aabbc8199ab89bea）
□ 事件订阅方式：使用长连接接收事件
□ 已订阅事件：im.message.receive_v1
□ 权限已开通：im:message, im:message:send_as_bot
□ 应用已发版（当前线上版本包含事件配置）
□ 机器人功能已启用
□ 保存长连接配置时客户端在线（先启动网关再保存配置）
```

---

## 7. 待明确事项

### 7.1 需要主理人/小路确认

1. **飞书后台事件订阅状态**：`im.message.receive_v1` 事件是否已正确订阅并启用？权限 `im:message` 是否已开通？
2. **应用发版状态**：当前线上版本是否包含长连接事件配置？是否有待发版的变更？
3. **之前 WSClient 的具体代码**：小路说"@larksuiteoapi/node-sdk的WSClient收不到事件"——之前用的 SDK 版本是多少？EventDispatcher 注册了哪些事件？有没有 debug 日志？
4. **Bun 版本**：当前 Bun 版本（1.3.14）下 `ws` npm 包是否能正常工作？需要实测验证。

### 7.2 实现时需验证

1. **SDK handler data 结构**：`EventDispatcher.register('im.message.receive_v1', handler)` 中 `data` 的确切结构（是否包含 `header`），需要实际运行确认。
2. **WSClient stop 方法**：SDK 的 WSClient 似乎没有显式的 `stop()` / `close()` 方法。进程退出时连接自动断开，但优雅关闭可能需要额外处理。
3. **ws 包 vs Bun 全局 WebSocket**：SDK 内部 `new WebSocket(url, { agent })` 使用的是 `ws` 包还是 Bun 全局？如果是后者，`{ agent }` 参数会被忽略，可能导致代理场景下连接失败（但无代理场景应该没问题）。

### 7.3 假设

1. 飞书后台已配置长连接模式（小路已确认）
2. 飞书 App 是企业自建应用（cli_aabbc8199ab89bea）
3. 网关代码在 `packages/deepcode-gateway/src/`
4. "不引入 Python 依赖"是强制约束（但如果方案 A 和 B 都不可行，可提议放宽）
5. 网关使用 Bun 运行时（`Bun.serve()` + `Bun.spawn()`）
6. 发消息的 REST API 逻辑（api.ts）是正确的，不需要改动

---

## 附录：关键文档链接

| 文档 | URL |
|------|-----|
| 飞书 Node.js SDK 处理事件 | https://open.larkoffice.com/document/server-side-sdk/nodejs-sdk/handling-events |
| 飞书长连接接收事件（中文） | https://open.feishu.cn/document/event-subscription-guide/callback-subscription/step-1-choose-a-subscription-mode/configure-callback-request-address |
| 飞书长连接 FAQ | https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/event-card-faq?lang=zh-CN |
| Node SDK GitHub | https://github.com/larksuite/node-sdk |
| WSClient 源码 | https://github.com/larksuite/node-sdk/blob/main/ws-client/index.ts |
| WSClient 架构（DeepWiki） | https://deepwiki.com/larksuite/node-sdk/3.4-websocket-client-(long-connection-mode) |
| 类似问题（GitHub Issue） | https://github.com/openclaw/openclaw/issues/11719 |
