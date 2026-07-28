import { describe, expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Effect } from "effect"
import path from "path"
import { Installation } from "../../src/installation"
import { testEffect } from "../lib/effect"

const layer = LayerNode.compile(Installation.node, [])

describe("installation", () => {
  test("uses the DeepCode user-agent identity", () => {
    const userAgent = Installation.userAgent("test")
    expect(userAgent.startsWith("deepcode/")).toBe(true)
    expect(userAgent).not.toContain("opencode")
  })

  describe("method detection", () => {
    test("recognizes only the exact DeepCode curl installation directory and binary", () => {
      expect(Installation.detectMethod(path.join("home", "user", ".deepcode", "bin", "deepcode"))).toBe("curl")
      expect(Installation.detectMethod(path.join("home", "user", ".deepcode", "bin", "deepcode.exe"))).toBe("curl")
    })

    test("does not inherit OpenCode, generic local, nested, or wrong-binary installations", () => {
      expect(Installation.detectMethod(path.join("home", "user", ".opencode", "bin", "opencode"))).toBe("unknown")
      expect(Installation.detectMethod(path.join("home", "user", ".deepcode", "bin", "opencode"))).toBe("unknown")
      expect(Installation.detectMethod(path.join("home", "user", ".deepcode", "bin", "nested", "deepcode"))).toBe(
        "unknown",
      )
      expect(Installation.detectMethod(path.join("home", "user", ".deepcode", "bin-backup", "deepcode"))).toBe(
        "unknown",
      )
      expect(Installation.detectMethod(path.join("home", "user", ".local", "bin", "deepcode"))).toBe("unknown")
      expect(Installation.detectMethod(path.join("usr", "local", "bin", "opencode"))).toBe("unknown")
    })

    test("uses native case sensitivity for installation paths", () => {
      const value = Installation.detectMethod(path.join("home", "user", ".DeepCode", "bin", "DeepCode"))
      expect(value).toBe(process.platform === "win32" ? "curl" : "unknown")
    })
  })

  describe("release lookup", () => {
    testEffect(layer).effect("returns the installed version without contacting an upstream channel", () =>
      Effect.gen(function* () {
        const methods: Installation.Method[] = ["curl", "npm", "yarn", "pnpm", "bun", "brew", "scoop", "choco", "unknown"]
        for (const method of methods) {
          expect(yield* Installation.use.latest(method)).toBe(InstallationVersion)
        }

        expect(yield* Installation.use.info()).toEqual({
          version: InstallationVersion,
          latest: InstallationVersion,
        })
      }),
    )
  })

  describe("upgrade", () => {
    for (const method of ["curl", "npm", "yarn", "pnpm", "bun", "brew", "scoop", "choco", "unknown"] as const) {
      testEffect(layer).effect(`rejects ${method} without executing an upstream installer`, () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Installation.use.upgrade(method, "9.9.9"))
          expect(error).toBeInstanceOf(Installation.UpgradeFailedError)
          expect(error.message).toBe(error.stderr)
          expect(error.stderr).toContain("DeepCode upgrade is disabled")
          expect(error.stderr).toContain(`method: ${method}`)
          expect(error.stderr).not.toContain("opencode.ai")
          expect(error.stderr).not.toContain("anomalyco")
        }),
      )
    }
  })
})
