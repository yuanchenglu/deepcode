import { Effect } from "effect"
import type { PlatformAdapter } from "./adapter"
import type { GatewayMessage, OutboundMessage } from "./message"

const sessionMap = new Map<string, string>()

export function getOrCreateSession(chatId: string): string {
  let sid = sessionMap.get(chatId)
  if (!sid) { sid = `gateway_${chatId}_${Date.now()}`; sessionMap.set(chatId, sid) }
  return sid
}

export function handleIncomingMessage(msg: GatewayMessage, adapter: PlatformAdapter): Effect.Effect<void> {
  return Effect.gen(function* () {
    const sessionId = getOrCreateSession(msg.chat.id)
    const reply: OutboundMessage = { chatId: msg.chat.id, type: "text", content: `收到 (${sessionId}): ${msg.content.slice(0, 50)}` }
    yield* adapter.send(reply).pipe(Effect.ignore)
  })
}

export function getSessionMap(): ReadonlyMap<string, string> { return sessionMap }
