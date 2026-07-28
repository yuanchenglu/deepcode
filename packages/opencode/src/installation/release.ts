import { Product } from "@opencode-ai/core/product"
import { createHash } from "crypto"
import { spawnSync } from "child_process"
import fs from "fs/promises"
import path from "path"
import semver from "semver"

export const ReleaseRepository = "yuanchenglu/deepcode"
export const ReleaseBaseUrl = `https://github.com/${ReleaseRepository}/releases/download`
export const LatestReleaseUrl = `https://api.github.com/repos/${ReleaseRepository}/releases/latest`
export const ReleaseManifestName = "deepcode-manifest.json"
export const ReleaseChecksumsName = "deepcode-checksums.txt"
export const InstallManifestName = "install-manifest.json"

export type SupportedPlatform = "darwin" | "linux" | "windows"
export type SupportedArchitecture = "arm64" | "x64"

export interface ReleaseAsset {
  readonly name: string
  readonly sha256: string
}

export interface ReleaseManifest {
  readonly schema: 1
  readonly product: "deepcode"
  readonly version: string
  readonly assets: readonly ReleaseAsset[]
}

export interface InstallManifest {
  readonly schema: 1
  readonly product: "deepcode"
  readonly version: string
  readonly files: readonly string[]
}

export interface DownloadOptions {
  readonly releaseBaseUrl?: string
  readonly platform?: NodeJS.Platform | SupportedPlatform
  readonly architecture?: string
  readonly fetcher?: typeof fetch
}

export interface UpgradeOptions extends DownloadOptions {
  readonly execPath?: string
  readonly prepareCandidate?: (asset: DownloadedRelease, directory: string) => Promise<string>
  readonly verifyBinary?: (binary: string, version: string) => Promise<void>
  readonly afterReplace?: () => Promise<void>
}

export interface DownloadedRelease {
  readonly manifest: ReleaseManifest
  readonly asset: ReleaseAsset
  readonly bytes: Uint8Array
}

export function normalizeVersion(value: string) {
  const normalized = value.replace(/^v/, "")
  if (!semver.valid(normalized)) throw new Error(`Invalid DeepCode release version: ${value}`)
  return normalized
}

export function platformName(value: NodeJS.Platform | SupportedPlatform = process.platform): SupportedPlatform {
  if (value === "darwin" || value === "linux" || value === "windows") return value
  if (value === "win32") return "windows"
  throw new Error(`DeepCode release does not support platform: ${value}`)
}

export function architectureName(value: string = process.arch): SupportedArchitecture {
  if (value === "arm64" || value === "x64") return value
  throw new Error(`DeepCode release does not support architecture: ${value}`)
}

export function artifactName(
  platform: NodeJS.Platform | SupportedPlatform = process.platform,
  architecture: string = process.arch,
) {
  const os = platformName(platform)
  const arch = architectureName(architecture)
  const extension = os === "linux" ? "tar.gz" : "zip"
  return `${Product.slug}-${os}-${arch}.${extension}`
}

