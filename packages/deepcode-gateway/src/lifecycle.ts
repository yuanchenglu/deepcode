import { Effect, Queue } from "effect"
import type { PlatformAdapter } from "./adapter"
import type { GatewayMessage } from "./message"
import { Router } from "./router"
import { startServer, stopServer } from "./server"
import type { GatewayError } from "./error"

const adapters = new Map<string, PlatformAdapter>()
let mq: Queue.Queue<GatewayMessage> | null = null

export function registerAdapter(adapter: PlatformAdapter): void { adapters.set(adapter.name, adapter) }

export function startGateway(port: number = 3099): Effect.Effect<void, GatewayError> {
  return Effect.gen(function* () {
    mq = yield* Queue.unbounded<GatewayMessage>()
    const router = new Router()
    for (const [name] of adapters) router.register({ path: `/webhook/${name}`, platform: name as "feishu" | "wechat" }, mq)
    for (const a of adapters.values()) yield* a.start()
    yield* startServer(port, router)
  })
}

export function stopGateway(): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* stopServer()
    for (const a of adapters.values()) yield* a.stop()
    adapters.clear()
    mq = null
  })
}

export function getMessageQueue(): Queue.Queue<GatewayMessage> | null { return mq }
