import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Effect, Layer, Schema, Context } from "effect"
import { serviceUse } from "@opencode-ai/core/effect/service-use"
import path from "path"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import semver from "semver"
import { InstallationChannel, InstallationVersion } from "@opencode-ai/core/installation/version"
import { Product } from "@opencode-ai/core/product"
import { InstallationEvent } from "@opencode-ai/schema/installation-event"
import { latestVersion, upgradeCurl } from "./release"

export type Method = "curl" | "npm" | "yarn" | "pnpm" | "bun" | "brew" | "scoop" | "choco" | "unknown"

export type ReleaseType = "patch" | "minor" | "major"

export const Event = InstallationEvent

export function getReleaseType(current: string, latest: string): ReleaseType {
  const currMajor = semver.major(current)
  const currMinor = semver.minor(current)
  const newMajor = semver.major(latest)
  const newMinor = semver.minor(latest)

  if (newMajor > currMajor) return "major"
  if (newMinor > currMinor) return "minor"
  return "patch"
}

export const Info = Schema.Struct({
  version: Schema.String,
  latest: Schema.String,
}).annotate({ identifier: "InstallationInfo" })
export type Info = Schema.Schema.Type<typeof Info>

export function userAgent(client = "cli") {
  return `${Product.slug}/${InstallationChannel}/${InstallationVersion}/${client}`
}

export const USER_AGENT = userAgent()

export function isPreview() {
  return InstallationChannel !== "latest"
}

export function isLocal() {
  return InstallationChannel === "local"
}

export function detectMethod(execPath: string): Method {
  const normalized = path.normalize(execPath)
  const compare = (value: string, expected: string) =>
    process.platform === "win32" ? value.toLowerCase() === expected.toLowerCase() : value === expected
  const basename = path.basename(normalized)
  const binary = process.platform === "win32" ? basename.replace(/\.exe$/i, "") : basename
  const bin = path.dirname(normalized)
  const install = path.dirname(bin)
  const exactDirectory = compare(path.basename(bin), "bin")
  const exactNamespace = compare(path.basename(install), Product.config.directory)
  return exactDirectory && exactNamespace && compare(binary, Product.cli) ? "curl" : "unknown"
}

export class UpgradeFailedError extends Schema.TaggedErrorClass<UpgradeFailedError>()("UpgradeFailedError", {
  stderr: Schema.String,
}) {
  override get message() {
    return this.stderr
  }
}

export interface Interface {
  readonly info: () => Effect.Effect<Info>
  readonly method: () => Effect.Effect<Method>
  readonly latest: (method?: Method) => Effect.Effect<string>
  readonly upgrade: (method: Method, target: string) => Effect.Effect<void, UpgradeFailedError>
}

// The service tag remains internal compatibility vocabulary until the package namespace migration.
export class Service extends Context.Service<Service, Interface>()("@opencode/Installation") {}

export const use = serviceUse(Service)

const service: Interface = {
  info: Effect.fn("Installation.info")(function* () {
    return {
      version: InstallationVersion,
      latest: InstallationVersion,
    }
  }),
  method: Effect.fn("Installation.method")(function* () {
    return detectMethod(process.execPath)
  }),
  latest: Effect.fn("Installation.latest")(function* (method: Method = "curl") {
    if (method !== "curl") return InstallationVersion
    return yield* Effect.tryPromise({
      try: () => latestVersion(),
      catch: () => InstallationVersion,
    }).pipe(Effect.catchAll((version) => Effect.succeed(version)))
  }),
  upgrade: Effect.fn("Installation.upgrade")(function* (method: Method, target: string) {
    if (method !== "curl") {
      return yield* new UpgradeFailedError({
        stderr: `DeepCode ${method} upgrades are disabled in Alpha. Install through the verified GitHub Release/curl channel.`,
      })
    }

    return yield* Effect.tryPromise({
      try: () => upgradeCurl(target),
      catch: (error) =>
        new UpgradeFailedError({
          stderr: error instanceof Error ? error.message : String(error),
        }),
    })
  }),
}

const layer: Layer.Layer<Service> = Layer.succeed(Service, Service.of(service))

export const node = LayerNode.make({ service: Service, layer, deps: [] })

const { runPromise } = makeRuntime(Service, AppNodeBuilder.build(node))

export const latest = (...args: Parameters<Interface["latest"]>) => runPromise((s) => s.latest(...args))
export const method = () => runPromise((s) => s.method())
export const upgrade = (...args: Parameters<Interface["upgrade"]>) => runPromise((s) => s.upgrade(...args))

export {
  ReleaseRepository,
  ReleaseBaseUrl,
  ReleaseManifestName,
  ReleaseChecksumsName,
  InstallManifestName,
  normalizeVersion,
  platformName,
  architectureName,
  artifactName,
  releaseUrl,
  sha256,
  parseReleaseManifest,
  parseInstallManifest,
  latestVersion,
  downloadVerifiedRelease,
  upgradeCurl,
  replaceBinaryAtomically,
  readInstallManifest,
  installManifestPath,
  isOwnedInstallPath,
} from "./release"

export * as Installation from "."