/**
 * DeepCode 消息网关 — 错误类型
 *
 * @module
 */

export type GatewayErrorCode =
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "INVALID_MESSAGE"
  | "ADAPTER_NOT_FOUND"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR"

export class GatewayError {
  readonly _tag = "GatewayError" as const
  constructor(
    readonly code: GatewayErrorCode,
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}
