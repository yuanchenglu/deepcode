import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createHash } from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { migrateTuiConfig } from "@/config/tui-migrate"

let root = ""
let project = ""
let globalConfig = ""
let originalGlobalConfig = ""

async function writeJson(file: string, value: object) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value, null, 2))
}

async function exists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function treeHash(directory: string) {
  const hash = createHash("sha256")

  async function walk(current: string, relative = "") {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const nextRelative = path.posix.join(relative.replaceAll("\\", "/"), entry.name)
      const full = path.join(current, entry.name)
      hash.update(`${entry.isDirectory() ? "d" : "f"}:${nextRelative}\n`)
      if (entry.isDirectory()) await walk(full, nextRelative)
      else hash.update(await fs.readFile(full))
    }
  }

  await walk(directory)
  return hash.digest("hex")
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "deepcode-tui-coexistence-"))
  project = path.join(root, "project")
  globalConfig = path.join(root, "global")
  await fs.mkdir(project, { recursive: true })
  await fs.mkdir(globalConfig, { recursive: true })
  originalGlobalConfig = Global.Path.config
  ;(Global.Path as { config: string }).config = globalConfig
})

afterEach(async () => {
  ;(Global.Path as { config: string }).config = originalGlobalConfig
  await fs.rm(root, { recursive: true, force: true })
})

describe("TUI migration coexistence", () => {
  test("does not read or modify OpenCode configuration", async () => {
    const opencodeDir = path.join(project, ".opencode")
    await writeJson(path.join(project, "opencode.json"), {
      theme: "opencode-root",
      tui: { scroll_speed: 4 },
    })
    await writeJson(path.join(opencodeDir, "opencode.json"), {
      theme: "opencode-directory",
      tui: { diff_style: "stacked" },
    })

    const before = await treeHash(project)
    await migrateTuiConfig({ cwd: project, directories: [path.join(project, ".deepcode")] })
    const after = await treeHash(project)

    expect(after).toBe(before)
    expect(await exists(path.join(project, "tui.json"))).toBe(false)
    expect(await exists(path.join(project, "opencode.json.tui-migration.bak"))).toBe(false)
    expect(await exists(path.join(opencodeDir, "tui.json"))).toBe(false)
  })

  test("migrates DeepCode config and preserves coexisting OpenCode config byte-for-byte", async () => {
    const opencode = path.join(project, "opencode.json")
    const deepcode = path.join(project, "deepcode.json")
    await writeJson(opencode, {
      theme: "opencode-theme",
      tui: { scroll_speed: 9 },
      username: "opencode-user",
    })
    await writeJson(deepcode, {
      theme: "deepcode-theme",
      tui: { scroll_speed: 3, diff_style: "stacked" },
      username: "deepcode-user",
    })
    const opencodeBefore = await fs.readFile(opencode)

    await migrateTuiConfig({ cwd: project, directories: [path.join(project, ".deepcode")] })

    expect(await fs.readFile(opencode)).toEqual(opencodeBefore)
    expect(await exists(`${opencode}.tui-migration.bak`)).toBe(false)
    expect(await exists(`${deepcode}.tui-migration.bak`)).toBe(true)
    expect(JSON.parse(await fs.readFile(path.join(project, "tui.json"), "utf8"))).toMatchObject({
      theme: "deepcode-theme",
      scroll_speed: 3,
      diff_style: "stacked",
    })
    expect(JSON.parse(await fs.readFile(deepcode, "utf8"))).toEqual({ username: "deepcode-user" })
  })

  test("migrates .deepcode config without touching .opencode tree", async () => {
    const deepcodeDir = path.join(project, ".deepcode")
    const opencodeDir = path.join(project, ".opencode")
    await writeJson(path.join(deepcodeDir, "deepcode.json"), {
      theme: "deepcode-local",
      tui: { scroll_speed: 2 },
    })
    await writeJson(path.join(opencodeDir, "opencode.json"), {
      theme: "opencode-local",
      tui: { scroll_speed: 8 },
    })
    const opencodeBefore = await treeHash(opencodeDir)

    await migrateTuiConfig({ cwd: project, directories: [deepcodeDir] })

    expect(await treeHash(opencodeDir)).toBe(opencodeBefore)
    expect(JSON.parse(await fs.readFile(path.join(deepcodeDir, "tui.json"), "utf8"))).toMatchObject({
      theme: "deepcode-local",
      scroll_speed: 2,
    })
    expect(await exists(path.join(opencodeDir, "tui.json"))).toBe(false)
  })
})
