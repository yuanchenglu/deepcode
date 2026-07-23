/**
 * InProcessTransport — 同进程函数调用传输。
 *
 * 直接持有 AgentRuntime 引用，将 ChatRequestEnvelope 转发给 runtime.chat()。
 * 适合同一 Bun/Node 进程内嵌入使用（如插件、CLI、测试）。
 */

import type { AgentRuntime } from "../runtime/agent-runtime"
import type { ChatRequestEnvelope, ChatResponseEnvelope } from "./envelope"

/** InProcessTransport 构造参数。 */
export interface InProcessTransportOptions {
  /** AgentRuntime 实例。 */
  runtime: AgentRuntime
}

export class InProcessTransport {
  private readonly runtime: AgentRuntime

  constructor(opts: InProcessTransportOptions) {
    this.runtime = opts.runtime
  }

  /**
   * 发送一条消息并等待完整响应。
   * @param req - 请求信封。
   * @returns 响应信封。
   */
  async send(req: ChatRequestEnvelope): Promise<ChatResponseEnvelope> {
    const start = Date.now()
    // 使用 withSession 绑定到指定 sessionId
    const sessionRuntime = this.runtime.withSession(req.sessionId)
    const result = await sessionRuntime.chat(req.content)
    return {
      text: result.text,
      toolCalls: result.toolCalls,
      stoppedReason: result.stoppedReason,
      sessionId: req.sessionId,
      durationMs: Date.now() - start,
    }
  }

  /** 获取底层 runtime（便于高级用法）。 */
  getRuntime(): AgentRuntime {
    return this.runtime
  }
}
