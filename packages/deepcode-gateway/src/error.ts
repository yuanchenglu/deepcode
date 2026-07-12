/**
 * DeepCode 消息网关 — 错误类型定义
 *
 * 定义网关层面的统一错误类型，涵盖网络、认证、消息格式等各类异常。
 *
 * @module
 */

/**
 * 网关错误类型枚举
 */
export type GatewayErrorCode =
  | "NETWORK_ERROR"       // 网络连接失败
  | "AUTH_ERROR"          // 认证/Token 失效
  | "RATE_LIMITED"        // 被平台限流
  | "INVALID_MESSAGE"     // 消息格式无效
  | "ADAPTER_NOT_FOUND"   // 未找到对应平台适配器
  | "CONFIG_ERROR"        // 配置错误
  | "INTERNAL_ERROR"      // 内部错误

/**
 * 网关统一的 Tagged Error
 *
 * 使用 Effect 的 TaggedError 模式，支持在 Effect 管道中
 * 通过 Effect.catchTag 进行精确的错误分类处理。
 */
export class GatewayError {
  readonly _tag = "GatewayError" as const
  constructor(
    readonly code: GatewayErrorCode,
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}
