import type { Argv } from "yargs"
import { confirm, intro, isCancel, log, outro, spinner } from "@clack/prompts"
import { UI } from "../ui"
import { Installation } from "../../installation"
import { Global } from "@opencode-ai/core/global"
import { Product } from "@opencode-ai/core/product"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { Filesystem } from "@/util/filesystem"

interface UninstallArgs {
  purge: boolean
  dryRun: boolean
  force: boolean
}

interface RemovalTargets {
  files: string[]
  purgeDirectories: Array<{ path: string; label: string }>
  shellConfig: string | null
  binary: string | null
}

const shellMarker = `# ${Product.slug}`
const shellPath = `${Product.config.directory}/bin`

export function isDeepCodeBinaryPath(value: string) {
  return Installation.detectMethod(value) === "curl"
}

function isDeepCodeShellPath(value: string) {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^["']|["']$/g, "")
  return normalized === shellPath || normalized.endsWith(`/${shellPath}`)
}

function isDeepCodeShellPathLine(value: string) {
  const normalized = value.trim().replaceAll("\\", "/")
  if (normalized.startsWith("export PATH=")) {
    const assignment = normalized.slice("export PATH=".length).trim().replace(/^["']|["']$/g, "")
    return assignment.split(":").some(isDeepCodeShellPath)
  }
  if (!normalized.startsWith("fish_add_path")) return false
  return normalized.split(/\s+/).slice(1).some(isDeepCodeShellPath)
}

export function hasDeepCodeShellEntry(content: string) {
  return content.split("\n").some((line) => line.trim() === shellMarker || isDeepCodeShellPathLine(line))
}

export function cleanShellConfigContent(content: string) {
  const filtered: string[] = []
  let afterMarker = false

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === shellMarker) {
      afterMarker = true
      continue
    }
    if (afterMarker) {
      afterMarker = false
      if (isDeepCodeShellPathLine(line)) continue
    }
    if (isDeepCodeShellPathLine(line)) continue
    filtered.push(line)
  }

  while (filtered.length > 0 && filtered[filtered.length - 1].trim() === "") filtered.pop()
  return filtered.join("\n") + "\n"
}

export const UninstallCommand = {
  command: "uninstall",
  describe: "uninstall DeepCode while preserving user data by default",
  builder: (yargs: Argv) =>
    yargs
      .option("purge", {
        type: "boolean",
        describe: "also delete DeepCode configuration, sessions, cache, and state",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        describe: "show what would be removed without removing it",
        default: false,
      })
      .option("force", {
        alias: "f",
        type: "boolean",
        describe: "skip confirmation prompts",
        default: false,
      }),

  handler: async (args: UninstallArgs) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    intro(`Uninstall ${Product.name}`)

    const method = await Installation.method()
    log.info(`Installation method: ${method}`)
    const targets = await collectRemovalTargets(args, method)
    await showRemovalSummary(targets, args.purge)

    if (!args.force && !args.dryRun) {
      const approved = await confirm({
        message: `Remove the verified ${Product.name} installation files?`,
        initialValue: false,
      })
      if (!approved || isCancel(approved)) {
        outro("Cancelled")
        return
      }

      if (args.purge) {
        const purgeApproved = await confirm({
          message: "Permanently delete all DeepCode user data listed above?",
          initialValue: false,
        })
        if (!purgeApproved || isCancel(purgeApproved)) {
          outro("Cancelled before purge")
          return
        }
      }
    }

    if (args.dryRun) {
      log.warn("Dry run - no changes made")
      outro("Done")
      return
    }

    await executeUninstall(targets)
    outro("Done")
  },
}

async function collectRemovalTargets(args: UninstallArgs, method: Installation.Method): Promise<RemovalTargets> {
  const curlInstall = method === "curl" && isDeepCodeBinaryPath(process.execPath)
  const manifest = curlInstall ? await Installation.readInstallManifest(process.execPath) : null
  const files = manifest?.files.filter((file) => Installation.isOwnedInstallPath(file, process.execPath)) ?? []
  const purgeDirectories = args.purge
    ? [
        { path: Global.Path.data, label: "Data" },
        { path: Global.Path.cache, label: "Cache" },
        { path: Global.Path.config, label: "Config" },
        { path: Global.Path.state, label: "State" },
      ]
    : []

  return {
    files,
    purgeDirectories,
    shellConfig: curlInstall ? await getShellConfigFile() : null,
    binary: curlInstall ? process.execPath : null,
  }
}

