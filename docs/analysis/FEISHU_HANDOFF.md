# 飞书消息网关问题交接提示词

> 用于新开会话处理飞书消息无回应问题。本文件包含完整诊断上下文。

## 问题
DeepCode网关的飞书WS长连接已建立，WSClient能收到飞书消息事件，但**消息从ws-client到session-bridge的传递断了**——session-bridge没处理消息，飞书收不到回复。

## 已完成（本会话）

### 1. 诊断根因
- basalt的ws-client.ts用 `POST /open-apis/event/v1/ws/get_endpoint` REST API获取WSS地址 → **404，API不存在**
- 飞书官方文档确认：长连接是SDK内提供的能力，必须用官方SDK（@larksuiteoapi/node-sdk），SDK内部处理protobuf pbbp2协议
- basalt方案三个层面全错（API端点/帧协议/认证方式）

### 2. 修复（commit ff2937a）
- 恢复@larksuiteoapi/node-sdk依赖（v1.70.0）
- 重写 ws-client.ts 用官方WSClient封装
- 修改 adapter.ts 适配新ws-client接口
- Bun兼容性OK（SDK内部ws包在Bun 1.3.14下正常）

### 3. WSClient实测连接成功
```
[debug]: [ "[ws]", "get connect config success, ws url: wss://msg-frontier.feishu.cn/ws/v2?..." ]
[debug]: [ "[ws]", "ws connect success" ]
[info]: [ "[ws]", "ws client ready" ]
```

### 4. WSClient收到消息事件
小路发消息后，日志显示：
```
[debug]: [ "[ws]", "receive message, message_type: event; message_id: 1b5dac99-..." ]
[FeishuWS] 收到消息事件: message_id=om_x100b6ad08b8b48a0b4c9ac0be68f494
```
**WSClient确实收到了飞书消息事件。**

## 未解决（断点定位）

**session-bridge没处理消息**——日志只有"[SessionBridge] 启动消息消费循环"，没有"[SessionBridge] 处理消息: chat=..."。

消息从ws-client到session-bridge的传递链：
```
ws-client收到事件 → this.onEvent(data) → adapter.handleEvent(data, mq) → parseFeishuMessage(data) → Queue.offer(queue, msg) → session-bridge消费Queue → processMessage
```

可能断点（按可能性排序）：
1. **Effect.runFork在非Effect上下文的Runtime问题**：adapter.handleEvent是async函数（非Effect生成器），用`Effect.runFork(Queue.offer(queue, msg))`在非Effect上下文驱动Effect。Queue是Effect运行时对象，可能需要特定Runtime上下文，Effect.runFork可能没正确驱动。
2. **parseFeishuMessage返回undefined**：SDK传入的data结构可能不是预期的`{sender, message}`，导致解析失败静默return
3. **onEvent回调没被调用**：ws-client的setEventHandler可能没正确设置
4. **Queue不是同一个实例**：adapter的mq和lifecycle的mq可能不是同一个

## 诊断方法

在 adapter.ts 的 handleEvent 加诊断日志：
```typescript
private async handleEvent(data: Record<string, unknown>, queue: Queue.Queue<GatewayMessage>): Promise<void> {
  console.log("[FeishuAdapter] handleEvent被调用, data keys:", Object.keys(data || {}))
  try {
    const msg = parseFeishuMessage(data)
    console.log("[FeishuAdapter] parseFeishuMessage结果:", msg ? `id=${msg.id} content="${msg.content}"` : "undefined(解析失败)")
    if (!msg) return
    Effect.runFork(Queue.offer(queue, msg))
    console.log("[FeishuAdapter] Queue.offer已执行")
  } catch (err) {
    console.error("[FeishuAdapter] 事件处理失败:", err)
  }
}
```

启动网关，发消息，看日志哪一步断了：
- 如果没有"handleEvent被调用" → onEvent回调没被调用（ws-client的setEventHandler问题）
- 如果有"handleEvent被调用"但没有"parseFeishuMessage结果" → parseFeishuMessage抛异常
- 如果"parseFeishuMessage结果"是undefined → data结构不是预期的{sender, message}
- 如果有"Queue.offer已执行"但没有"[SessionBridge] 处理消息" → Effect.runFork没真正推入Queue（Runtime问题）

## 重点怀疑：Effect.runFork的Runtime问题

`Effect.runFork(Queue.offer(queue, msg))` 在async回调（非Effect生成器）里调用。Effect的Queue是Effect运行时对象，绑定到特定Runtime。Effect.runFork创建默认Runtime，但queue可能绑定到lifecycle.startGateway的Runtime。两个Runtime不是同一个，Queue.offer可能没作用到正确的Queue。

**可能的修复方案**：
1. 用 `Effect.runPromise(Queue.offer(queue, msg))` 替代runFork（Promise驱动）
2. 或在adapter启动时保存Runtime引用，用 `runtime.runFork(Queue.offer(queue, msg))`
3. 或改用非Effect的队列（如Node.js EventEmitter或简单的数组+锁）

## 相关文件
- `packages/deepcode-gateway/src/feishu/ws-client.ts` — WSClient封装（收到事件→onEvent回调）
- `packages/deepcode-gateway/src/feishu/adapter.ts` — 适配器（handleEvent→parseFeishuMessage→Queue.offer）
- `packages/deepcode-gateway/src/lifecycle.ts` — startGateway（创建Queue+启动adapter+启动消费循环）
- `packages/deepcode-gateway/src/session-bridge.ts` — 消费循环（startMessageConsumer→processMessage→executeCli）
- `packages/deepcode-gateway/src/message.ts` — GatewayMessage类型定义

## 飞书App配置
- appId: `<your-feishu-app-id>`
- appSecret: `<your-feishu-app-secret>`
- 后台已配置长连接模式 + im.message.receive_v1事件订阅
- 网关端口: 3099

## 启动网关测试命令
```bash
cd /Volumes/Doc/Code/deepcode/packages/deepcode-gateway
cat > _tmp_test.ts << 'EOF'
import { Effect } from "effect"
import { startGateway, registerAdapter } from "./src/lifecycle"
import { FeishuAdapter } from "./src/feishu/adapter"
registerAdapter(new FeishuAdapter({
  enabled: true,
  appId: "<your-feishu-app-id>",
  appSecret: "<your-feishu-app-secret>",
  webhook: "/webhook/feishu",
  port: 3099,
} as any))
Effect.runPromise(Effect.scoped(startGateway(3099))).catch(console.error)
console.log("[TestWS] 网关启动中...")
EOF
bun run _tmp_test.ts
```
发消息后看日志。用完 `rm _tmp_test.ts` 清理。

## 架构师方案文档
`/Volumes/Doc/Code/deepcode/docs/analysis/FEISHU_WS_DECISION.md` — 架构师高见远的飞书WS方案分析（含basalt错误分析、Node SDK正确用法、三方案对比）

## 当前commit状态
- `ff2937a` — 飞书WS修复（恢复Node SDK WSClient，替代basalt）
- 之前的诊断日志已撤销（git checkout adapter.ts），需要重新加
