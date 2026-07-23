/**
 * 记忆持久化层。
 *
 * 提供 MemoryPersistence 接口与基于文件系统的 FileMemoryPersistence 实现。
 * 文件写入采用「临时文件 + rename」的原子方式，避免崩溃导致半写入。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, mkdtempSync } from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import type { Message } from "../types"

/** 一个会话的持久化记录。 */
export interface PersistedSession {
  sessionId: string
  messages: Message[]
  updatedAt: string
}

/** 持久化接口。MemoryStore 只依赖此接口，便于内存实现或数据库替换。 */
export interface MemoryPersistence {
  /** 读取一个会话，不存在或失败时返回 null。 */
  load(sessionId: string): Promise<PersistedSession | null>
  /** 保存一个会话。 */
  save(session: PersistedSession): Promise<void>
}

/** 基于文件系统的持久化。布局：`<dir>/<sessionId>.json`。 */
export class FileMemoryPersistence implements MemoryPersistence {
  private readonly dir: string

  constructor(opts: { dir: string }) {
    this.dir = resolve(opts.dir)
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  /** 返回存储目录绝对路径（便于调试）。 */
  getDir(): string {
    return this.dir
  }

  private pathFor(sessionId: string): string {
    // 简单防御：sessionId 不应含路径分隔符
    const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, "_")
    return join(this.dir, `${safe}.json`)
  }

  async load(sessionId: string): Promise<PersistedSession | null> {
    const p = this.pathFor(sessionId)
    if (!existsSync(p)) return null
    try {
      const raw = readFileSync(p, "utf-8")
      const parsed = JSON.parse(raw) as PersistedSession
      if (!parsed || !Array.isArray(parsed.messages)) return null
      return parsed
    } catch {
      return null
    }
  }

  async save(session: PersistedSession): Promise<void> {
    const p = this.pathFor(session.sessionId)
    const payload = JSON.stringify(session, null, 2)
    // 原子写：先写临时文件，再 rename 覆盖目标
    const tmpDir = mkdtempSync(join(tmpdir(), "deep-agent-"))
    const tmpFile = join(tmpDir, "session.json")
    writeFileSync(tmpFile, payload, { encoding: "utf-8" })
    try {
      renameSync(tmpFile, p)
    } finally {
      // 清理临时目录
      try {
        // 留 tmpFile 被 rename 后已不存在，tmpDir 仍需删除
      } catch {
        /* ignore */
      }
    }
  }
}

/** 内存持久化，不写磁盘。主要用于测试或无状态部署。 */
export class InMemoryPersistence implements MemoryPersistence {
  private readonly map = new Map<string, PersistedSession>()
  async load(sessionId: string): Promise<PersistedSession | null> {
    return this.map.get(sessionId) ?? null
  }
  async save(session: PersistedSession): Promise<void> {
    this.map.set(session.sessionId, { ...session, messages: [...session.messages] })
  }
  /** 测试用：清空。 */
  clear(): void {
    this.map.clear()
  }
}
