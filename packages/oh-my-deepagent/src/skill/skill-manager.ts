/**
 * 技能管理器。
 *
 * 负责 Skill 对象的加载、卸载、列举、查找，并在加载时把技能提供的工具注册到
 * ToolRegistry，卸载时一并注销，保证注册表的一致性。
 */

import type { LoadedSkill, Skill, ToolRegistryLike } from "../types"
import { AlreadyRegisteredError } from "../errors"
import { existsSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseSkillFromDir, scanSkillDirs, toSkill, type ParsedSkill } from "./skill-loader"

/** SkillManager 构造参数。 */
export interface SkillManagerOptions {
  /** 工具注册表（技能加载/卸载时会注册/注销工具）。 */
  registry?: ToolRegistryLike & { register?(t: unknown): unknown; unregister?(n: string): boolean }
  /** 额外目录根；会在构造时立即扫描并懒加载（不自动 load，需要显式 load）。 */
  roots?: string[]
}

export class SkillManager {
  private readonly loaded = new Map<string, LoadedSkill>()
  private readonly registry: SkillManagerOptions["registry"]
  private readonly roots: string[]

  constructor(opts: SkillManagerOptions = {}) {
    this.registry = opts.registry
    this.roots = opts.roots ? [...opts.roots] : []
  }

  /** 列举已加载的技能。 */
  list(): LoadedSkill[] {
    return [...this.loaded.values()]
  }

  /** 按名获取已加载技能。 */
  get(name: string): LoadedSkill | undefined {
    return this.loaded.get(name)
  }

  /**
   * 扫描构造时传入的 roots 目录，返回可加载技能列表（但不实际加载）。
   * 便于上层预览或按名筛选。
   */
  discover(): ParsedSkill[] {
    return scanSkillDirs(this.roots)
  }

  /**
   * 加载一个已经构造好的 Skill 对象。
   * @throws AlreadyRegisteredError 同名技能已加载。
   */
  async load(skill: Skill): Promise<LoadedSkill> {
    if (this.loaded.has(skill.name)) {
      throw new AlreadyRegisteredError("技能", skill.name)
    }
    // 注册技能提供的工具
    if (skill.tools && this.registry && typeof this.registry.register === "function") {
      for (const t of skill.tools) {
        ;(this.registry as { register: (t: unknown) => unknown }).register(t)
      }
    }
    if (skill.onLoad) await skill.onLoad()
    const loaded: LoadedSkill = { ...skill }
    this.loaded.set(skill.name, loaded)
    return loaded
  }

  /**
   * 从目录加载技能。
   * @param skillDir - 包含 SKILL.md 的目录。
   * @param extraTools - 技能提供的工具（可选）。
   */
  async loadFromDir(skillDir: string, extraTools?: Skill["tools"]): Promise<LoadedSkill> {
    const parsed = parseSkillFromDir(skillDir)
    const skill = toSkill(parsed, extraTools ?? [])
    const loaded = await this.load(skill)
    loaded.sourceDir = parsed.dir
    return loaded
  }

  /**
   * 从 roots 批量加载所有可发现技能。
   * 失败的技能会收集到错误列表中，不影响其他技能加载。
   * @returns 成功加载的技能列表。
   */
  async loadAllFromRoots(): Promise<{ loaded: LoadedSkill[]; errors: string[] }> {
    const loaded: LoadedSkill[] = []
    const errors: string[] = []
    for (const root of this.roots) {
      const abs = resolve(root)
      if (!existsSync(abs)) continue
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const skillDir = join(abs, entry.name)
        let parsed: ParsedSkill
        try {
          parsed = parseSkillFromDir(skillDir)
        } catch (err) {
          errors.push(`${entry.name}: ${(err as Error).message}`)
          continue
        }
        try {
          const s = toSkill(parsed, [])
          const l = await this.load(s)
          l.sourceDir = parsed.dir
          loaded.push(l)
        } catch (err) {
          errors.push(`${parsed.name}: ${(err as Error).message}`)
        }
      }
    }
    return { loaded, errors }
  }

  /**
   * 卸载一个技能。
   * @returns 是否成功卸载（未加载时返回 false）。
   */
  async unload(name: string): Promise<boolean> {
    const skill = this.loaded.get(name)
    if (!skill) return false
    if (skill.tools && this.registry && typeof this.registry.unregister === "function") {
      for (const t of skill.tools) {
        ;(this.registry as { unregister: (n: string) => boolean }).unregister(t.name)
      }
    }
    if (skill.onUnload) await skill.onUnload()
    this.loaded.delete(name)
    return true
  }

  /** 清空所有已加载技能。 */
  async unloadAll(): Promise<void> {
    for (const name of [...this.loaded.keys()]) {
      await this.unload(name)
    }
  }
}
