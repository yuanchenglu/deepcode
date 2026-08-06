/**
 * Delegation / Subagent 协调模块（S2-05）
 *
 * 纯逻辑层：定义 parent/child 关系、权限继承（只能缩小）、
 * 冲突检测、并发上限。不依赖 LLM/Host，便于 Contract 测试。
 *
 * 设计依据 PLAN S2-05 执行步骤：
 * 1. parent/child Session、Agent ID、任务 ID、Workspace、Permission、Evidence 继承规则
 * 3. 子 Agent 只能缩小权限，不能扩大 parent 权限；跨 Workspace 必须重新授权
 * 4. 并行修改同一文件时必须检测冲突并交回协调者
 */

/** 权限规则（对齐 Host Permission 格式） */
export interface DelegationPermission {
  action: string
  resource: string
  effect: "allow" | "ask" | "deny"
}

/** 子任务定义 */
export interface SubTask {
  /** 子任务唯一 ID */
  id: string
  /** 父会话 ID */
  parentSession: string
  /** 子会话 ID（执行子任务的新会话） */
  childSession: string
  /** 执行 agent ID */
  agentID: string
  /** 任务描述 */
  description: string
  /** 子任务工作目录（必须等于或位于父工作目录内） */
  workspace: string
  /** 继承后的权限（已按"只能缩小"规则计算） */
  permissions: DelegationPermission[]
  /** 状态 */
  status: "pending" | "running" | "done" | "failed" | "cancelled"
}

/** 冲突检测结果 */
export interface ConflictDetection {
  conflict: boolean
  /** 冲突的文件路径 */
  files: string[]
  /** 建议：交回协调者合并，不允许后写覆盖 */
  resolution: "merge-back" | "none"
}

/**
 * 计算子任务的继承权限。
 *
 * 规则：子 Agent 只能缩小权限，不能扩大。
 * - parent deny 的资源 → 子任务保持 deny
 * - parent ask/allow → 子任务默认降级为 ask（更保守）；除非显式 allowOverride
 * - 未知 action → 保持 parent 原样（不扩大）
 *
 * @param parentPermissions - 父会话权限
 * @param childOverrides - 子任务显式覆盖（可选，只能进一步收紧）
 */
export function inheritPermissions(
  parentPermissions: DelegationPermission[],
  childOverrides: DelegationPermission[] = [],
): DelegationPermission[] {
  const inherited = parentPermissions.map((p) =>
    p.effect === "allow" ? { ...p, effect: "ask" as const } : { ...p },
  )
  for (const override of childOverrides) {
    const idx = inherited.findIndex(
      (p) => p.action === override.action && p.resource === override.resource,
    )
    if (idx === -1) {
      // 新增规则：只允许 deny（收紧），不允许 allow（扩大）
      if (override.effect === "deny") inherited.push({ ...override })
      continue
    }
    // 合并：取更严格者（deny > ask > allow）
    const rank = { deny: 3, ask: 2, allow: 1 } as const
    const current = inherited[idx]
    if (rank[override.effect] >= rank[current.effect]) inherited[idx] = { ...override }
  }
  return inherited
}

/**
 * 校验子任务工作目录合法性。
 *
 * 规则：子 Agent 的 workspace 必须位于父 workspace 之内（跨 Workspace 必须重新授权）。
 *
 * @param parentWorkspace - 父工作目录（绝对路径）
 * @param childWorkspace  - 子任务工作目录
 * @returns 合法返回 true；非法返回 false
 */
export function validateWorkspace(parentWorkspace: string, childWorkspace: string): boolean {
  if (childWorkspace === parentWorkspace) return true
  return childWorkspace.startsWith(parentWorkspace.endsWith("/") ? parentWorkspace : parentWorkspace + "/")
}

/**
 * 检测并行子任务的文件写入冲突。
 *
 * 规则：并行修改同一文件时必须检测冲突并交回协调者，不能后写覆盖。
 *
 * @param writes - 各子任务计划写入的文件集合 { taskID, files }
 * @returns 冲突任务对与冲突文件
 */
export function detectWriteConflicts(
  writes: Array<{ taskID: string; files: string[] }>,
): ConflictDetection {
  const seen = new Map<string, string[]>()
  const conflicts = new Set<string>()
  for (const w of writes) {
    for (const f of w.files) {
      const owners = seen.get(f)
      if (owners) {
        conflicts.add(f)
        owners.push(w.taskID)
      } else {
        seen.set(f, [w.taskID])
      }
    }
  }
  return {
    conflict: conflicts.size > 0,
    files: [...conflicts],
    resolution: conflicts.size > 0 ? "merge-back" : "none",
  }
}
