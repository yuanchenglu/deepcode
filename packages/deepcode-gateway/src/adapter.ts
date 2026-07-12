/**
 * DeepCode 消息网关 — 平台适配器接口
 *
 * @module
 */

import type { Effect, Stream } from "effect"
import type { GatewayError } from "./error"
import type { GatewayMessage, OutboundMessage, SendResult } from "./message"

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  readonly name: string
  start(): Effect.Effect<void, GatewayError>
  stop(): Effect.Effect<void>
  send(msg: OutboundMessage): Effect.Effect<SendResult, GatewayError>
  readonly messages: Stream.Stream<GatewayMessage, GatewayError>
}

export interface AdapterConfig {
  readonly enabled: boolean
  readonly [key: string]: unknown
}
