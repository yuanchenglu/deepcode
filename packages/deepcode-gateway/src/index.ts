/**
 * DeepCode 消息网关 — 入口导出
 *
 * @module
 */

export type { GatewayMessage, OutboundMessage, SendResult } from "./message"
export type { PlatformType, MessageType, ChatType, OutboundType } from "./message"
export type { PlatformAdapter, PlatformCrypto, AdapterConfig } from "./adapter"
export type {
  GatewayConfig, FeishuConfig, WeComConfig, QQConfig, WeChatConfig,
  TelegramConfig, SlackConfig, SignalConfig, WhatsAppConfig,
  DingTalkConfig, MatrixConfig, EmailConfig,
} from "./config"
export { ENV_KEYS } from "./config"
export type { GatewayErrorCode } from "./error"
export { GatewayError } from "./error"
export { startServer, stopServer } from "./server"
export { Router } from "./router"
export { registerAdapter, startGateway, stopGateway, getMessageQueue } from "./lifecycle"
export { FeishuAdapter } from "./feishu/adapter"
export { WeComAdapter, parseWeComMessage } from "./wecom/adapter"
export { QQAdapter, parseQQMessage } from "./qq/adapter"
export { WeChatAdapter } from "./wechat/adapter"
export { TelegramAdapter } from "./telegram/adapter"
export { SlackAdapter } from "./slack/adapter"
export { SignalAdapter } from "./signal/adapter"
export { WhatsAppAdapter } from "./whatsapp/adapter"
export { DingTalkAdapter } from "./dingtalk/adapter"
export { MatrixAdapter } from "./matrix/adapter"
export { EmailAdapter } from "./email/adapter"
export { getOrCreateSession, processMessage, getSessionMap, clearSessionMap } from "./session-bridge"
export { gatewayPlugin } from "./plugin"
