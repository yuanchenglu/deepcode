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
    const queue = this.routes.get(path)
    if (!queue) {
      return Effect.fail(new GatewayError("ADAPTER_NOT_FOUND", `No adapter for path: ${path}`))
    }
    const msg = parseEvent(path, body)
    if (!msg) {
      return Effect.succeed({ ignored: true })
    }
    return Queue.offer(queue, msg).pipe(
      Effect.andThen(Effect.succeed({ received: true, messageId: msg.id })),
    )
  }
}

function parseEvent(path: string, body: unknown): GatewayMessage | undefined {
  if (path.startsWith("/webhook/feishu")) return parseFeishuEvent(body)
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
    chat: { id: (eventBody.chat_id as string) || "", type: "private" },
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
