/**
 * 生命周期 / SIGTERM / 404/405 HTTP 分支测试
 */
import { describe, it, expect, afterEach, beforeEach } from "bun:test"
import { Effect } from "effect"
import { startGateway, stopGateway, _setOnSignalHandler, _resetSignalsInstalled } from "../src/lifecycle"
import { FeishuAdapter } from "../src/feishu/adapter"
import { QQAdapter } from "../src/qq/adapter"
import type { FeishuConfig, QQConfig } from "../src/config"

beforeEach(() => { _resetSignalsInstalled() })
afterEach(async () => { _setOnSignalHandler(null); await Effect.runPromise(stopGateway()) })

describe("Lifecycle — HTTP 4xx 分支", () => {
  it("未知路径 /x 返回 404", async () => {
    const g = await Effect.runPromise(startGateway({
      port: 0,
      adapters: [new FeishuAdapter({ enabled: true, appId: "x", appSecret: "y", websocket: false } as FeishuConfig)],
      installSignalHandlers: false,
      handler: null,
    }))
    const res = await fetch(`http://127.0.0.1:${g.port}/x`)
    expect(res.status).toBe(404)
  })

  it("GET /webhook/feishu 返回 405", async () => {
    const g = await Effect.runPromise(startGateway({
      port: 0,
      adapters: [new FeishuAdapter({ enabled: true, appId: "x", appSecret: "y", websocket: false } as FeishuConfig)],
      installSignalHandlers: false,
      handler: null,
    }))
    const res = await fetch(`http://127.0.0.1:${g.port}/webhook/feishu`)
    expect(res.status).toBe(405)
  })

  it("未知平台 /webhook/xxx 返回 404", async () => {
    const g = await Effect.runPromise(startGateway({
      port: 0,
      adapters: [new QQAdapter({ enabled: true, appId: "q", token: "t", clientSecret: "" } as QQConfig)],
      installSignalHandlers: false,
      handler: null,
    }))
    const res = await fetch(`http://127.0.0.1:${g.port}/webhook/discord`, { method: "POST", body: "{}" })
    expect(res.status).toBe(404)
  })

  it("飞书非法 JSON 返回 400", async () => {
    const g = await Effect.runPromise(startGateway({
      port: 0,
      adapters: [new FeishuAdapter({ enabled: true, appId: "x", appSecret: "y", websocket: false } as FeishuConfig)],
      installSignalHandlers: false,
      handler: null,
    }))
    const res = await fetch(`http://127.0.0.1:${g.port}/webhook/feishu`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "not json",
    })
    expect(res.status).toBe(400)
  })
})

describe("Lifecycle — SIGTERM 优雅关停", () => {
  it("SIGTERM 触发后端口关闭", async () => {
    let signalReceived = false
    _setOnSignalHandler(() => { signalReceived = true })
    const g = await Effect.runPromise(startGateway({
      port: 0,
      adapters: [new FeishuAdapter({ enabled: true, appId: "x", appSecret: "y", websocket: false } as FeishuConfig)],
      installSignalHandlers: true,
      handler: null,
    }))
    // 健康检查通过
    expect((await (await fetch(`http://127.0.0.1:${g.port}/health`)).json() as { status: string }).status).toBe("ok")
    // 发送 SIGTERM 到自己
    process.kill(process.pid, "SIGTERM")
    // 等待异步关停（信号处理是异步的）
    await new Promise((r) => setTimeout(r, 300))
    expect(signalReceived).toBe(true)
    // 端口应关闭
    let failed = false
    try { await fetch(`http://127.0.0.1:${g.port}/health`) } catch { failed = true }
    expect(failed).toBe(true)
  }, 10_000)
})
