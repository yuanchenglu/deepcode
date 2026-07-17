/**
 * DeepCode 消息网关 — 飞书长链接（WebSocket）客户端
 *
 * 飞书开放平台支持两种事件接收方式：
 * 1. Webhook（HTTP回调）：需要公网IP/域名，适合生产环境
 * 2. 长链接（WebSocket）：客户端主动连接飞书服务器，无需公网，适合开发/内网
 *
 * 本模块实现长链接模式：
 * 1. 通过 /event/v1/ws/get_endpoint 获取 WebSocket 地址
 * 2. 建立 WSS 连接并处理握手（CLIENT_HELLO 携带 app_access_token）
 * 3. 接收事件推送并通过回调交给上层处理
 * 4. 自动心跳保活 + 断线重连（指数退避）
 *
 * Bun 原生支持 WebSocket，无需引入 ws npm 包。
 *
 * 参考文档：https://open.feishu.cn/document/event-v1/ws/get_endpoint
 *
 * @module feishu/ws-client
 */

import type { FeishuConfig } from "../config"

/** 飞书 API 基础地址 */
const FEISHU_API_BASE = "https://open.feishu.cn/open-apis"

/**
 * WebSocket 帧类型枚举（飞书长链接协议）
 *
 * 飞书 WS 协议使用数字标识帧类型：
 * - WELCOME(0):      服务端握手响应，包含心跳间隔
 * - PING(1):         服务端心跳探测
 * - PONG(2):         服务端心跳回复
 * - EVENT(3):        事件推送（如 im.message.receive_v1）
 * - CLIENT_HELLO(10): 客户端握手，携带 app_access_token 认证
 * - CLIENT_PONG(11):  客户端心跳回复
 */
const FrameType = {
  WELCOME: 0,
  PING: 1,
  PONG: 2,
  EVENT: 3,
  CLIENT_HELLO: 10,
  CLIENT_PONG: 11,
} as const

/**
 * 飞书 WebSocket 消息帧结构（JSON 编码）
 *
 * 飞书 WS 协议的帧是 JSON 字符串，通过 `t` 字段区分类型。
 */
interface FeishuWSFrame {
  /** 帧类型（对应 FrameType 枚举值） */
  t?: number
  /** 消息 ID（用于心跳匹配） */
  msg_id?: string
  /** 握手响应数据（仅 WELCOME 帧有） */
  welcome?: {
    /** 心跳间隔（毫秒），默认 30000 */
    heartbeat_interval?: number
    /** 会话 ID */
    session_id?: string
  }
  /** 事件数据（仅 EVENT 帧有，包含 header + event） */
  event?: Record<string, unknown>
  /** Ping 时间戳（仅 PING 帧有） */
  ping?: { timestamp?: number }
}

/**
 * 事件回调类型
 *
 * 收到 EVENT 帧时调用，传入 frame.event（包含 header 和 event 字段的事件体）。
 * 上层（FeishuAdapter）负责解析事件体并推入消息队列。
 */
export type OnEventCallback = (eventBody: unknown) => void

/**
 * 飞书长链接客户端
 *
 * 职责：建立/维护与飞书服务器的 WebSocket 连接，自动处理心跳、重连、事件分发。
 * 不负责发送消息（发送走 REST API，由 FeishuAdapter 处理）。
 *
 * 生命周期：
 * 1. start() → getAppAccessToken() → getEndpoint() → WebSocket 连接
 * 2. onopen → sendClientHello(token) → 等待 WELCOME 帧
 * 3. WELCOME → startHeartbeat(interval) → 进入正常事件接收
 * 4. EVENT → onEvent 回调通知上层
 * 5. 断线 → scheduleReconnect() → 指数退避重连
 * 6. stop() → 关闭连接 + 清除定时器
 */
export class FeishuWSClient {
  /** 飞书应用配置（appId + appSecret） */
  private readonly config: FeishuConfig
  /** WebSocket 实例（Bun 原生 WebSocket） */
  private ws: WebSocket | null = null
  /** 事件回调（由上层 adapter 注入） */
  private onEvent: OnEventCallback | null = null
  /** 是否正在运行（stop 后变为 false，阻止重连） */
  private running = false
  /** 重连定时器 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  /** 当前重连延迟（指数退避，从 1 秒开始翻倍） */
  private reconnectDelay = 1000
  /** 最大重连延迟（60 秒） */
  private readonly maxReconnectDelay = 60000
  /** app_access_token 缓存（用于 WS 认证，与 tenant_access_token 不同） */
  private appToken: string | null = null
  /** app_access_token 过期时间戳 */
  private appTokenExpireAt = 0
  /** 日志前缀 */
  private readonly logPrefix = "[FeishuWS]"

