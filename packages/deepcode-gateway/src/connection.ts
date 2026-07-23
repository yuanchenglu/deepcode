/**
 * DeepCode 消息网关 — WebSocket 连接抽象
 *
 * 提供心跳 + 指数退避重连，供 QQ 机器人 WS 客户端使用。
 * 飞书 SDK 自带心跳/重连，不需要用这个抽象。
 *
 * @module
 */

import { GatewayError } from "./error"

/** 连接配置 */
export interface ConnectionConfig {
  /** WebSocket URL（或异步返回 URL） */
  url: string | (() => Promise<string>)
  /** 心跳间隔（毫秒），为 0 表示不发心跳；收到 Hello 后通常会覆盖该值 */
  heartbeatIntervalMs?: number
  /** 重连最大间隔（毫秒），默认 30s */
  reconnectMaxMs?: number
  /** 收到消息回调 */
  onMessage(data: unknown): void
  /** 连接就绪回调 */
  onReady?(): void
  /** 连接关闭回调（主动/被动） */
  onClose?(code: number, reason: string): void
}

/**
 * WebSocket 连接封装，支持：
 * - 自动重连（指数退避，初始 1s，翻倍，最大 30s）
 * - 定时心跳
 * - 对外暴露 send() 发送 JSON
 */
export class Connection {
  private ws: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private stopped = false
  private readonly cfg: ConnectionConfig

  constructor(cfg: ConnectionConfig) {
    this.cfg = { reconnectMaxMs: 30_000, ...cfg }
  }

  /** 启动连接（异步；连接成功后 onReady 被调用） */
  async start(): Promise<void> {
    this.stopped = false
    await this.connect()
  }

  /** 停止连接（不重连） */
  stop(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearHeartbeat()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
  }

  /** 发送 JSON 数据 */
  send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(data))
  }

  /** 更新心跳间隔（一般在收到 Hello 后调用） */
  setHeartbeat(intervalMs: number, payload?: unknown): void {
    this.cfg.heartbeatIntervalMs = intervalMs
    this.clearHeartbeat()
    if (intervalMs <= 0) return
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload ?? { op: 1 }))
      }
    }, intervalMs)
  }

  /** 一次性建立连接 */
  private async connect(): Promise<void> {
    const url = typeof this.cfg.url === "function" ? await this.cfg.url() : this.cfg.url
    const ws = new WebSocket(url)
    this.ws = ws

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (e) => {
        reject(new GatewayError("NETWORK_ERROR", `WebSocket open failed: ${String(e)}`))
      }
    })

    ws.onmessage = (ev) => {
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data
        this.cfg.onMessage(data)
      } catch (err) {
        // 非 JSON 帧，忽略（不应发生）
        console.error("[Connection] failed to parse message:", err)
      }
    }

    ws.onclose = (ev) => {
      this.clearHeartbeat()
      this.cfg.onClose?.(ev.code, ev.reason)
      // 主动 stop 不再重连
      if (this.stopped) return
      console.log(`[Connection] closed (code=${ev.code}), reconnect in ${this.reconnectDelay}ms`)
      this.scheduleReconnect()
    }

    this.cfg.onReady?.()
    if (this.cfg.heartbeatIntervalMs && this.cfg.heartbeatIntervalMs > 0) {
      this.setHeartbeat(this.cfg.heartbeatIntervalMs)
    }
  }

  /** 调度下一次重连（指数退避） */
  private scheduleReconnect(): void {
    const max = this.cfg.reconnectMaxMs ?? 30_000
    const delay = this.reconnectDelay
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, max)
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
        // 重连成功后重置退避
        this.reconnectDelay = 1000
      } catch (err) {
        console.error("[Connection] reconnect failed:", err)
        this.scheduleReconnect()
      }
    }, delay)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
