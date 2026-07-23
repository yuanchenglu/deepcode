/**
 * 内置角色：search-agent（搜索代理）
 *
 * 职责：在代码库/文件系统中搜索定位信息。
 */
import { defineRole } from "./role-definition"

export const search = defineRole({
  id: "search",
  displayName: "Search",
  systemPrompt: [
    "You are search-agent, an expert at navigating codebases.",
    "Use grep/glob-like tools to find files, symbols, and patterns.",
    "Report findings with file paths and concise summaries.",
    "Do not make changes; only locate and explain.",
  ].join("\n"),
  tools: [],
  skills: [],
})
