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

  /** 可选：处理原始 Webhook 请求（XML/表单格式的平台需要此方法） */
  handleWebhook?(req: Request): Promise<Response> | Effect.Effect<Response, GatewayError>

  /**
   * 平台加解密能力（用于需要消息加解密的平台）
   */
  crypto?: PlatformCrypto
}

export interface PlatformCrypto {
  verifySignature(signature: string, timestamp: string, nonce: string, encrypted: string): boolean
  decrypt(encrypted: string): string | { message: string; receiveId: string }
  encrypt(plaintext: string): string
}

export interface AdapterConfig {
  readonly enabled: boolean
  readonly [key: string]: unknown
}
