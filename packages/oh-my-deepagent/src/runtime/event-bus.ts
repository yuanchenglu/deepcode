/**
 * 轻量事件总线
 *
 * 功能：实现 Runtime 的生命周期钩子（on/off/emit）。
 * 不依赖 Node events 模块，保持 Bun/Node/Deno 兼容。
 */

export type EventHandler = (...args: unknown[]) => void

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>()

  /**
   * 注册事件监听
   * @param event   事件名
   * @param handler 回调
   * @returns       取消订阅函数
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  /**
   * 触发事件（异步等待所有 handler 完成）
   */
  async emit(event: string, ...args: unknown[]): Promise<void> {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const h of Array.from(handlers)) {
      try {
        await h(...args)
      } catch (e) {
        // 监听器异常不应中断主流程
        console.error(`[event-bus] handler for "${event}" threw:`, e)
      }
    }
  }

  /** 判断某事件是否有订阅者 */
  hasListeners(event: string): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0
  }
}
