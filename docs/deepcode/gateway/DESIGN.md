# DeepCode 消息网关设计文档

> 参考架构：Hermes Gateway (Python) — 抽象基类 `BasePlatformAdapter` + 飞书/微信适配器

## 架构概览

```
                  ┌─────────────────────┐
                  │   OpenCode Plugin   │
                  │   (plugin.ts)       │
                  └──────┬──────────────┘
                         │ activate/deactivate
          ┌──────────────┴──────────────┐
          │       Gateway Runtime       │
          │   (server.ts, lifecycle.ts) │
          │   HTTP Server (port 3099)   │
          └──────┬──────────────┬───────┘
                 │              │
     ┌───────────▼──────┐  ┌───▼───────────┐
     │  Feishu Adapter  │  │  WeChat Adapter│
     │  (feishu/)       │  │  (wechat/)     │
     │  - adapter.ts    │  │  - adapter.ts  │
     │  - api.ts        │  │  - api.ts      │
     │  - crypto.ts     │  │  - crypto.ts   │
     └───────────┬──────┘  └───┬───────────┘
                 │              │
                 └──────┬──────┘
                        ▼
              ┌──────────────────┐
              │  Session Bridge  │
              │ (session-bridge) │
              │  platform msg →  │
              │  OpenCode prompt │
              └──────────────────┘
```

## 消息模型

### GatewayMessage（入站消息）

```typescript
interface GatewayMessage {
  id: string                // 消息唯一 ID
  platform: "feishu" | "wechat" | "terminal"
  type: "text" | "image" | "file" | "event"
  content: string           // 消息文本内容
  sender: {
    id: string              // 平台用户 ID
    name: string            // 用户显示名
  }
  chat: {
    id: string              // 会话/群聊 ID
    type: "private" | "group"
  }
  timestamp: number         // Unix 毫秒时间戳
  raw?: unknown             // 原始平台事件（调试用）
}
```

### OutboundMessage（出站消息）

```typescript
interface OutboundMessage {
  chatId: string            // 目标会话 ID
  type: "text" | "image" | "card"
  content: string           // 文本内容
  imageUrl?: string         // 图片 URL（type=image 时）
}
```

## 适配器接口

```typescript
interface PlatformAdapter {
  readonly name: string
  start(): Effect.Effect<never, GatewayError, void>
  stop(): Effect.Effect<never, never, void>
  send(msg: OutboundMessage): Effect.Effect<never, GatewayError, SendResult>
  readonly messages: Stream<never, GatewayError, GatewayMessage>
}
```

## 配置格式

在 opencode.jsonc 中配置：

```jsonc
{
  "gateway": {
    "feishu": {
      "enabled": false,
      "appId": "",
      "appSecret": "",
      "port": 3099
    },
    "wechat": {
      "enabled": false,
      "mode": "wecom",
      "corpId": "",
      "agentId": "",
      "secret": ""
    }
  }
}
```

## 飞书适配器

参考 Hermes `feishu.py` 的核心流程：

### 接收消息（Webhook）
1. 飞书 POST `/webhook/feishu` 发送事件
2. 验证 Challenge（首次配置时的 URL 验证）
3. 解析事件类型（`im.message.receive_v1` 等）
4. 提取消息内容 → 转换为 GatewayMessage
5. 推入消息流（messages Stream）

### 发送消息
1. 获取 tenant_access_token（自动刷新缓存）
2. POST `/open-apis/im/v1/messages` 发送文本/图片消息
3. 支持 @ 用户和富文本

## 微信适配器（企业微信）

参考 Hermes `weixin.py`：

### 接收消息（Webhook）
1. 企业微信 POST `/webhook/wechat` 发送回调事件
2. 解密消息体（AES 解密）
3. 解析消息类型 → GatewayMessage

### 发送消息
1. 获取 access_token
2. POST `/cgi-bin/message/send` 发送消息

## Session 桥接

```
平台消息 → GatewayMessage → 查找/创建 OpenCode Session → 
发送 prompt → 获取回复 → 转成平台消息发回
```

- 每个平台会话映射到一个 OpenCode Session
- 映射关系存储在内存 Map 中（后续可持久化）
- 异步处理：消息入队 → Effect Queue → 按序处理
