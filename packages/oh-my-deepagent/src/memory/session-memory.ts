/**
 * SessionMemory — 面向单会话的便捷门面。
 *
 * 包装 MemoryStore，绑定固定 sessionId，省去每次传入 sessionId 的重复。
 */

import type { Message, MessageRole } from "../types"
import { MemoryStore } from "./memory-store"

export class SessionMemory {
  private readonly store: MemoryStore
  readonly sessionId: string

  constructor(store: MemoryStore, sessionId: string) {
    this.store = store
    this.sessionId = sessionId
  }

  /** 从持久化层加载历史。 */
  async hydrate(): Promise<Message[]> {
    return this.store.hydrate(this.sessionId)
  }

  /** 追加一条消息。 */
  append(message: Message): void {
    this.store.append(this.sessionId, message)
  }

  /** 批量追加。 */
  appendMany(messages: Message[]): void {
    this.store.appendMany(this.sessionId, messages)
  }

  /** 全部消息。 */
  all(): Message[] {
    return this.store.all(this.sessionId)
  }

  /** 最后 N 条。 */
  lastN(n: number): Message[] {
    return this.store.lastN(this.sessionId, n)
  }

  /** 按角色过滤。 */
  byRole(role: MessageRole): Message[] {
    return this.store.byRole(this.sessionId, role)
  }

  /** 清空。 */
  clear(): void {
    this.store.clear(this.sessionId)
  }

  /** 立即刷盘。 */
  async flush(): Promise<void> {
    await this.store.flush(this.sessionId)
  }
}
