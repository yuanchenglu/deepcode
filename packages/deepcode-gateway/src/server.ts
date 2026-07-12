/**
 * DeepCode 消息网关 — HTTP Server
 *
 * 使用 Bun.serve() 实现真实 HTTP 服务，接收飞书/微信 Webhook 事件。
 * 支持飞书 URL 验证 Challenge、健康检查和事件路由。
 *
 * @module
 */

import { Effect } from "effect"
import type { Router } from "./router"

/** 保存 HTTP Server 实例引用，用于关闭 */
let serverInstance: ReturnType<typeof Bun.serve> | null = null

/**
 * 启动 HTTP Server
 *
 * 在指定端口启动非阻塞的 Bun.serve()，处理：
 * - GET / 或 GET /health → 健康检查
 * - POST /webhook/feishu → 飞书事件（含 challenge url_verification）
 * - POST /webhook/wechat  → 微信/企业微信事件
 * - 其他路径 → 405 或 404
 */
export function startServer(port: number, router: Router): Effect.Effect<void> {
  return Effect.sync(() => {
    serverInstance = Bun.serve({
      port,
      development: false,
      fetch(req: Request): Response | Promise<Response> {
        const url = new URL(req.url)
        const path = url.pathname
        const method = req.method

        // 健康检查
        if (method === "GET") {
          if (path === "/" || path === "/health") {
            return Response.json({ status: "ok", gateway: "running", port }, { status: 200 })
          }
          return Response.json({ error: "not found" }, { status: 404 })
        }

        if (method !== "POST") {
          return Response.json({ error: "method not allowed" }, { status: 405 })
        }

        // POST：异步处理 webhook 事件
        return (async (): Promise<Response> => {
          try {
            const bodyText = await req.text()
            let body: unknown
            try {
              body = JSON.parse(bodyText)
            } catch {
              return Response.json({ error: "invalid json body" }, { status: 400 })
            }

            // 飞书 URL 验证 Challenge
            if (path.startsWith("/webhook/feishu")) {
              if (typeof body === "object" && body !== null) {
                const evt = body as Record<string, unknown>
                if (evt.type === "url_verification") {
                  return Response.json({ challenge: evt.challenge }, { status: 200 })
                }
              }
            }

            // 路由到对应平台处理器
            const result = await Effect.runPromise(
              router.dispatch(path, body),
            )
            return Response.json(result, { status: 200 })
          } catch (err) {
            return Response.json(
              { error: err instanceof Error ? err.message : String(err) },
              { status: 500 },
            )
          }
        })()
      },
    })
  })
}

/**
 * 关闭 HTTP Server
 */
export function stopServer(): Effect.Effect<void> {
  return Effect.sync(() => {
    if (serverInstance) {
      serverInstance.stop()
      serverInstance = null
    }
  })
}
