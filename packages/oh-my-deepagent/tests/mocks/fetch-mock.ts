/**
 * Mock fetch 工厂。
 *
 * 用于 LLM 适配器测试。可脚本化返回多个 Response，并记录每次请求。
 */

/** Mock fetch 调用记录。 */
export interface FetchCall {
  url: string
  options: RequestInit
  bodyJson: unknown
}

/** 脚本步骤：返回值或函数。 */
export type MockStep = Response | ((call: FetchCall) => Response | Promise<Response>)

/**
 * 创建一个可脚本化的 fetch 实现。
 *
 * @param script - 按顺序返回的响应列表；超出后返回 500。
 * @returns 包含 fetch 函数和 calls 记录的对象。
 */
export function createMockFetch(script: MockStep[]): {
  fetch: typeof globalThis.fetch
  calls: FetchCall[]
} {
  const calls: FetchCall[] = []
  let cursor = 0
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const options = (init ?? {}) as RequestInit
    let bodyJson: unknown = undefined
    if (options.body && typeof options.body === "string") {
      try {
        bodyJson = JSON.parse(options.body)
      } catch {
        bodyJson = options.body
      }
    }
    const call: FetchCall = { url, options, bodyJson }
    calls.push(call)
    const step = script[cursor]
    cursor++
    if (!step) {
      return new Response("no more scripted responses", { status: 500 })
    }
    return typeof step === "function" ? await step(call) : step
  }) as unknown as typeof globalThis.fetch
  return { fetch: fetchImpl, calls }
}

/** 构造一个 JSON Response。 */
export function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}
