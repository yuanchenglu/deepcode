/**
 * SkillManager + skill-loader 单元测试。
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SkillManager, parseSkillMarkdown, parseSkillFromDir, scanSkillDirs, toSkill } from "../src/skill"
import { ToolRegistry } from "../src/tool"
import { SkillFormatError, SkillDirectoryNotFoundError, AlreadyRegisteredError } from "../src/errors"
import type { Tool } from "../src/types"

const addTool: Tool = {
  name: "add",
  description: "add two numbers",
  parameters: {
    type: "object",
    properties: { a: { type: "number" }, b: { type: "number" } },
    required: ["a", "b"],
  },
  async execute({ a, b }) {
    return { sum: (a as number) + (b as number) }
  },
}

describe("parseSkillMarkdown", () => {
  test("合法 frontmatter 返回 name/description/triggers", () => {
    const md = `---\nname: foo\ndescription: desc foo\ntriggers: a, b, c\n---\n# Body`
    const p = parseSkillMarkdown(md)
    expect(p.name).toBe("foo")
    expect(p.description).toBe("desc foo")
    expect(p.triggers).toEqual(["a", "b", "c"])
    expect(p.body).toBe("# Body")
  })

  test("缺 name 抛 SkillFormatError", () => {
    const md = `---\ndescription: x\n---\nbody`
    expect(() => parseSkillMarkdown(md)).toThrow(SkillFormatError)
  })

  test("缺 description 抛 SkillFormatError", () => {
    const md = `---\nname: x\n---\nbody`
    expect(() => parseSkillMarkdown(md)).toThrow(SkillFormatError)
  })

  test("不以 --- 开头抛 SkillFormatError", () => {
    expect(() => parseSkillMarkdown("name: x\ndescription: y")).toThrow(SkillFormatError)
  })

  test("无 triggers 时为 undefined", () => {
    const md = `---\nname: x\ndescription: y\n---\nb`
    expect(parseSkillMarkdown(md).triggers).toBeUndefined()
  })
})

describe("parseSkillFromDir", () => {
  test("加载真实目录中的 SKILL.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "da-skill-"))
    writeFileSync(join(dir, "SKILL.md"), "---\nname: real\ndescription: real-desc\n---\nbody")
    const p = parseSkillFromDir(dir)
    expect(p.name).toBe("real")
    expect(p.dir).toBe(dir)
  })

  test("不存在的目录抛 SkillDirectoryNotFoundError", () => {
    expect(() => parseSkillFromDir("/nonexistent/deep-agent/xxx")).toThrow(SkillDirectoryNotFoundError)
  })

  test("目录无 SKILL.md 抛 SkillFormatError", () => {
    const dir = mkdtempSync(join(tmpdir(), "da-skill-"))
    expect(() => parseSkillFromDir(dir)).toThrow(SkillFormatError)
  })
})

describe("scanSkillDirs", () => {
  test("扫描根目录下的子目录，跳过无 SKILL.md 与 broken", () => {
    const root = mkdtempSync(join(tmpdir(), "da-scan-"))
    mkdirSync(join(root, "good"))
    writeFileSync(join(root, "good", "SKILL.md"), "---\nname: good\ndescription: g\n---\n")
    mkdirSync(join(root, "empty"))
    mkdirSync(join(root, "bad"))
    writeFileSync(join(root, "bad", "SKILL.md"), "no frontmatter")
    const found = scanSkillDirs([root])
    expect(found).toHaveLength(1)
    expect(found[0]!.name).toBe("good")
  })
})

describe("SkillManager", () => {
  test("load 注册技能工具到 registry", async () => {
    const registry = new ToolRegistry()
    const mgr = new SkillManager({ registry })
    const skill = toSkill(parseSkillMarkdown("---\nname: s1\ndescription: d1\n---\nbody"), [addTool])
    await mgr.load(skill)
    expect(mgr.get("s1")).toBeDefined()
    expect(registry.has("add")).toBe(true)
  })

  test("unload 注销工具并调用 onUnload", async () => {
    const registry = new ToolRegistry()
    let unloaded = false
    const mgr = new SkillManager({ registry })
    await mgr.load({
      name: "s1",
      description: "d",
      tools: [addTool],
      onUnload: () => {
        unloaded = true
      },
    })
    expect(await mgr.unload("s1")).toBe(true)
    expect(registry.has("add")).toBe(false)
    expect(unloaded).toBe(true)
  })

  test("重复 load 同名技能抛 AlreadyRegisteredError", async () => {
    const mgr = new SkillManager()
    await mgr.load({ name: "s1", description: "d" })
    await expect(mgr.load({ name: "s1", description: "d2" })).rejects.toThrow(AlreadyRegisteredError)
  })

  test("loadFromDir 加载磁盘技能", async () => {
    const dir = mkdtempSync(join(tmpdir(), "da-skill-"))
    writeFileSync(join(dir, "SKILL.md"), "---\nname: disk\ndescription: from disk\n---\nbody")
    const mgr = new SkillManager()
    const loaded = await mgr.loadFromDir(dir)
    expect(loaded.name).toBe("disk")
    expect(loaded.sourceDir).toBe(dir)
  })

  test("loadAllFromRoots 收集错误但不中断", async () => {
    const root = mkdtempSync(join(tmpdir(), "da-scan-"))
    mkdirSync(join(root, "good"))
    writeFileSync(join(root, "good", "SKILL.md"), "---\nname: good\ndescription: g\n---\n")
    mkdirSync(join(root, "bad"))
    writeFileSync(join(root, "bad", "SKILL.md"), "no frontmatter")
    const mgr = new SkillManager({ roots: [root] })
    const { loaded, errors } = await mgr.loadAllFromRoots()
    expect(loaded).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  test("discover 返回可解析技能列表", () => {
    const root = mkdtempSync(join(tmpdir(), "da-scan-"))
    mkdirSync(join(root, "good"))
    writeFileSync(join(root, "good", "SKILL.md"), "---\nname: good\ndescription: g\n---\n")
    const mgr = new SkillManager({ roots: [root] })
    expect(mgr.discover()).toHaveLength(1)
  })

  test("list 返回所有已加载技能", async () => {
    const mgr = new SkillManager()
    await mgr.load({ name: "a", description: "da" })
    await mgr.load({ name: "b", description: "db" })
    expect(mgr.list().map((s) => s.name)).toEqual(["a", "b"])
  })
})
