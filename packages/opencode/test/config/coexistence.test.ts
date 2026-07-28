import { expect } from "bun:test"
import path from "path"
import { Effect, Layer } from "effect"
import { HttpClient } from "effect/unstable/http"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Npm } from "@opencode-ai/core/npm"
import { Config } from "@/config/config"
import { Env } from "@/env"
import { Auth } from "@/auth"
import { Account } from "@/account/account"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { AuthTest } from "../fake/auth"
import { AccountTest } from "../fake/account"
import { NpmTest } from "../fake/npm"

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

const writeJson = (file: string, value: object) =>
  FSUtil.use.writeWithDirs(file, JSON.stringify({ $schema: "https://opencode.ai/config.json", ...value }))

function withProcessEnvs<A, E, R>(entries: Record<string, string | undefined>, effect: Effect.Effect<A, E, R>) {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const originals: Record<string, string | undefined> = {}
      for (const [key, value] of Object.entries(entries)) {
        originals[key] = process.env[key]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      return originals
    }),
    () => effect,
    (originals) =>
      Effect.sync(() => {
        for (const [key, value] of Object.entries(originals)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }),
  )
}

it.instance("loads a DeepCode-only project configuration", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeJson(path.join(test.directory, "deepcode.json"), { username: "deepcode-only" })

    expect((yield* Config.use.get()).username).toBe("deepcode-only")
  }),
)

it.instance("ignores OpenCode root configuration files", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeJson(path.join(test.directory, "opencode.json"), { username: "opencode-json" })
    yield* writeJson(path.join(test.directory, "opencode.jsonc"), { username: "opencode-jsonc" })

    const config = yield* Config.use.get()
    expect(config.username).not.toBe("opencode-json")
    expect(config.username).not.toBe("opencode-jsonc")
  }),
)

it.instance("loads only DeepCode configuration when both products coexist", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeJson(path.join(test.directory, "opencode.json"), { username: "opencode-user" })
    yield* writeJson(path.join(test.directory, "deepcode.json"), { username: "deepcode-user" })

    expect((yield* Config.use.get()).username).toBe("deepcode-user")
  }),
)

it.instance("ignores configuration under .opencode", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeJson(path.join(test.directory, ".opencode", "deepcode.json"), { username: "opencode-dir" })
    yield* writeJson(path.join(test.directory, ".opencode", "opencode.json"), { username: "opencode-file" })

    const config = yield* Config.use.get()
    expect(config.username).not.toBe("opencode-dir")
    expect(config.username).not.toBe("opencode-file")
  }),
)

it.instance("ignores OPENCODE_CONFIG_DIR and still loads project config", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    const foreign = path.join(test.directory, "foreign-config")
    yield* writeJson(path.join(foreign, "deepcode.json"), { username: "opencode-env" })
    yield* writeJson(path.join(test.directory, "deepcode.json"), { username: "project-deepcode" })

    yield* withProcessEnvs(
      {
        OPENCODE_CONFIG_DIR: foreign,
        DEEPCODE_CONFIG_DIR: undefined,
      },
      Effect.gen(function* () {
        expect((yield* Config.use.get()).username).toBe("project-deepcode")
      }),
    )
  }),
)

it.instance("loads DEEPCODE_CONFIG_DIR without reading OPENCODE_CONFIG_DIR", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    const deepcode = path.join(test.directory, "deepcode-config")
    const opencode = path.join(test.directory, "opencode-config")
    yield* writeJson(path.join(deepcode, "deepcode.json"), { username: "deepcode-env" })
    yield* writeJson(path.join(opencode, "deepcode.json"), { username: "opencode-env" })

    yield* withProcessEnvs(
      {
        DEEPCODE_CONFIG_DIR: deepcode,
        OPENCODE_CONFIG_DIR: opencode,
      },
      Effect.gen(function* () {
        expect((yield* Config.use.get()).username).toBe("deepcode-env")
      }),
    )
  }),
)

it.instance("ignores OPENCODE_DISABLE_PROJECT_CONFIG", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeJson(path.join(test.directory, "deepcode.json"), { username: "project-enabled" })

    yield* withProcessEnvs(
      {
        OPENCODE_DISABLE_PROJECT_CONFIG: "true",
        DEEPCODE_DISABLE_PROJECT_CONFIG: undefined,
      },
      Effect.gen(function* () {
        expect((yield* Config.use.get()).username).toBe("project-enabled")
      }),
    )
  }),
)

it.instance("honors DEEPCODE_DISABLE_PROJECT_CONFIG", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeJson(path.join(test.directory, "deepcode.json"), { username: "project-disabled" })

    yield* withProcessEnvs(
      {
        DEEPCODE_DISABLE_PROJECT_CONFIG: "true",
        OPENCODE_DISABLE_PROJECT_CONFIG: undefined,
      },
      Effect.gen(function* () {
        expect((yield* Config.use.get()).username).not.toBe("project-disabled")
      }),
    )
  }),
)
