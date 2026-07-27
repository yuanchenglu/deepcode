import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Database } from "@opencode-ai/core/database/database"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Global } from "@opencode-ai/core/global"

describe("global paths", () => {
  test("tmp path is under the system temp directory", () => {
    expect(Global.Path.tmp).toBe(path.join(os.tmpdir(), "deepcode"))
    expect(Global.make().tmp).toBe(Global.Path.tmp)
  })

  test("tmp path is created on module load", async () => {
    expect((await fs.stat(Global.Path.tmp)).isDirectory()).toBe(true)
  })

  test("persistent paths use the DeepCode namespace", () => {
    expect(path.basename(Global.Path.data)).toBe("deepcode")
    expect(path.basename(Global.Path.cache)).toBe("deepcode")
    expect(path.basename(Global.Path.config)).toBe("deepcode")
    expect(path.basename(Global.Path.state)).toBe("deepcode")
  })

  test("home override ignores the OpenCode environment", () => {
    const deepcode = process.env.DEEPCODE_TEST_HOME
    const opencode = process.env.OPENCODE_TEST_HOME
    process.env.DEEPCODE_TEST_HOME = "/tmp/deepcode-home"
    process.env.OPENCODE_TEST_HOME = "/tmp/opencode-home"

    try {
      expect(Global.Path.home).toBe("/tmp/deepcode-home")
    } finally {
      if (deepcode === undefined) delete process.env.DEEPCODE_TEST_HOME
      else process.env.DEEPCODE_TEST_HOME = deepcode
      if (opencode === undefined) delete process.env.OPENCODE_TEST_HOME
      else process.env.OPENCODE_TEST_HOME = opencode
    }
  })

  test("flag getters prefer DeepCode variables and ignore OpenCode variables", () => {
    const deepcode = process.env.DEEPCODE_CONFIG_DIR
    const opencode = process.env.OPENCODE_CONFIG_DIR
    process.env.DEEPCODE_CONFIG_DIR = "/tmp/deepcode-config"
    process.env.OPENCODE_CONFIG_DIR = "/tmp/opencode-config"

    try {
      expect(Flag.OPENCODE_CONFIG_DIR).toBe("/tmp/deepcode-config")
    } finally {
      if (deepcode === undefined) delete process.env.DEEPCODE_CONFIG_DIR
      else process.env.DEEPCODE_CONFIG_DIR = deepcode
      if (opencode === undefined) delete process.env.OPENCODE_CONFIG_DIR
      else process.env.OPENCODE_CONFIG_DIR = opencode
    }
  })

  test("database filename uses the DeepCode namespace", () => {
    const database = Flag.OPENCODE_DB
    Flag.OPENCODE_DB = undefined
    try {
      expect(path.basename(Database.path())).toMatch(/^deepcode(?:-[a-zA-Z0-9._-]+)?\.db$/)
    } finally {
      Flag.OPENCODE_DB = database
    }
  })
})
