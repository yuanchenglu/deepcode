import { Effect, Queue } from "effect"
import type { GatewayMessage } from "./message"
import { GatewayError } from "./error"

export interface RouteRegistration {
  readonly path: string
  readonly platform: "feishu" | "wechat"
}

export class Router {
  private routes = new Map<string, Queue.Queue<GatewayMessage>>()

  register(registration: RouteRegistration, queue: Queue.Queue<GatewayMessage>): void {
    this.routes.set(registration.path, queue)
  }

  dispatch(path: string, body: unknown): Effect.Effect<unknown, GatewayError> {
    // 先尝试精确匹配，再尝试前缀匹配（如 /webhook/feishu/bridge → /webhook/feishu）
    let queue = this.routes.get(path)
    if (!queue) {
      for (const [registered, q] of this.routes) {
        if (path.startsWith(registered + "/") || path === registered) {
          queue = q
          break
        }
      }
    }
    if (!queue) {
      return Effect.fail(new GatewayError("ADAPTER_NOT_FOUND", `No adapter for path: ${path}`))
    }

    // 诊断日志：打印 body 顶层 key 路径（不打印值，避免 token 泄漏）
    if (body && typeof body === "object") {
      const keys = Object.keys(body as Record<string, unknown>)
      console.log(`[Router] dispatch path="${path}" body keys:`, keys)
      const evt = body as Record<string, unknown>
      if (evt.header) {
        const h = evt.header as Record<string, unknown>
        console.log(`[Router] has header.event_type:`, h.event_type)
      }
      if (evt.event) {
        console.log(`[Router] has event, keys:`, Object.keys(evt.event as object))
      }
      if (!evt.header && !evt.event) {
        console.log(`[Router] NO header/event — 可能是 WS 原生格式`)
        if (evt.message) {
          const m = evt.message as Record<string, unknown>
          console.log(`[Router] WS format: message.chat_id="${m.chat_id}", message.message_id="${m.message_id}"`)
        }
        if (evt.sender) {
          console.log(`[Router] WS format: has sender, keys:`, Object.keys(evt.sender as object))
        }
      }
    }

    const msg = parseEvent(path, body)
    if (!msg) {
      console.log(`[Router] parseEvent returned undefined — 事件未识别`)
      return Effect.succeed({ ignored: true })
    }
    console.log(`[Router] parsed message: id="${msg.id}" chat="${msg.chat.id}" sender="${msg.sender.id}"`)
    return Queue.offer(queue, msg).pipe(
      Effect.andThen(Effect.succeed({ received: true, messageId: msg.id })),
    )
  }
}

function parseEvent(path: string, body: unknown): GatewayMessage | undefined {
  if (path.startsWith("/webhook/feishu")) {
    // 先尝试标准 HTTP callback 格式（{ header, event }）
    const httpResult = parseFeishuEvent(body)
    if (httpResult) return httpResult
    // fallback: WS 桥接原生格式（无 header/event 包装）
    // WS 协议 frame.payload 是裸事件 body：
    // { sender: { sender_id: {...} }, message: { message_id, chat_id, content } }
    if (body && typeof body === "object") {
      return parseFeishuBridgeEvent(body as Record<string, unknown>)
    }
    return undefined
  }
  if (path.startsWith("/webhook/wechat")) return parseWeChatEvent(body)
  return undefined
}

function parseFeishuEvent(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const evt = body as Record<string, unknown>
  const header = evt.header as Record<string, unknown> | undefined
  const eventBody = evt.event as Record<string, unknown> | undefined
  if (header?.event_type !== "im.message.receive_v1" || !eventBody) return undefined
  const sender = eventBody.sender as Record<string, unknown> | undefined
  const message = eventBody.message as Record<string, unknown> | undefined
  return {
    id: (message?.message_id as string) || `msg_${Date.now()}`,
    platform: "feishu",
    type: "text",
    content: extractFeishuText(message),
    sender: {
      id: ((sender?.sender_id as Record<string, string>)?.open_id) || "",
      name: (sender?.sender_type as string) || "unknown",
    },
    // chat_id 在 event.message.chat_id（v2.0 事件结构）
    // 兼容 fallback 到 event.chat_id（部分旧事件格式）
    chat: {
      id: (message?.chat_id as string) || (eventBody.chat_id as string) || "",
      type: "private",
    },
    timestamp: Date.now(),
    raw: body,
  }
}

/**
 * 解析飞书 WS 桥接转发的事件（无 header/event 包装）
 *
 * WS 协议的 frame.payload 是直接的事件 body，结构为：
 * { sender: { sender_id: { ... } }, message: { message_id, chat_id, content } }
 */
function parseFeishuBridgeEvent(body: Record<string, unknown>): GatewayMessage | undefined {
  const message = body.message as Record<string, unknown> | undefined
  if (!message) return undefined

  const chatId = (message.chat_id as string) || ""

  return {
    id: (message.message_id as string) || `msg_${Date.now()}`,
    platform: "feishu",
    type: "text",
    content: extractFeishuText(message),
    sender: {
      id: ((body.sender as Record<string, unknown>)?.sender_id as Record<string, string>)?.open_id || "",
      name: (body.sender as Record<string, unknown>)?.sender_type as string || "unknown",
    },
    chat: { id: chatId, type: "private" },
    timestamp: Date.now(),
    raw: body,
  }
}

function extractFeishuText(message: Record<string, unknown> | undefined): string {
  if (!message) return ""
  const c = message.content as string | undefined
  if (!c) return ""
  try {
    const p = JSON.parse(c)
    return (p.text as string) || ""
  } catch {
    return c
  }
}

function parseWeChatEvent(body: unknown): GatewayMessage | undefined {
  if (!body || typeof body !== "object") return undefined
  const evt = body as Record<string, unknown>
  const content = (evt.Content as string) || (evt.content as string) || ""
  const fromUser = (evt.FromUserName as string) || (evt.fromUser as string) || ""
  if (!content && !fromUser) return undefined
  return {
    id: (evt.MsgId as string) || `wx_${Date.now()}`,
    platform: "wechat",
    type: "text",
    content,
    sender: { id: fromUser, name: fromUser },
    chat: { id: (evt.ToUserName as string) || "", type: "private" },
    timestamp: Date.now(),
    raw: body,
  }
}
