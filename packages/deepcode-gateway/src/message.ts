/**
 * DeepCode 消息网关 — 统一消息模型
 *
 * 定义跨平台统一的入站消息（GatewayMessage）和出站消息（OutboundMessage）格式。
 * 所有平台适配器（飞书、微信等）都使用此模型进行消息交换。
 *
 * @module
 */

// ============================================================
// 平台标识
// ============================================================

/** 支持的平台类型 */
export type PlatformType = "feishu" | "wechat" | "terminal"

/** 消息类型 */
export type MessageType = "text" | "image" | "file" | "event"

/** 会话类型 */
export type ChatType = "private" | "group"

// ============================================================
// 入站消息（平台 → DeepCode）
// ============================================================

/**
 * 网关统一入站消息
 *
 * 所有平台适配器将各自平台的事件转换为 GatewayMessage，
 * 上层逻辑（Session Bridge）通过统一的 Stream<GatewayMessage> 消费。
 */
export interface GatewayMessage {
  /** 消息唯一 ID（平台原始消息 ID） */
  readonly id: string
  /** 来源平台 */
  readonly platform: PlatformType
  /** 消息内容类型 */
  readonly type: MessageType
  /** 消息文本内容 */
  readonly content: string
  /** 发送者信息 */
  readonly sender: {
    readonly id: string
    readonly name: string
  }
  /** 会话信息 */
  readonly chat: {
    readonly id: string
    readonly type: ChatType
  }
  /** Unix 毫秒时间戳 */
  readonly timestamp: number
  /** 原始平台事件（调试用） */
  readonly raw?: unknown
}

// ============================================================
// 出站消息（DeepCode → 平台）
// ============================================================

/** 出站消息类型 */
export type OutboundType = "text" | "image" | "card"

/**
 * 网关统一出站消息
 *
 * 上层逻辑（Session Bridge、Agent 响应等）构造 OutboundMessage，
 * PlatformAdapter.send() 将其转换为对应平台的 API 调用。
 */
export interface OutboundMessage {
  /** 目标会话 ID（平台会话/群聊 ID） */
  readonly chatId: string
  /** 发送内容类型 */
  readonly type: OutboundType
  /** 文本内容 */
  readonly content: string
  /** 图片 URL（type=image 时可选） */
  readonly imageUrl?: string
}

// ============================================================
// 发送结果
// ============================================================

/** 消息发送结果 */
export interface SendResult {
  /** 平台返回的消息 ID */
  readonly platformMessageId: string
  /** 发送时间戳 */
  readonly timestamp: number
}
