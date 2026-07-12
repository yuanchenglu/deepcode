/**
 * DeepCode Gateway — 独立启动入口
 *
 * 不依赖 OpenCode Plugin 系统，直接启动 Gateway HTTP Server
 * 和飞书 Adapter，用于测试和独立部署。
 *
 * 用法：
 *   OPENCODE_FEISHU_APP_ID=xxx OPENCODE_FEISHU_APP_SECRET=yyy bun run startup.ts
 *
 * @module
 */

import { Effect } from "effect"
import { FeishuAdapter, registerAdapter, startGateway } from "./src/index"

// ---------- 配置 ----------
const appId = process.env.OPENCODE_FEISHU_APP_ID
const appSecret = process.env.OPENCODE_FEISHU_APP_SECRET

if (!appId || !appSecret) {
  console.error("需要设置 OPENCODE_FEISHU_APP_ID 和 OPENCODE_FEISHU_APP_SECRET 环境变量")
  process.exit(1)
}

const PORT = 3099

// ---------- 注册适配器 ----------
registerAdapter(new FeishuAdapter({
  enabled: true,
  appId,
  appSecret,
  webhook: "/webhook/feishu",
  port: PORT,
}))

console.log(`[startup] 注册 FeishuAdapter, 启动 Gateway (port=${PORT})...`)

// ---------- 启动网关 ----------
// 用 Effect.never 保持 Scope 不关闭，让 forkScoped 的后台 Fiber 持续运行
const program = Effect.gen(function* () {
  yield* Effect.ignore(startGateway(PORT))
  yield* Effect.never
})

Effect.runFork(program.pipe(Effect.scoped))
