/**
 * MemoryStore — 会话记忆存储。
 *
 * 维护多会话的消息列表，可绑定一个 MemoryPersistence 用于落盘。
 * 所有 append 操作会触发异步持久化（不阻塞调用方；失败仅记录日志）。
 */

import type { Message, MessageRole, MemoryStoreLike } from "../types"
import type { MemoryPersistence } from "./persistence"

/** MemoryStore 构造参数。 */
export interface MemoryStoreOptions {
  /** 持久化实现；不传则只在内存保存。 */
  persistence?: MemoryPersistence
  /** 可选日志器。 */
  logger?: { warn: (m: string) => void }
}

/** 单会话记忆快照。 */
export interface SessionSnapshot {
  sessionId: string
  messages: Message[]
}

export class MemoryStore implements MemoryStoreLike {
  private readonly sessions = new Map<string, Message[]>()
  private readonly persistence?: MemoryPersistence
  private readonly logger?: { warn: (m: string) => void }

  constructor(opts: MemoryStoreOptions = {}) {
    this.persistence = opts.persistence
    this.logger = opts.logger
  }

  /** 确保会话存在（若已从持久化加载则不覆盖）。 */
  private ensure(sessionId: string): Message[] {
    let list = this.sessions.get(sessionId)
    if (!list) {
      list = []
      this.sessions.set(sessionId, list)
    }
    return list
  }

  /**
   * 从持久化层懒加载一个会话。
   * 已经在内存中的会话不重新加载（避免覆盖运行时改动）。
   */
  async hydrate(sessionId: string): Promise<Message[]> {
    const existing = this.sessions.get(sessionId)
    if (existing && existing.length > 0) return existing
    if (!this.persistence) return this.ensure(sessionId)
    const data = await this.persistence.load(sessionId)
    const list = this.ensure(sessionId)
    if (data) {
      // 避免重复 hydrate 追加
      list.length = 0
      list.push(...data.messages)
    }
    return list
  }

  /** 追加一条消息。 */
  append(sessionId: string, message: Message): void {
    const list = this.ensure(sessionId)
    list.push(message)
    void this.flush(sessionId)
  }

  /** 批量追加消息（减少持久化次数）。 */
  appendMany(sessionId: string, messages: Message[]): void {
    const list = this.ensure(sessionId)
    list.push(...messages)
    void this.flush(sessionId)
  }

  /** 替换为完整消息列表（用于重置或导入）。 */
  setAll(sessionId: string, messages: Message[]): void {
    this.sessions.set(sessionId, [...messages])
    void this.flush(sessionId)
  }

  /** 获取会话所有消息。 */
  all(sessionId: string): Message[] {
    return [...this.ensure(sessionId)]
  }

  /** 获取最后 N 条消息（用于窗口化构造 prompt）。 */
  lastN(sessionId: string, n: number): Message[] {
    const list = this.ensure(sessionId)
    if (n <= 0) return []
    return list.slice(-n)
  }

  /** 按角色过滤。 */
  byRole(sessionId: string, role: MessageRole): Message[] {
    return this.ensure(sessionId).filter((m) => m.role === role)
  }

  /** 清空一个会话。 */
  clear(sessionId: string): void {
    this.sessions.delete(sessionId)
    void this.flush(sessionId, true)
  }

  /** 列出所有已知会话 ID。 */
  sessionIds(): string[] {
    return [...this.sessions.keys()]
  }

  /** 立即把会话刷写到持久化层。 */
  async flush(sessionId: string, clearing = false): Promise<void> {
    if (!this.persistence) return
    try {
      if (clearing) {
        // 清空语义：写一个空记录覆盖
        await this.persistence.save({
          sessionId,
          messages: [],
          updatedAt: new Date().toISOString(),
        })
      } else {
        await this.persistence.save({
          sessionId,
          messages: this.ensure(sessionId),
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      this.logger?.warn(`memory flush 失败: ${(err as Error).message}`)
    }
  }
}