async function showRemovalSummary(targets: RemovalTargets, purge: boolean) {
  log.message("The following manifest-owned DeepCode installation files will be removed:")
  if (targets.files.length === 0) log.warn("  No valid DeepCode install manifest was found; no binary file will be deleted automatically.")
  for (const file of targets.files) log.info(`  ✓ ${shortenPath(file)}`)
  if (targets.shellConfig) log.info(`  ✓ DeepCode PATH entry in ${shortenPath(targets.shellConfig)}`)

  if (!purge) {
    log.info("Configuration, sessions, cache, and state will be preserved. Use --purge to delete them.")
    return
  }

  log.warn("Purge requested. These DeepCode-only user directories will also be deleted:")
  for (const directory of targets.purgeDirectories) {
    const exists = await pathExists(directory.path)
    if (!exists) continue
    log.info(`  ! ${directory.label}: ${shortenPath(directory.path)} (${formatSize(await getDirectorySize(directory.path))})`)
  }
}

async function executeUninstall(targets: RemovalTargets) {
  const progress = spinner()
  const errors: string[] = []

  for (const directory of targets.purgeDirectories) {
    if (!(await pathExists(directory.path))) continue
    progress.start(`Removing DeepCode ${directory.label}...`)
    const error = await fs.rm(directory.path, { recursive: true, force: true }).catch((cause) => cause)
    if (error instanceof Error) {
      progress.stop(`Failed to remove ${directory.label}`, 1)
      errors.push(`${directory.label}: ${error.message}`)
      continue
    }
    progress.stop(`Removed ${directory.label}`)
  }

  if (targets.shellConfig) {
    progress.start("Cleaning DeepCode shell configuration...")
    const error = await cleanShellConfig(targets.shellConfig).catch((cause) => cause)
    if (error instanceof Error) {
      progress.stop("Failed to clean shell config", 1)
      errors.push(`Shell config: ${error.message}`)
    } else {
      progress.stop("Cleaned shell config")
    }
  }

  const orderedFiles = targets.files.toSorted((left, right) => {
    if (left === targets.binary) return 1
    if (right === targets.binary) return -1
    return right.length - left.length
  })
  for (const file of orderedFiles) {
    progress.start(`Removing ${shortenPath(file)}...`)
    const error = await fs.rm(file, { force: true }).catch((cause) => cause)
    if (error instanceof Error) {
      progress.stop(`Failed to remove ${shortenPath(file)}`, 1)
      errors.push(`${shortenPath(file)}: ${error.message}`)
      continue
    }
    progress.stop(`Removed ${shortenPath(file)}`)
  }

  if (targets.binary) {
    await removeEmptyDirectory(path.dirname(targets.binary))
    await removeEmptyDirectory(path.dirname(path.dirname(targets.binary)))
  }

  if (errors.length > 0) {
    UI.empty()
    log.warn("Some operations failed:")
    for (const error of errors) log.error(`  ${error}`)
  }

  UI.empty()
  log.success(`Thank you for using ${Product.name}!`)
}

async function getShellConfigFile(): Promise<string | null> {
  const shell = path.basename(process.env.SHELL || "bash")
  const home = os.homedir()
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config")
  const configFiles: Record<string, string[]> = {
    fish: [path.join(xdgConfig, "fish", "config.fish")],
    zsh: [path.join(home, ".zshrc"), path.join(home, ".zshenv"), path.join(xdgConfig, "zsh", ".zshrc")],
    bash: [path.join(home, ".bashrc"), path.join(home, ".bash_profile"), path.join(home, ".profile")],
    ash: [path.join(home, ".ashrc"), path.join(home, ".profile")],
    sh: [path.join(home, ".profile")],
  }

  for (const file of configFiles[shell] || configFiles.bash) {
    if (!(await pathExists(file))) continue
    const content = await Filesystem.readText(file).catch(() => "")
    if (hasDeepCodeShellEntry(content)) return file
  }
  return null
}

async function cleanShellConfig(file: string) {
  await Filesystem.write(file, cleanShellConfigContent(await Filesystem.readText(file)))
}

async function pathExists(value: string) {
  return fs.access(value).then(
    () => true,
    () => false,
  )
}

async function removeEmptyDirectory(value: string) {
  await fs.rmdir(value).catch(() => undefined)
}

async function getDirectorySize(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return getDirectorySize(full)
      if (!entry.isFile()) return 0
      return fs.stat(full).then(
        (stat) => stat.size,
        () => 0,
      )
    }),
  )
  return sizes.reduce((total, size) => total + size, 0)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function shortenPath(value: string): string {
  const home = os.homedir()
  return value.startsWith(home) ? value.replace(home, "~") : value
}