  constructor(config: FeishuConfig) {
    this.config = config
  }

  /**
   * 设置事件回调
   *
   * 在 start() 之前调用，注册事件处理函数。
   * 收到 EVENT 帧时，frame.event 会被传入此回调。
   *
   * @param callback - 收到飞书事件时调用，传入解析后的事件体
   */
  setEventHandler(callback: OnEventCallback): void {
    this.onEvent = callback
  }

  /**
   * 启动 WebSocket 长链接
   *
   * 首先获取 WSS 端点，然后建立连接。
   * 连接失败或断线后自动重连（指数退避）。
   * 此方法返回 Promise，连接建立后 resolve（但连接保持活跃）。
   */
  async start(): Promise<void> {
    this.running = true
    this.log("正在启动飞书长链接客户端...")
    await this.connect()
  }

  /**
   * 停止 WebSocket 长链接
   *
   * 关闭连接，清除所有定时器，阻止后续重连。
   */
  stop(): void {
    this.running = false
    this.clearTimers()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // 忽略关闭错误
      }
      this.ws = null
    }
    this.log("飞书长链接客户端已停止")
  }

  /**
   * 建立 WebSocket 连接
   *
   * 流程：
   * 1. 获取 app_access_token（WS 认证用）
   * 2. 调用 getEndpoint 获取 WSS URL
   * 3. 创建 WebSocket 连接
   * 4. onopen → 发送 CLIENT_HELLO 握手
   * 5. onmessage → 分发帧到 handleFrame
   * 6. onclose → 触发重连（如果仍在运行）
   */
  private async connect(): Promise<void> {
    if (!this.running) return

    try {
      // 获取 app_access_token（长链接认证用）
      const token = await this.getAppAccessToken()
      if (!token) {
        throw new Error("无法获取 app_access_token")
      }

      // 获取 WSS 端点
      const endpoint = await this.getEndpoint(token)
      if (!endpoint) {
        throw new Error("无法获取 WebSocket endpoint")
      }

      this.log(`正在连接: ${endpoint}`)
      // Bun 原生 WebSocket
      this.ws = new WebSocket(endpoint)

      // 连接建立后发送握手帧
      this.ws.onopen = () => {
        this.log("WebSocket 连接已建立")
        // 重连成功后重置退避延迟
        this.reconnectDelay = 1000
        this.sendClientHello(token)
      }

      // 收到消息时解析帧
      this.ws.onmessage = (event) => {
        this.handleFrame(event.data.toString())
      }

      // 错误事件不直接处理，close 事件会触发重连
      this.ws.onerror = (err) => {
        this.log(`WebSocket 错误: ${err instanceof Error ? err.message : "未知错误"}`)
      }

      // 连接关闭后触发重连（如果仍在运行）
      this.ws.onclose = (event) => {
        this.log(`WebSocket 连接关闭 (code: ${event.code})`)
        this.clearHeartbeat()
        if (this.running) {
          this.scheduleReconnect()
        }
      }
    } catch (err) {
      this.log(`连接失败: ${err instanceof Error ? err.message : String(err)}`)
      if (this.running) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * 处理收到的 WebSocket 帧
   *
   * 根据 frame.t 分发到对应的处理逻辑：
   * - WELCOME: 握手成功，启动心跳
   * - PING:    回复 PONG
   * - PONG:    忽略（服务端回复我们的 PING）
   * - EVENT:   调用 onEvent 回调通知上层
   *
   * @param data - 原始帧数据（JSON 字符串）
   */
  private handleFrame(data: string): void {
    try {
      const frame = JSON.parse(data) as FeishuWSFrame

      switch (frame.t) {
        case FrameType.WELCOME: {
          // 握手成功，启动心跳保活
          const interval = frame.welcome?.heartbeat_interval ?? 30000
          this.log(`握手成功，心跳间隔: ${interval}ms`)
          this.startHeartbeat(interval)
          break
        }

        case FrameType.PING: {
          // 服务端发送心跳 PING，回复 PONG
          this.sendPong(frame)
          break
        }

        case FrameType.PONG: {
          // 服务端回复我们的 PING，不需要处理
          break
        }

        case FrameType.EVENT: {
          // 收到事件推送，调用上层回调
          if (frame.event && this.onEvent) {
            this.onEvent(frame.event)
          }
          break
        }

        default:
          // 未知帧类型，忽略
          break
      }
    } catch (err) {
      this.log(`解析帧失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * 发送客户端握手帧（CLIENT_HELLO）
   *
   * 连接建立后立即发送，携带 app_access_token 进行认证。
   * 飞书服务器验证 token 后会返回 WELCOME 帧。
   *
   * @param token - app_access_token
   */
  private sendClientHello(token: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const frame = {
      t: FrameType.CLIENT_HELLO,
      client_hello: {
        token,
        // 客户端生成的消息 ID（用于日志追踪）
        client_msg_id: `deepcode_${Date.now()}`,
      },
    }
    this.ws.send(JSON.stringify(frame))
  }

  /**
   * 回复心跳 PONG
   *
   * 飞书要求返回相同的时间戳或 msg_id。
   *
   * @param pingFrame - 收到的 PING 帧
   */
  private sendPong(pingFrame: FeishuWSFrame): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const frame = {
      t: FrameType.CLIENT_PONG,
      pong: {
        timestamp: pingFrame.ping?.timestamp ?? Date.now(),
      },
    }
    this.ws.send(JSON.stringify(frame))
  }

  /**
   * 启动心跳定时器
   *
   * 定期发送 PING 帧保持连接活跃。
   *
   * @param intervalMs - 心跳间隔（毫秒），由 WELCOME 帧指定
   */
  private startHeartbeat(intervalMs: number): void {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const pingFrame = {
          t: FrameType.PING,
          ping: { timestamp: Date.now() },
        }
        this.ws.send(JSON.stringify(pingFrame))
      }
    }, intervalMs)
  }

  /** 清除心跳定时器 */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 安排重连（指数退避）
   *
   * 重连延迟从 1 秒开始，每次翻倍，最大 60 秒。
   * 重连成功后（onopen 触发）重置为 1 秒。
   */
  private scheduleReconnect(): void {
    this.clearTimers()
    const delay = this.reconnectDelay
    this.log(`将在 ${delay}ms 后重连...`)
    this.reconnectTimer = setTimeout(async () => {
      // 指数退避：延迟翻倍，上限 60 秒
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
      await this.connect()
    }, delay)
  }

  /** 清除所有定时器（心跳 + 重连） */
  private clearTimers(): void {
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 获取 app_access_token
   *
   * 与 tenant_access_token 不同，app_access_token 代表应用本身身份，
   * 用于长链接认证。tenant_access_token 用于 REST API 调用。
   *
   * @returns app_access_token 字符串；失败返回 null
   */
  private async getAppAccessToken(): Promise<string | null> {
    // 检查缓存（提前 5 分钟过期）
    if (this.appToken && this.appTokenExpireAt > Date.now()) {
      return this.appToken
    }

    try {
      const resp = await fetch(
        `${FEISHU_API_BASE}/auth/v3/app_access_token/internal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            app_id: this.config.appId,
            app_secret: this.config.appSecret,
          }),
        },
      )

      const data = await resp.json() as {
        code?: number
        app_access_token?: string
        expire?: number
      }

      if (data.code !== 0 || !data.app_access_token) {
        return null
      }

      // 缓存 token，提前 5 分钟过期以避免边界问题
      this.appToken = data.app_access_token
      this.appTokenExpireAt = Date.now() + (data.expire ?? 7200) * 1000 - 5 * 60 * 1000
      return this.appToken
    } catch {
      return null
    }
  }

  /**
   * 获取 WebSocket 连接端点
   *
   * 调用飞书 API 获取当前有效的 WSS 连接地址。
   * 端点 URL 是临时的，每次重连需重新获取。
   *
   * @param token - app_access_token
   * @returns WSS URL 字符串；失败返回 null
   */
  private async getEndpoint(token: string): Promise<string | null> {
    try {
      const resp = await fetch(
        `${FEISHU_API_BASE}/event/v1/ws/get_endpoint`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({}),
        },
      )

      const data = await resp.json() as {
        code?: number
        data?: { endpoint?: string }
      }

      if (data.code !== 0 || !data.data?.endpoint) {
        return null
      }

      return data.data.endpoint
    } catch {
      return null
    }
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
