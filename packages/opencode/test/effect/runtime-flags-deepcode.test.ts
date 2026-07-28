import { describe, expect } from "bun:test"
import { ConfigProvider, Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { it } from "../lib/effect"

const fromConfig = (input: Record<string, unknown>) =>
  AppNodeBuilder.build(RuntimeFlags.node).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(input))))

const readFlags = RuntimeFlags.Service.useSync((flags) => flags)

describe("DeepCode RuntimeFlags namespace", () => {
  it.effect("reads DEEPCODE runtime variables", () =>
    Effect.gen(function* () {
      const flags = yield* readFlags.pipe(
        Effect.provide(
          fromConfig({
            DEEPCODE_PURE: "true",
            DEEPCODE_AUTO_SHARE: "true",
            DEEPCODE_DISABLE_DEFAULT_PLUGINS: "true",
            DEEPCODE_EXPERIMENTAL: "true",
            DEEPCODE_EXPERIMENTAL_ICON_DISCOVERY: "false",
            DEEPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: "4096",
            DEEPCODE_CLIENT: "desktop",
          }),
        ),
      )

      expect(flags.pure).toBe(true)
      expect(flags.autoShare).toBe(true)
      expect(flags.disableDefaultPlugins).toBe(true)
      expect(flags.experimentalReferences).toBe(true)
      expect(flags.experimentalIconDiscovery).toBe(false)
      expect(flags.outputTokenMax).toBe(4096)
      expect(flags.client).toBe("desktop")
    }),
  )

  it.effect("ignores OPENCODE runtime variables", () =>
    Effect.gen(function* () {
      const flags = yield* readFlags.pipe(
        Effect.provide(
          fromConfig({
            OPENCODE_PURE: "true",
            OPENCODE_AUTO_SHARE: "true",
            OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
            OPENCODE_EXPERIMENTAL: "true",
            OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: "4096",
            OPENCODE_CLIENT: "desktop",
          }),
        ),
      )

      expect(flags.pure).toBe(false)
      expect(flags.autoShare).toBe(false)
      expect(flags.disableDefaultPlugins).toBe(false)
      expect(flags.experimentalReferences).toBe(false)
      expect(flags.outputTokenMax).toBeUndefined()
      expect(flags.client).toBe("cli")
    }),
  )

  it.effect("prefers DEEPCODE values when both namespaces are present", () =>
    Effect.gen(function* () {
      const flags = yield* readFlags.pipe(
        Effect.provide(
          fromConfig({
            OPENCODE_PURE: "true",
            OPENCODE_CLIENT: "opencode-client",
            DEEPCODE_PURE: "false",
            DEEPCODE_CLIENT: "deepcode-client",
          }),
        ),
      )

      expect(flags.pure).toBe(false)
      expect(flags.client).toBe("deepcode-client")
    }),
  )
})
