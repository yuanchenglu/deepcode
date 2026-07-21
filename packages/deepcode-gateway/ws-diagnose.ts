/** 飞书 WebSocket 长连接诊断 — DEBUG 模式 */
import * as Lark from "@larksuiteoapi/node-sdk"

const appId = process.env.OPENCODE_FEISHU_APP_ID!
const appSecret = process.env.OPENCODE_FEISHU_APP_SECRET!

const dispatcher = new Lark.EventDispatcher({
  loggerLevel: Lark.LoggerLevel.debug,
}).register({
  "im.message.receive_v1": async (data: unknown) => {
    console.log("\n*** [收到消息事件] ***")
    console.log(JSON.stringify(data, null, 2).slice(0, 500))
    console.log("*********************\n")
  },
})

const wsClient = new Lark.WSClient({
  appId,
  appSecret,
  loggerLevel: Lark.LoggerLevel.debug,
  onReady: () => console.log("[onReady] 连接就绪"),
  onReconnecting: () => console.log("[onReconnecting] 重连中"),
  onReconnected: () => console.log("[onReconnected] 重连成功"),
  onError: (err) => console.log("[onError]", err.message),
})

console.log("[诊断] 正在启动 WSClient (DEBUG 模式)...\n")
wsClient.start({ eventDispatcher: dispatcher }).catch((err) => {
  console.log("[诊断] start() 失败:", err.message)
})

let count = 0
setInterval(() => {
  count++
  const status = wsClient.getConnectionStatus()
  console.log(`[${count * 10}s] state=${status.state}, lastConnect=${status.lastConnectTime ? new Date(status.lastConnectTime).toISOString() : 'never'}`)
}, 10000)

setTimeout(() => {
  console.log("\n[诊断] 60秒诊断结束")
  process.exit(0)
}, 60000)
