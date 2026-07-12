/**
 * DeepCode 消息网关 — 配置管理
 *
 * 从 opencode.jsonc（或环境变量）读取网关配置。
 * 敏感信息（appSecret、token 等）优先从环境变量读取。
 *
 * @module
 */

import type { AdapterConfig } from "./adapter"

/**
 * 飞书适配器配置
 */
export interface FeishuConfig extends AdapterConfig {
  /** 飞书应用 App ID */
  readonly appId: string
  /** 飞书应用 App Secret */
  readonly appSecret: string
  /** Webhook 路径（默认 /webhook/feishu） */
  readonly webhook?: string
  /** HTTP 服务端口（默认 3099） */
  readonly port?: number
}

/**
 * 微信（企业微信）适配器配置
 */
export interface WeChatConfig extends AdapterConfig {
  /** 接入模式：wecom = 企业微信, ilink = 个人微信 iLink */
  readonly mode: "wecom" | "ilink"
  /** 企业微信 CorpID */
  readonly corpId?: string
  /** 企业微信 AgentID */
  readonly agentId?: string
  /** 企业微信 Secret */
  readonly secret?: string
}

/**
 * 完整网关配置
 */
export interface GatewayConfig {
  readonly feishu?: FeishuConfig
  readonly wechat?: WeChatConfig
}

/**
 * 环境变量键名常量
 * 敏感配置优先从环境变量读取，覆盖 opencode.jsonc 中的值。
 */
export const ENV_KEYS = {
  FEISHU_APP_ID: "OPENCODE_FEISHU_APP_ID",
  FEISHU_APP_SECRET: "OPENCODE_FEISHU_APP_SECRET",
  WECHAT_CORP_ID: "OPENCODE_WECHAT_CORP_ID",
  WECHAT_AGENT_ID: "OPENCODE_WECHAT_AGENT_ID",
  WECHAT_SECRET: "OPENCODE_WECHAT_SECRET",
} as const
