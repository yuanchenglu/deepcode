import { Effect } from "effect"
import type { GatewayError } from "./error"
import type { Router } from "./router"

export function startServer(port: number, _router: Router): Effect.Effect<void, GatewayError> {
  return Effect.void
}

export function stopServer(): Effect.Effect<void> {
  return Effect.void
}
