/** 底层 WebSocket 诊断 — Bun 原生 WebSocket API */
const appId = process.env.OPENCODE_FEISHU_APP_ID!
const appSecret = process.env.OPENCODE_FEISHU_APP_SECRET!

// 获取 WebSocket URL
const resp: any = await fetch("https://open.feishu.cn/callback/ws/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ AppID: appId, AppSecret: appSecret }),
}).then(r => r.json())

const wsUrl: string = resp.data?.URL
if (!wsUrl) {
  console.error("获取 WS URL 失败:", JSON.stringify(resp))
  process.exit(1)
}
console.log("[raw] WS URL:", wsUrl)

// Bun 原生 WebSocket
const ws = new WebSocket(wsUrl)

ws.onopen = () => {
  console.log("[raw] ✅ WebSocket 已连接")
}

ws.onmessage = (event: MessageEvent) => {
  const data = event.data
  const rawLen = data instanceof Blob ? data.size : data instanceof ArrayBuffer ? data.byteLength : typeof data === "string" ? data.length : "?"
  console.log(`[raw] 📩 收到消息! 类型=${typeof data} 大小=${rawLen}`)
  try {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer)
    console.log("[raw] 内容:", text.slice(0, 400))
  } catch (e) {
    console.log("[raw] 无法解码:", e)
  }
}

ws.onerror = (e: Event) => {
  console.log("[raw] ❌ WebSocket 错误:", (e as any).message || e.type)
}

ws.onclose = (e: CloseEvent) => {
  console.log(`[raw] 🔒 WebSocket 关闭: code=${e.code} reason=${e.reason || "无"} clean=${e.wasClean}`)
}

// 每15秒报告状态
setInterval(() => {
  console.log(`[raw] 心跳: readyState=${ws.readyState} (0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED)`)
}, 15000)

console.log("[raw] 诊断已启动，你在飞书上发消息给我...")
console.log("[raw] 90秒后自动退出")

setTimeout(() => {
  console.log("[raw] 诊断结束")
  ws.close()
  process.exit(0)
}, 90000)
