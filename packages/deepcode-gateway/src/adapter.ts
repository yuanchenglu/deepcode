/**
 * DeepCode 消息网关 — 平台适配器接口
 *
 * 基于 Hermes Gateway BasePlatformAdapter 设计模式，提供 TypeScript 原生接口。
 * 每个平台（飞书、微信等）实现 PlatformAdapter 接口即可接入网关。
 *
 * @module
 */

import type { Effect, Stream } from "effect"
import type { GatewayError } from "./error"
import type { GatewayMessage, OutboundMessage, SendResult } from "./message"

/**
 * 平台适配器接口
 *
 * 平台适配器生命周期：
 * 1. start() — 启动监听（如 Webhook 服务器、长轮询等）
 * 2. messages — 持续产生入站消息 Stream
 * 3. send() — 发送出站消息到平台
 * 4. stop() — 优雅关闭
 */
export interface PlatformAdapter {
  /** 适配器名称，如 "feishu"、"wechat" */
  readonly name: string

  /**
   * 启动适配器
   * 建立与平台的连接/监听。
   */
  start(): Effect.Effect<never, GatewayError, void>

  /**
   * 停止适配器
   * 优雅关闭连接，释放资源。
   */
  stop(): Effect.Effect<never, never, void>

  /**
   * 发送消息到平台
   * @param msg - 出站消息
   * @returns 发送结果
   */
  send(msg: OutboundMessage): Effect.Effect<never, GatewayError, SendResult>

  /**
   * 入站消息流
   * 持续产生来自该平台的入站消息。
   */
  readonly messages: Stream.Stream<never, GatewayError, GatewayMessage>
}

/**
 * 网关配置接口
 * 平台适配器的通用配置结构。
 */
export interface AdapterConfig {
  /** 是否启用 */
  readonly enabled: boolean
  /** 平台特有的配置参数（key-value 形式） */
  readonly [key: string]: unknown
}
