import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient } from "effect/unstable/http"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Npm } from "@opencode-ai/core/npm"
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { Account } from "@/account/account"
import { Env } from "@/env"
import { AuthTest } from "../fake/auth"
import { AccountTest } from "../fake/account"
import { NpmTest } from "../fake/npm"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import path from "path"

const unexpectedHttp = HttpClient.make((request) =>
  Effect.die(`unexpected http request: ${request.method} ${request.url}`),
)

const layer = LayerNode.compile(LayerNode.group([Config.node, FSUtil.node, Env.node, CrossSpawnSpawner.node]), [
  [Auth.node, AuthTest.empty],
  [Account.node, AccountTest.empty],
  [Npm.node, NpmTest.noop],
  [httpClient, Layer.succeed(HttpClient.HttpClient, unexpectedHttp)],
])

const it = testEffect(layer)

const write = (directory: string, name: string, username: string) =>
  FSUtil.use.writeWithDirs(path.join(directory, name), JSON.stringify({ username }))

it.instance("does not load an OpenCode-only project configuration", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* write(test.directory, "opencode.json", "opencode-only")

    const config = yield* Config.use.get()
    expect(config.username).not.toBe("opencode-only")
  }),
)

it.instance("loads DeepCode configuration when both products coexist", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* Effect.all([
      write(test.directory, "opencode.json", "opencode-user"),
      write(test.directory, "deepcode.json", "deepcode-user"),
    ])

    const config = yield* Config.use.get()
    expect(config.username).toBe("deepcode-user")
  }),
)