export function releaseUrl(version: string, file: string, baseUrl = ReleaseBaseUrl) {
  return `${baseUrl.replace(/\/$/, "")}/v${normalizeVersion(version)}/${file}`
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

export function parseReleaseManifest(input: string): ReleaseManifest {
  const value: unknown = JSON.parse(input)
  const root = requireRecord(value, "release manifest")
  if (root.schema !== 1) throw new Error("Unsupported DeepCode release manifest schema")
  if (root.product !== Product.slug) throw new Error("Release manifest is not owned by DeepCode")
  if (typeof root.version !== "string") throw new Error("Release manifest version is missing")
  const version = normalizeVersion(root.version)
  if (!Array.isArray(root.assets)) throw new Error("Release manifest assets are missing")

  const names = new Set<string>()
  const assets = root.assets.map((item) => {
    const asset = requireRecord(item, "release asset")
    if (typeof asset.name !== "string" || !asset.name.startsWith(`${Product.slug}-`)) {
      throw new Error("Release manifest contains a non-DeepCode asset")
    }
    if (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(asset.sha256)) {
      throw new Error(`Release manifest contains an invalid checksum for ${asset.name}`)
    }
    if (names.has(asset.name)) throw new Error(`Release manifest contains duplicate asset ${asset.name}`)
    names.add(asset.name)
    return { name: asset.name, sha256: asset.sha256.toLowerCase() }
  })

  return { schema: 1, product: "deepcode", version, assets }
}

export function parseInstallManifest(input: string, execPath: string): InstallManifest {
  const value: unknown = JSON.parse(input)
  const root = requireRecord(value, "install manifest")
  if (root.schema !== 1) throw new Error("Unsupported DeepCode install manifest schema")
  if (root.product !== Product.slug) throw new Error("Install manifest is not owned by DeepCode")
  if (typeof root.version !== "string") throw new Error("Install manifest version is missing")
  const version = normalizeVersion(root.version)
  if (!Array.isArray(root.files)) throw new Error("Install manifest files are missing")

  const files = root.files.map((item) => {
    if (typeof item !== "string" || !isOwnedInstallPath(item, execPath)) {
      throw new Error("Install manifest contains a path outside the verified DeepCode install file set")
    }
    return path.normalize(item)
  })
  if (new Set(files).size !== files.length) throw new Error("Install manifest contains duplicate paths")
  return { schema: 1, product: "deepcode", version, files }
}

export async function latestVersion(fetcher: typeof fetch = fetch, url = LatestReleaseUrl) {
  const response = await fetcher(url, { headers: { accept: "application/vnd.github+json" } })
  if (!response.ok) throw new Error(`DeepCode latest release lookup failed: HTTP ${response.status}`)
  const value: unknown = await response.json()
  const root = requireRecord(value, "latest release")
  if (typeof root.tag_name !== "string") throw new Error("DeepCode latest release tag is missing")
  return normalizeVersion(root.tag_name)
}

export async function downloadVerifiedRelease(version: string, options: DownloadOptions = {}): Promise<DownloadedRelease> {
  const target = normalizeVersion(version)
  const fetcher = options.fetcher ?? fetch
  const name = artifactName(options.platform, options.architecture)
  const manifestResponse = await fetcher(releaseUrl(target, ReleaseManifestName, options.releaseBaseUrl))
  if (!manifestResponse.ok) throw new Error(`DeepCode release manifest download failed: HTTP ${manifestResponse.status}`)
  const manifest = parseReleaseManifest(await manifestResponse.text())
  if (manifest.version !== target) throw new Error(`DeepCode release manifest version mismatch: expected ${target}`)
  const asset = manifest.assets.find((item) => item.name === name)
  if (!asset) throw new Error(`DeepCode release manifest does not contain ${name}`)

  const response = await fetcher(releaseUrl(target, name, options.releaseBaseUrl))
  if (!response.ok) throw new Error(`DeepCode release asset download failed: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = sha256(bytes)
  if (actual !== asset.sha256) throw new Error(`DeepCode release checksum mismatch for ${name}`)
  return { manifest, asset, bytes }
}

export async function upgradeCurl(version: string, options: UpgradeOptions = {}) {
  const target = normalizeVersion(version)
  const execPath = path.resolve(options.execPath ?? process.execPath)
  if (!isOwnedInstallPath(execPath, execPath)) throw new Error(`${execPath} is not a verified DeepCode curl installation`)

  const downloaded = await downloadVerifiedRelease(target, options)
  const directory = await fs.mkdtemp(path.join(path.dirname(execPath), ".deepcode-upgrade-"))
  const prepareCandidate = options.prepareCandidate ?? prepareReleaseCandidate
  const verifyBinary = options.verifyBinary ?? verifyReleaseBinary

  try {
    const candidate = await prepareCandidate(downloaded, directory)
    await replaceBinaryAtomically(execPath, candidate, target, {
      verifyBinary,
      afterReplace: async () => {
        await writeInstallManifest(execPath, target)
        await options.afterReplace?.()
      },
    })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

export async function replaceBinaryAtomically(
  execPath: string,
  candidate: string,
  version: string,
  options: {
    readonly verifyBinary: (binary: string, version: string) => Promise<void>
    readonly afterReplace?: () => Promise<void>
  },
) {
  const backup = `${execPath}.previous`
  await options.verifyBinary(candidate, version)
  await fs.rm(backup, { force: true })
  await fs.rename(execPath, backup)

  try {
    await fs.rename(candidate, execPath)
    await options.verifyBinary(execPath, version)
    await options.afterReplace?.()
  } catch (error) {
    await fs.rm(execPath, { force: true })
    const restoreError = await fs.rename(backup, execPath).catch((cause) => cause)
    if (restoreError instanceof Error) {
      throw new Error(`DeepCode upgrade failed and rollback failed: ${restoreError.message}`, { cause: error })
    }
    throw error
  }
}

export async function readInstallManifest(execPath: string) {
  const file = installManifestPath(execPath)
  const content = await fs.readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null
    throw error
  })
  return content === null ? null : parseInstallManifest(content, execPath)
}

export function installManifestPath(execPath: string) {
  return path.join(path.dirname(path.dirname(path.resolve(execPath))), InstallManifestName)
}

export function ownedInstallFiles(execPath: string) {
  const executable = path.resolve(execPath)
  return [executable, path.resolve(`${executable}.previous`), path.resolve(installManifestPath(executable))]
}

export function isOwnedInstallPath(value: string, execPath: string) {
  const resolved = path.resolve(value)
  const compare = (left: string, right: string) =>
    process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right
  return ownedInstallFiles(execPath).some((candidate) => compare(resolved, candidate))
}

async function prepareReleaseCandidate(downloaded: DownloadedRelease, directory: string) {
  const platform = platformName()
  if (platform === "windows") throw new Error("DeepCode curl upgrades on Windows are not enabled in Alpha")

  const archive = path.join(directory, downloaded.asset.name)
  const extract = path.join(directory, "extract")
  await fs.writeFile(archive, downloaded.bytes)
  await fs.mkdir(extract)
  const command = platform === "linux" ? ["tar", "-xzf", archive, "-C", extract] : ["unzip", "-q", archive, "-d", extract]
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8", timeout: 30_000 })
  if (result.status !== 0) throw new Error(`DeepCode release extraction failed: ${(result.stderr || "").trim()}`)

  const candidate = path.join(extract, Product.cli)
  const stat = await fs.lstat(candidate).catch(() => null)
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error("DeepCode release archive does not contain one native deepcode binary")
  await fs.chmod(candidate, 0o755)
  return candidate
}

async function verifyReleaseBinary(binary: string, version: string) {
  const result = spawnSync(binary, ["--version"], { encoding: "utf8", timeout: 15_000 })
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim()
  if (result.status !== 0) throw new Error(`DeepCode release smoke test failed: ${output}`)
  if (!output.includes(version)) throw new Error(`DeepCode release version mismatch: expected ${version}, received ${output}`)
}

async function writeInstallManifest(execPath: string, version: string) {
  const file = installManifestPath(execPath)
  const manifest: InstallManifest = {
    schema: 1,
    product: "deepcode",
    version,
    files: ownedInstallFiles(execPath),
  }
  const temporary = `${file}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.rename(temporary, file)
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}`)
  return value as Record<string, unknown>
}
