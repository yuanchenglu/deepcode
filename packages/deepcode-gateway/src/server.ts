/**
 * DeepCode 消息网关 — HTTP Server
 *
 * 使用 Bun.serve() 实现真实 HTTP 服务，接收飞书/微信 Webhook 事件。
 * 支持飞书 URL 验证 Challenge、健康检查和事件路由。
 *
 * @module
 */

import { Effect } from "effect"
import type { PlatformAdapter } from "./adapter"
import type { Router } from "./router"

/** 保存 HTTP Server 实例引用，用于关闭 */
let serverInstance: ReturnType<typeof Bun.serve> | null = null

/**
 * 从路径中提取平台名称
 * 如 /webhook/feishu → feishu，/webhook/wecom → wecom
 */
function extractPlatformName(path: string): string | null {
  if (!path.startsWith("/webhook/")) return null
  return path.slice("/webhook/".length)
}

/**
 * 尝试将请求委托给平台适配器的 handleWebhook
 * 返回 true 表示已处理（调用方应返回），false 表示未命中
 */
async function tryHandleWebhook(
  req: Request,
  path: string,
  adapters: Map<string, PlatformAdapter> | undefined,
): Promise<Response | null> {
  if (!adapters) return null
  const platformName = extractPlatformName(path)
  if (!platformName) return null
  const adapter = adapters.get(platformName)
  if (!adapter?.handleWebhook) return null
  const result = adapter.handleWebhook(req)
  if (result instanceof Promise) return await result
  return await Effect.runPromise(result)
}

export function startServer(
  port: number,
  router: Router,
  adapters?: Map<string, PlatformAdapter>,
): Effect.Effect<void> {
  return Effect.sync(() => {
    serverInstance = Bun.serve({
      port,
      development: false,
      fetch(req: Request): Response | Promise<Response> {
        const url = new URL(req.url)
        const path = url.pathname
        const method = req.method

        if (method === "GET") {
          // 健康检查
          if (path === "/" || path === "/health") {
            return Response.json({ status: "ok", gateway: "running", port }, { status: 200 })
          }
          // 平台 Webhook URL 验证（Telegram/WhatsApp 等需要 GET 验证）
          if (adapters && extractPlatformName(path)) {
            const result = tryHandleWebhook(req, path, adapters)
            // GET handler is sync, but Bun.serve accepts Promise<Response>
            return result as Promise<Response>
          }
          return Response.json({ error: "not found" }, { status: 404 })
        }

        if (method !== "POST") {
          return Response.json({ error: "method not allowed" }, { status: 405 })
        }

        // POST：异步处理 webhook 事件
        return (async (): Promise<Response> => {
          try {
            // XML/表单格式平台（wecom/dingtalk 等）由适配器直接处理原始请求
            const handleWebhookResult = await tryHandleWebhook(req, path, adapters)
            if (handleWebhookResult) return handleWebhookResult

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
