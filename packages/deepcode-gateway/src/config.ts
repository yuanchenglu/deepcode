/**
 * DeepCode 消息网关 — 配置管理
 *
 * @module
 */

import type { AdapterConfig } from "./adapter"

export interface FeishuConfig extends AdapterConfig {
  readonly appId: string
  readonly appSecret: string
  readonly webhook?: string
  readonly port?: number
}

export interface WeChatConfig extends AdapterConfig {
  readonly mode: "wecom" | "ilink"
  readonly corpId?: string
  readonly agentId?: string
  readonly secret?: string
}

/**
 * WeChatConfig 服务于已有的 wechat 适配器（ilink 模式），
 * WeComConfig 服务于新增的 wecom 适配器（标准 WebHook 模式）。
 */

/** 企业微信配置 */
export interface WeComConfig extends AdapterConfig {
  /** 企业 ID */
  readonly corpId: string
  /** 应用 AgentId */
  readonly agentId: string
  /** 应用 Secret */
  readonly secret: string
  /** 回调 Token */
  readonly token: string
  /** 回调 EncodingAESKey（43 字符） */
  readonly encodingAESKey: string
}

/** QQ 机器人配置 */
export interface QQConfig extends AdapterConfig {
  /** 机器人 AppID */
  readonly appId: string
  /** 机器人 AppSecret */
  readonly appSecret: string
  /** 回调 Token */
  readonly token: string
  /** 沙箱模式 */
  readonly sandbox?: boolean
}

/** Telegram Bot 配置 */
export interface TelegramConfig extends AdapterConfig {
  /** Bot Token */
  readonly botToken: string
  /** 自定义 API 基础地址（可选，用于代理） */
  readonly apiBase?: string
  /** Webhook 签名密钥（X-Telegram-Bot-Api-Secret-Token） */
  readonly secretToken?: string
}

/** Slack 配置 */
export interface SlackConfig extends AdapterConfig {
  /** Bot Token */
  readonly botToken: string
  /** 签名密钥 */
  readonly signingSecret: string
}

/** Signal 配置（signal-cli REST API 模式） */
export interface SignalConfig extends AdapterConfig {
  /** signal-cli REST API 基础地址 */
  readonly apiBase: string
  /** 本端 Signal 号码 */
  readonly phoneNumber: string
}

/** WhatsApp Business Cloud API 配置 */
export interface WhatsAppConfig extends AdapterConfig {
  /** API Key */
  readonly apiKey: string
  /** API 基础地址 */
  readonly apiBase: string
  /** 商业电话号码 ID */
  readonly phoneNumberId: string
  /** App Secret（用于 Webhook 签名校验） */
  readonly appSecret?: string
  /** Webhook Verify Token */
  readonly verifyToken?: string
}

/** 钉钉配置 */
export interface DingTalkConfig extends AdapterConfig {
  /** 应用 AppKey */
  readonly appKey: string
  /** 应用 AppSecret */
  readonly appSecret: string
  /** 回调 Token */
  readonly token: string
  /** 加密 AES Key */
  readonly encodingAESKey: string
  /** Webhook 签名密钥 */
  readonly signSecret?: string
}

/** Matrix 配置 */
export interface MatrixConfig extends AdapterConfig {
  /** Matrix 服务器地址 */
  readonly homeserver: string
  /** 访问 Token */
  readonly accessToken: string
  /** 用户 ID */
  readonly userId: string
}

/** Email 配置 */
export interface EmailConfig extends AdapterConfig {
  /** SMTP 服务器地址 */
  readonly smtpHost: string
  /** SMTP 端口 */
  readonly smtpPort: number
  /** SMTP 用户名 */
  readonly username: string
  /** SMTP 密码 */
  readonly password: string
  /** Webhook 签名校验密钥 */
  readonly webhookSecret?: string
  /** SendGrid API Key */
  readonly sendgridApiKey?: string
  /** 发件人地址 */
  readonly fromAddress?: string
}

/** 完整网关配置 */
export interface GatewayConfig {
  readonly feishu?: FeishuConfig
  readonly wechat?: WeChatConfig
  readonly wecom?: WeComConfig
  readonly qq?: QQConfig
  readonly telegram?: TelegramConfig
  readonly slack?: SlackConfig
  readonly signal?: SignalConfig
  readonly whatsapp?: WhatsAppConfig
  readonly dingtalk?: DingTalkConfig
  readonly matrix?: MatrixConfig
  readonly email?: EmailConfig
}

export const ENV_KEYS = {
  FEISHU_APP_ID: "OPENCODE_FEISHU_APP_ID",
  FEISHU_APP_SECRET: "OPENCODE_FEISHU_APP_SECRET",
  WECHAT_CORP_ID: "OPENCODE_WECHAT_CORP_ID",
  WECHAT_AGENT_ID: "OPENCODE_WECHAT_AGENT_ID",
  WECHAT_SECRET: "OPENCODE_WECHAT_SECRET",
  WECOM_CORP_ID: "OPENCODE_WECOM_CORP_ID",
  WECOM_AGENT_ID: "OPENCODE_WECOM_AGENT_ID",
  WECOM_SECRET: "OPENCODE_WECOM_SECRET",
  WECOM_TOKEN: "OPENCODE_WECOM_TOKEN",
  WECOM_ENCODING_AES_KEY: "OPENCODE_WECOM_ENCODING_AES_KEY",
  QQ_APP_ID: "OPENCODE_QQ_APP_ID",
  QQ_APP_SECRET: "OPENCODE_QQ_APP_SECRET",
  QQ_TOKEN: "OPENCODE_QQ_TOKEN",
  TELEGRAM_BOT_TOKEN: "OPENCODE_TELEGRAM_BOT_TOKEN",
  TELEGRAM_API_BASE: "OPENCODE_TELEGRAM_API_BASE",
  SLACK_BOT_TOKEN: "OPENCODE_SLACK_BOT_TOKEN",
  SLACK_SIGNING_SECRET: "OPENCODE_SLACK_SIGNING_SECRET",
  SIGNAL_API_BASE: "OPENCODE_SIGNAL_API_BASE",
  SIGNAL_PHONE_NUMBER: "OPENCODE_SIGNAL_PHONE_NUMBER",
  WHATSAPP_API_KEY: "OPENCODE_WHATSAPP_API_KEY",
  WHATSAPP_API_BASE: "OPENCODE_WHATSAPP_API_BASE",
  WHATSAPP_PHONE_NUMBER_ID: "OPENCODE_WHATSAPP_PHONE_NUMBER_ID",
  DINGTALK_APP_KEY: "OPENCODE_DINGTALK_APP_KEY",
  DINGTALK_APP_SECRET: "OPENCODE_DINGTALK_APP_SECRET",
  DINGTALK_TOKEN: "OPENCODE_DINGTALK_TOKEN",
  DINGTALK_ENCODING_AES_KEY: "OPENCODE_DINGTALK_ENCODING_AES_KEY",
  MATRIX_HOMESERVER: "OPENCODE_MATRIX_HOMESERVER",
  MATRIX_ACCESS_TOKEN: "OPENCODE_MATRIX_ACCESS_TOKEN",
  MATRIX_USER_ID: "OPENCODE_MATRIX_USER_ID",
  EMAIL_SMTP_HOST: "OPENCODE_EMAIL_SMTP_HOST",
  EMAIL_SMTP_PORT: "OPENCODE_EMAIL_SMTP_PORT",
  EMAIL_USERNAME: "OPENCODE_EMAIL_USERNAME",
  EMAIL_PASSWORD: "OPENCODE_EMAIL_PASSWORD",
} as const
