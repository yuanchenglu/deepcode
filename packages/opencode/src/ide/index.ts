import { Schema } from "effect"
import { NamedError } from "@opencode-ai/core/util/error"
import { IdeEvent } from "@opencode-ai/schema/ide-event"

const SUPPORTED_IDES = [
  { name: "Windsurf" as const, cmd: "windsurf" },
  { name: "Visual Studio Code - Insiders" as const, cmd: "code-insiders" },
  { name: "Visual Studio Code" as const, cmd: "code" },
  { name: "Cursor" as const, cmd: "cursor" },
  { name: "VSCodium" as const, cmd: "codium" },
]

export const Event = IdeEvent

export const AlreadyInstalledError = NamedError.create("AlreadyInstalledError", {})

export const InstallFailedError = NamedError.create("InstallFailedError", {
  stderr: Schema.String,
})

export function ide() {
  if (process.env["TERM_PROGRAM"] === "vscode") {
    const v = process.env["GIT_ASKPASS"]
    for (const ide of SUPPORTED_IDES) {
      if (v?.includes(ide.name)) return ide.name
    }
  }
  return "unknown"
}

export function alreadyInstalled() {
  return process.env["DEEPCODE_CALLER"] === "vscode" || process.env["DEEPCODE_CALLER"] === "vscode-insiders"
}

export async function install(ide: (typeof SUPPORTED_IDES)[number]["name"]) {
  const cmd = SUPPORTED_IDES.find((item) => item.name === ide)?.cmd
  if (!cmd) throw new Error(`Unknown IDE: ${ide}`)
  throw new InstallFailedError({
    stderr: "DeepCode IDE extension installation is unavailable until a verified DeepCode extension channel exists",
  })
}

export * as Ide from "."
