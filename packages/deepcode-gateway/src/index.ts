/**
 * DeepCode 消息网关 — 入口导出
 *
 * @module
 */

// 核心类型
export type { GatewayMessage, OutboundMessage, SendResult } from "./message"
export type { PlatformType, MessageType, ChatType, OutboundType } from "./message"

// 适配器接口
export type { PlatformAdapter, AdapterConfig } from "./adapter"

// 配置
export type { GatewayConfig, FeishuConfig, WeChatConfig } from "./config"
export { ENV_KEYS } from "./config"

// 错误
export type { GatewayErrorCode } from "./error"
export { GatewayError } from "./error"
