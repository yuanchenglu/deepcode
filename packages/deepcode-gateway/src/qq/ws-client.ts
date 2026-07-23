/**
 * DeepCode 消息网关 — QQ 官方机器人 WebSocket 客户端
 *
 * 基于 Connection 抽象，实现 QQ 机器人 Gateway 协议：
 * - opcode 10 Hello → 读取 heartbeat_interval
 * - opcode 0  Dispatch → 分 t 字段（READY/AT_MESSAGE_CREATE 等）
 * - opcode 11 Heartbeat ACK
 * - opcode 7  Reconnect → 关闭并触发重连
 * - opcode 9  Invalid Session → 重新 IDENTIFY
 *
 * 本 client 只做协议解析与回调，不包含业务逻辑。
 *
 * @module qq/ws-client
 */

import { Connection } from "../connection"
import type { QQConfig } from "../config"

export type QQDispatchHandler = (eventType: string, data: unknown) => void

export class QQWSClient {
  private readonly cfg: QQConfig
  private conn: Connection | null = null
  private onDispatch: QQDispatchHandler | null = null
  private sequence: number | null = null
  private sessionId: string | null = null
  private logPrefix = "[QQWS]"

  constructor(cfg: QQConfig) {
    this.cfg = cfg
  }

  setDispatchHandler(handler: QQDispatchHandler): void {
    this.onDispatch = handler
  }

  /**
   * 启动 WebSocket 连接
   * 调用方应先通过 QQAdapter.getGatewayUrl() 拿到 URL 后传入
   */
  async start(url: string): Promise<void> {
    this.log("启动 WebSocket 连接...")
    const conn = new Connection({
      url,
      heartbeatIntervalMs: 0, // Hello 到达后再设置
      reconnectMaxMs: 30_000,
      onMessage: (data) => this.handleFrame(data as Record<string, unknown>),
      onReady: () => this.log("连接已建立"),
      onClose: (code, reason) => this.log(`连接关闭 code=${code} reason=${reason}`),
    })
    this.conn = conn
    await conn.start()
  }

  stop(): void {
    this.conn?.stop()
    this.conn = null
    this.sequence = null
    this.sessionId = null
  }

  /**
   * 处理一个 WS frame
   */
  private handleFrame(frame: Record<string, unknown>): void {
    const op = frame.op as number
    const t = frame.t as string | undefined
    const s = frame.s as number | undefined
    const d = frame.d

    if (typeof s === "number") this.sequence = s

    switch (op) {
      case 0: // Dispatch
        if (t === "READY") {
          const sessionId = (d as Record<string, unknown>)?.session_id as string | undefined
          this.sessionId = sessionId ?? null
          this.log(`READY session=${sessionId}`)
        }
        if (t && this.onDispatch) this.onDispatch(t, d)
        break
      case 1: // Heartbeat（服务端请求，应答）
        this.sendHeartbeat()
        break
      case 7: // Reconnect
        this.log("收到 Reconnect 指令，重新连接")
        this.conn?.stop()
        break
      case 9: // Invalid Session
        this.log("Invalid Session，重新 IDENTIFY")
        this.sendIdentify()
        break
      case 10: {
        // Hello
        const interval = (d as Record<string, unknown>)?.heartbeat_interval as number | undefined
        if (interval) {
          this.log(`Hello: heartbeat_interval=${interval}ms`)
          this.conn?.setHeartbeat(interval, { op: 1, d: this.sequence })
        }
        this.sendIdentify()
        break
      }
      case 11: // Heartbeat ACK
        break
      default:
        this.log(`未知 opcode: ${op}`)
    }
  }

  /**
   * 发送 IDENTIFY 帧（连接鉴权）
   */
  private sendIdentify(): void {
    this.conn?.send({
      op: 2,
      d: {
        token: `QQBot ${this.cfg.token}`,
        intents: 1 << 30, // public_guild_messages AT_MESSAGE_CREATE
        shard: [0, 1],
      },
    })
  }

  private sendHeartbeat(): void {
    this.conn?.send({ op: 1, d: this.sequence })
  }

  private log(msg: string): void {
    console.log(`${this.logPrefix} ${msg}`)
  }
}
