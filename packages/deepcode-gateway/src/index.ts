/**
 * DeepCode 消息网关 — 入口导出
 *
 * @module
 */

export type { GatewayMessage, OutboundMessage, SendResult } from "./message"
export type { PlatformType, MessageType, ChatType, OutboundType } from "./message"
export type { PlatformAdapter, AdapterConfig } from "./adapter"
export type { GatewayConfig, FeishuConfig, WeChatConfig } from "./config"
export { ENV_KEYS } from "./config"
export type { GatewayErrorCode } from "./error"
export { GatewayError } from "./error"
export { startServer, stopServer } from "./server"
export { Router } from "./router"
export { registerAdapter, startGateway, stopGateway, getMessageQueue } from "./lifecycle"
export { FeishuAdapter } from "./feishu/adapter"
export { WeChatAdapter } from "./wechat/adapter"
export { getOrCreateSession, handleIncomingMessage, getSessionMap } from "./session-bridge"
export { gatewayPlugin } from "./plugin"
