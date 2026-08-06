/**
 * Delegation 协调模块出口
 */
export {
  inheritPermissions,
  validateWorkspace,
  detectWriteConflicts,
} from "./delegation"
export type {
  DelegationPermission,
  SubTask,
  ConflictDetection,
} from "./delegation"
