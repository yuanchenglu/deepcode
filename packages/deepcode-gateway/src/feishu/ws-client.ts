/**
 * DeepCode 消息网关 — 飞书长链接（WebSocket）客户端
 *
 * 使用 @larksuiteoapi/node-sdk 的 WSClient 建立长连接。
 * SDK 内部处理 protobuf 编解码、认证、心跳、重连、数据分片合并。
 *
 * 替代之前 basalt 方案的纯 TS 实现（该方案使用了不存在的 get_endpoint API、
 * 错误的 JSON 帧协议、错误的帧类型定义和错误的认证方式）。
 *
 * @module feishu/ws-client
 */

import * as Lark from "@larksuiteoapi/node-sdk"
import type { FeishuConfig } from "../config"

/** 事件回调类型 — 收到 im.message.receive_v1 事件时调用 */
export type OnEventCallback = (data: unknown) => void

/**
 * 飞书长链接客户端（基于官方 Node SDK）
 *
 * 封装 @larksuiteoapi/node-sdk 的 WSClient，
 * 提供 start/stop/setEventHandler 接口供 FeishuAdapter 调用。
 *
 * SDK 内部负责：
 * - 通过 POST /callback/ws/endpoint 获取 WSS 地址（含 device_id + service_id）
 * - 建立 WebSocket 连接
 * - protobuf 帧编解码
 * - 心跳保活（按服务端返回的 PingInterval）
 * - 自动重连（指数退避）
 * - 数据分片合并（大事件分多帧传输时自动合并）
 */
export class FeishuWSClient {
  /** 飞书应用配置（appId + appSecret） */
  private readonly config: FeishuConfig
  /** SDK 的 WSClient 实例 */
  private wsClient: Lark.WSClient | null = null
  /** 事件回调（由上层 adapter 注入） */
  private onEvent: OnEventCallback | null = null
  /** 日志前缀 */
  private readonly logPrefix = "[FeishuWS]"

  constructor(config: FeishuConfig) {
    this.config = config
  }

  /**
   * 设置事件回调
   *
   * 在 start() 之前调用，注册事件处理函数。
   * 收到 im.message.receive_v1 事件时，SDK 传入的事件数据会被传给此回调。
   * 回调接收的 data 结构为 { sender, message }（即事件体中的 event 字段内容）。
   *
   * @param callback - 收到飞书消息事件时调用
   */
  setEventHandler(callback: OnEventCallback): void {
    this.onEvent = callback
  }

  /**
   * 启动长连接
   *
   * 使用 SDK 的 WSClient.start() + EventDispatcher.register() 注册事件处理器。
   * SDK 内部处理认证（AppID + AppSecret 放在 HTTP 请求体中）、
   * 心跳、重连、protobuf 编解码。
   *
   * 启动后 SDK 会自动连接飞书服务器，连接成功后开始接收事件。
   */
  async start(): Promise<void> {
    this.log("正在启动飞书长链接客户端（Node SDK WSClient）...")

    // 创建 WSClient 实例，配置 appId/appSecret 和 debug 日志
    this.wsClient = new Lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      // debug 级别日志帮助排查连接问题
      loggerLevel: Lark.LoggerLevel.debug,
    })

    // 启动长连接 + 注册事件处理器
    // SDK 内部会：1) 获取 WSS 端点 2) 建立连接 3) 启动心跳 4) 分发事件
    await this.wsClient.start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        // 注册消息接收事件 — 飞书 IM 消息事件
        "im.message.receive_v1": async (data: unknown) => {
          const msgId = (data as Record<string, unknown>)?.message
            ? ((data as Record<string, unknown>).message as Record<string, unknown>)?.message_id
            : "unknown"
          this.log(`收到消息事件: message_id=${msgId}`)
          // 将事件数据传给上层回调（adapter 负责解析为 GatewayMessage）
          if (this.onEvent) {
            this.onEvent(data)
          }
        },
      }),
    })

    this.log("飞书长链接客户端已启动（等待连接建立）")
  }

  /**
   * 停止长连接
   *
   * SDK 的 WSClient 没有显式 stop() 方法。
   * 这里置 null 释放引用，进程退出时连接会自动断开。
   * SDK 内部的心跳/重连定时器会随进程退出而清除。
   */
  stop(): void {
    this.wsClient = null
    this.log("飞书长链接客户端已停止")
  }

  /**
   * 输出带前缀的日志
   *
   * @param msg - 日志消息
   */
  private log(msg: string): void {
    console.log(`${this.logPrefix} ${msg}`)
  }
}
