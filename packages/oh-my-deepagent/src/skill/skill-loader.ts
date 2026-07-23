/**
 * 技能加载器。
 *
 * 从磁盘读取 SKILL.md，解析 YAML-like frontmatter，生成 Skill 对象。
 * frontmatter 采用极简 YAML 子集（name / description / triggers 三个字段），
 * 避免引入 js-yaml 依赖。
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { SkillDirectoryNotFoundError, SkillFormatError } from "../errors"
import type { Skill, Tool } from "../types"

/** 解析后的技能元数据。 */
export interface ParsedSkill {
  name: string
  description: string
  triggers?: string[]
  /** SKILL.md body（frontmatter 之后的 markdown 正文）。 */
  body: string
  /** SKILL.md 所在目录。 */
  dir: string
}

/**
 * 从目录加载单个 SKILL.md 文件并解析。
 *
 * @param skillDir - 包含 SKILL.md 的目录绝对路径。
 * @returns 解析后的技能元数据。
 */
export function parseSkillFromDir(skillDir: string): ParsedSkill {
  const abs = resolve(skillDir)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new SkillDirectoryNotFoundError(abs)
  }
  const skillFile = join(abs, "SKILL.md")
  if (!existsSync(skillFile)) {
    throw new SkillFormatError(skillFile, "缺少 SKILL.md 文件")
  }
  const raw = readFileSync(skillFile, "utf-8")
  return parseSkillMarkdown(raw, abs)
}

/**
 * 解析 SKILL.md 文本。要求以 `---` 开头，包含 name 和 description 字段。
 *
 * 本函数不依赖 YAML 库，支持以下语法：
 *   name: code-review
 *   description: 审查代码质量
 *   triggers: review, audit, check
 */
export function parseSkillMarkdown(raw: string, dir = "<memory>"): ParsedSkill {
  const lines = raw.split(/\r?\n/)
  if (lines[0]?.trim() !== "---") {
    throw new SkillFormatError(`${dir}/SKILL.md`, "必须以 --- frontmatter 开头")
  }
  const meta: Record<string, string> = {}
  let i = 1
  for (; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === "---") {
      i++
      break
    }
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    meta[m[1]!] = m[2]!.trim()
  }
  const body = lines.slice(i).join("\n").trim()
  const name = meta["name"]
  const description = meta["description"]
  if (!name) throw new SkillFormatError(`${dir}/SKILL.md`, "frontmatter 缺少 name")
  if (!description) throw new SkillFormatError(`${dir}/SKILL.md`, "frontmatter 缺少 description")
  const triggersRaw = meta["triggers"]
  const triggers = triggersRaw
    ? triggersRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined
  return { name, description, triggers, body, dir }
}

/**
 * 扫描根目录下所有子目录，把每个含 SKILL.md 的子目录当作一个技能加载。
 *
 * @param roots - 一组目录路径；每个目录的直接子目录被视为技能目录。
 * @returns 解析出的技能元数据数组（不包括工具，工具由调用方注入）。
 */
export function scanSkillDirs(roots: string[]): ParsedSkill[] {
  const out: ParsedSkill[] = []
  for (const root of roots) {
    const abs = resolve(root)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillDir = join(abs, entry.name)
      if (!existsSync(join(skillDir, "SKILL.md"))) continue
      try {
        out.push(parseSkillFromDir(skillDir))
      } catch {
        // 跳过非法技能（单个技能失败不影响整体扫描）
      }
    }
  }
  return out
}

/**
 * 将 ParsedSkill 转换为运行时 Skill 对象。
 *
 * @param parsed - 解析结果。
 * @param extraTools - 该技能提供的额外工具（通常由技能编写者在 JS/TS 中导出）。
 */
export function toSkill(parsed: ParsedSkill, extraTools: Tool[] = []): Skill {
  return {
    name: parsed.name,
    description: parsed.description,
    triggers: parsed.triggers,
    tools: extraTools,
  }
}
