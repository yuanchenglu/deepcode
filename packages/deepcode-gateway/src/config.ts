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

export interface GatewayConfig {
  readonly feishu?: FeishuConfig
  readonly wechat?: WeChatConfig
}

export const ENV_KEYS = {
  FEISHU_APP_ID: "OPENCODE_FEISHU_APP_ID",
  FEISHU_APP_SECRET: "OPENCODE_FEISHU_APP_SECRET",
  WECHAT_CORP_ID: "OPENCODE_WECHAT_CORP_ID",
  WECHAT_AGENT_ID: "OPENCODE_WECHAT_AGENT_ID",
  WECHAT_SECRET: "OPENCODE_WECHAT_SECRET",
} as const
