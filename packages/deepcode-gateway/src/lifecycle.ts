/**
 * DeepCode 消息网关 — 生命周期管理
 *
 * 负责网关的启动、停止和消息队列编排。
 *
 * @module
 */

import { Effect, Queue, Scope } from "effect"
import type { PlatformAdapter } from "./adapter"
import type { GatewayMessage } from "./message"
import { Router } from "./router"
import { startServer, stopServer } from "./server"
import { startMessageConsumer } from "./session-bridge"
import type { GatewayError } from "./error"

/** 已注册的平台适配器 */
const adapters = new Map<string, PlatformAdapter>()
/** 全局消息队列 */
let mq: Queue.Queue<GatewayMessage> | null = null

/**
 * 注册平台适配器
 */
export function registerAdapter(adapter: PlatformAdapter): void {
  adapters.set(adapter.name, adapter)
}

/**
 * 启动网关
 *
 * 流程：
 * 1. 创建无界消息队列
 * 2. 初始化路由，为每个适配器注册 webhook 路径
 * 3. 启动所有适配器
 * 4. 启动 HTTP Server 开始监听 webhook
 * 5. 启动消息消费循环（后台 Fiber）
 */
export function startGateway(port: number = 3099): Effect.Effect<void, GatewayError, Scope.Scope> {
  return Effect.gen(function* () {
    // 1. 创建消息队列
    mq = yield* Queue.unbounded<GatewayMessage>()

    // 2. 初始化路由，为每个适配器注册路径
    const router = new Router()
    for (const [name] of adapters) {
      router.register(
        { path: `/webhook/${name}`, platform: name as "feishu" | "wechat" },
        mq,
      )
    }

    // 3. 启动所有适配器
    for (const a of adapters.values()) {
      yield* a.start()
    }

    // 4. 启动 HTTP Server
    yield* startServer(port, router)

    // 5. 启动消息消费循环（后台 Fiber，需要 Scope）
    const replyAdapter = adapters.values().next().value
    if (replyAdapter && mq) {
      const workdir = process.cwd()
      // forkScoped: 在当前 Scope 下启动后台 Fiber，Scope 关闭时自动终止
      yield* Effect.forkScoped(
        startMessageConsumer(mq, replyAdapter, workdir).pipe(
          // ignore: 静默吞掉所有错误，避免后台 Fiber 因未捕获异常而崩溃
          Effect.ignore,
        ),
      )
    }
  })
}

/**
 * 停止网关
 *
 * 流程：
 * 1. 停止 HTTP Server
 * 2. 停止所有适配器
 * 3. 清空消息队列
 */
export function stopGateway(): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* stopServer()
    for (const a of adapters.values()) {
      yield* a.stop()
    }
    adapters.clear()
    mq = null
  })
}

/**
 * 获取消息队列引用（用于调试/测试）
 */
export function getMessageQueue(): Queue.Queue<GatewayMessage> | null {
  return mq
}
