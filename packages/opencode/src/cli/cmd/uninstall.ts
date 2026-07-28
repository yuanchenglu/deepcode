import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"
import { Global } from "@opencode-ai/core/global"
import { Product } from "@opencode-ai/core/product"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { Filesystem } from "@/util/filesystem"

interface UninstallArgs {
  keepConfig: boolean
  keepData: boolean
  dryRun: boolean
  force: boolean
}

interface RemovalTargets {
  directories: Array<{ path: string; label: string; keep: boolean }>
  shellConfig: string | null
  binary: string | null
}

const shellMarker = `# ${Product.slug}`
const shellPath = `${Product.config.directory}/bin`

export function isDeepCodeBinaryPath(value: string) {
  const normalized = path.normalize(value).toLowerCase()
  const marker = path.normalize(`${path.sep}${Product.config.directory}${path.sep}bin${path.sep}`).toLowerCase()
  const binary = path.basename(normalized).replace(/\.exe$/i, "")
  return normalized.includes(marker) && binary === Product.cli
}

function isDeepCodeShellPathLine(value: string) {
  const normalized = value.trim().replaceAll("\\", "/")
  if (!normalized.includes(shellPath)) return false
  return normalized.startsWith("export PATH=") || normalized.startsWith("fish_add_path")
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
  describe: "uninstall DeepCode and remove DeepCode-owned files",
  builder: (yargs: Argv) =>
    yargs
      .option("keep-config", {
        alias: "c",
        type: "boolean",
        describe: "keep configuration files",
        default: false,
      })
      .option("keep-data", {
        alias: "d",
        type: "boolean",
        describe: "keep session data and snapshots",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        describe: "show what would be removed without removing",
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
    prompts.intro(`Uninstall ${Product.name}`)

    const method = await Installation.method()
    prompts.log.info(`Installation method: ${method}`)

    const targets = await collectRemovalTargets(args, method)
    await showRemovalSummary(targets)

    if (!args.force && !args.dryRun) {
      const confirm = await prompts.confirm({
        message: `Are you sure you want to uninstall ${Product.name}?`,
        initialValue: false,
      })
      if (!confirm || prompts.isCancel(confirm)) {
        prompts.outro("Cancelled")
        return
      }
    }

    if (args.dryRun) {
      prompts.log.warn("Dry run - no changes made")
      prompts.outro("Done")
      return
    }

    await executeUninstall(targets)
    prompts.outro("Done")
  },
}

async function collectRemovalTargets(args: UninstallArgs, method: Installation.Method): Promise<RemovalTargets> {
  const directories: RemovalTargets["directories"] = [
    { path: Global.Path.data, label: "Data", keep: args.keepData },
    { path: Global.Path.cache, label: "Cache", keep: false },
    { path: Global.Path.config, label: "Config", keep: args.keepConfig },
    { path: Global.Path.state, label: "State", keep: false },
  ]

  const curlInstall = method === "curl" && isDeepCodeBinaryPath(process.execPath)
  const shellConfig = curlInstall ? await getShellConfigFile() : null
  const binary = curlInstall ? process.execPath : null

  return { directories, shellConfig, binary }
}

async function showRemovalSummary(targets: RemovalTargets) {
  prompts.log.message("The following DeepCode-owned targets will be removed:")

  for (const dir of targets.directories) {
    const exists = await fs
      .access(dir.path)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    const size = await getDirectorySize(dir.path)
    const sizeStr = formatSize(size)
    const status = dir.keep ? UI.Style.TEXT_DIM + "(keeping)" : ""
    const prefix = dir.keep ? "○" : "✓"

    prompts.log.info(`  ${prefix} ${dir.label}: ${shortenPath(dir.path)} ${UI.Style.TEXT_DIM}(${sizeStr})${status}`)
  }

  if (targets.binary) prompts.log.info(`  ✓ Binary: ${shortenPath(targets.binary)}`)
  if (targets.shellConfig) prompts.log.info(`  ✓ Shell PATH in ${shortenPath(targets.shellConfig)}`)
}

async function executeUninstall(targets: RemovalTargets) {
  const spinner = prompts.spinner()
  const errors: string[] = []

  for (const dir of targets.directories) {
    if (dir.keep) {
      prompts.log.step(`Skipping ${dir.label} (--keep-${dir.label.toLowerCase()})`)
      continue
    }

    const exists = await fs
      .access(dir.path)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    spinner.start(`Removing ${dir.label}...`)
    const err = await fs.rm(dir.path, { recursive: true, force: true }).catch((error) => error)
    if (err) {
      spinner.stop(`Failed to remove ${dir.label}`, 1)
      errors.push(`${dir.label}: ${err.message}`)
      continue
    }
    spinner.stop(`Removed ${dir.label}`)
  }

  if (targets.shellConfig) {
    spinner.start("Cleaning DeepCode shell configuration...")
    const err = await cleanShellConfig(targets.shellConfig).catch((error) => error)
    if (err) {
      spinner.stop("Failed to clean shell config", 1)
      errors.push(`Shell config: ${err.message}`)
    } else {
      spinner.stop("Cleaned shell config")
    }
  }

  if (targets.binary) {
    UI.empty()
    prompts.log.message("To finish removing the DeepCode binary, remove:")
    prompts.log.info(`  ${targets.binary}`)

    const binDir = path.dirname(targets.binary)
    if (path.basename(binDir) === "bin" && path.basename(path.dirname(binDir)) === Product.config.directory) {
      prompts.log.info(`  Empty directory after removal: ${binDir}`)
    }
  }

  if (errors.length > 0) {
    UI.empty()
    prompts.log.warn("Some operations failed:")
    for (const err of errors) prompts.log.error(`  ${err}`)
  }

  UI.empty()
  prompts.log.success(`Thank you for using ${Product.name}!`)
}

async function getShellConfigFile(): Promise<string | null> {
  const shell = path.basename(process.env.SHELL || "bash")
  const home = os.homedir()
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config")

  const configFiles: Record<string, string[]> = {
    fish: [path.join(xdgConfig, "fish", "config.fish")],
    zsh: [
      path.join(home, ".zshrc"),
      path.join(home, ".zshenv"),
      path.join(xdgConfig, "zsh", ".zshrc"),
      path.join(xdgConfig, "zsh", ".zshenv"),
    ],
    bash: [
      path.join(home, ".bashrc"),
      path.join(home, ".bash_profile"),
      path.join(home, ".profile"),
      path.join(xdgConfig, "bash", ".bashrc"),
      path.join(xdgConfig, "bash", ".bash_profile"),
    ],
    ash: [path.join(home, ".ashrc"), path.join(home, ".profile")],
    sh: [path.join(home, ".profile")],
  }

  const candidates = configFiles[shell] || configFiles.bash

  for (const file of candidates) {
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    const content = await Filesystem.readText(file).catch(() => "")
    if (hasDeepCodeShellEntry(content)) return file
  }

  return null
}

async function cleanShellConfig(file: string) {
  const content = await Filesystem.readText(file)
  await Filesystem.write(file, cleanShellConfigContent(content))
}

async function getDirectorySize(dir: string): Promise<number> {
  let total = 0

  const walk = async (current: string) => {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (entry.isFile()) {
        const stat = await fs.stat(full).catch(() => null)
        if (stat) total += stat.size
      }
    }
  }

  await walk(dir)
  return total
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function shortenPath(value: string): string {
  const home = os.homedir()
  if (value.startsWith(home)) return value.replace(home, "~")
  return value
}
