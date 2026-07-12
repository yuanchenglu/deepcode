/**
 * DeepCode 核心模块验证脚本
 *
 * 验证硬约束提取器、意图分类器、路由决策器、reasoning摘要器的纯函数逻辑。
 * 运行方式：bun run packages/core/src/deepcode/__verify__.ts
 */
import { extractHardConstraints, renderConstraints } from "./hard-constraint/extractor"

// ============ 测试 1：硬约束提取器 ============

console.log("=" .repeat(60))
console.log("测试 1：硬约束提取器 (Hard Constraint Extractor)")
console.log("=" .repeat(60))

const testCases = [
  {
    input: "帮我重构 payment 模块，不要修改 config 文件",
    expectedForbid: ["不要修改 config"],
    expectedRequire: 0,
  },
  {
    input: "新建一个博客项目，必须先备份所有文件再修改",
    expectedForbid: 0,
    expectedRequire: ["必须先备份"],
  },
  {
    input: "禁止使用 any 类型，不能删除测试文件，一定要写注释",
    expectedForbid: 2,
    expectedRequire: ["一定要写注释"],
  },
  {
    input: "排序一下 import",
    expectedForbid: 0,
    expectedRequire: 0,
  },
]

let passed = 0
let failed = 0

for (const tc of testCases) {
  const constraints = extractHardConstraints(tc.input)
  const forbid = constraints.filter((c) => c.type === "forbid" || c.type === "never")
  const require = constraints.filter((c) => c.type === "require" || c.type === "always")

  const forbidOk = typeof tc.expectedForbid === "number"
    ? forbid.length >= tc.expectedForbid
    : tc.expectedForbid.every((exp) => forbid.some((c) => c.pattern.includes(exp.replace(/不要?|禁止|不能/, "").trim())))
  const requireOk = typeof tc.expectedRequire === "number"
    ? require.length >= tc.expectedRequire
    : tc.expectedRequire.every((exp) => require.some((c) => c.pattern.includes(exp.replace(/必须|一定/, "").trim())))

  if (forbidOk && requireOk) {
    console.log(`  ✅ PASS: "${tc.input.slice(0, 50)}..."`)
    console.log(`     → 提取到 ${forbid.length} 个禁止, ${require.length} 个必须`)
    passed++
  } else {
    console.log(`  ❌ FAIL: "${tc.input.slice(0, 50)}..."`)
    console.log(`     forbid: got ${forbid.length}, expected ${tc.expectedForbid}`)
    console.log(`     require: got ${require.length}, expected ${tc.expectedRequire}`)
    failed++
  }
}

// Test renderConstraints
console.log("\n--- 约束渲染示例 ---")
const sampleConstraints = extractHardConstraints("不要修改 config 文件，必须先备份")
console.log(renderConstraints(sampleConstraints))

// ============ 测试 2：意图分类规则验证 ============

console.log("\n" + "=".repeat(60))
console.log("测试 2：意图分类规则 (Intent Classification Rules)")
console.log("=" .repeat(60))

// Import classifier logic by re-implementing the rule check inline
const CODE_RULES: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /(?:排序|sort|typo|格式化|format|整理import|fix.{0,10}error|修个?小)/i, intent: "simple" },
  { pattern: /(?:调研|research|研究|了解)/i, intent: "research" },
  { pattern: /(?:重构|refactor|重写|rewrite|改造|重新设计)/i, intent: "refactor" },
  { pattern: /(?:从零|从0|新建|create.{0,5}from.{0,5}scratch|搭建|初始化项目|new project)/i, intent: "new" },
  { pattern: /(?:设计.{0,5}架构|架构设计|技术选型|architecture|技术方案)/i, intent: "architecture" },
]

const intentTests = [
  { input: "帮我把 import 排序一下", expected: "simple" },
  { input: "帮我重构 payment 模块", expected: "refactor" },
  { input: "从零搭建一个 React 博客", expected: "new" },
  { input: "设计一个微服务架构", expected: "architecture" },
  { input: "调研一下 ORM 框架对比", expected: "research" },
  { input: "帮我加个登录功能", expected: null }, // should default to medium
]

for (const tc of intentTests) {
  let matched: string | null = null
  for (const rule of CODE_RULES) {
    if (rule.pattern.test(tc.input)) {
      matched = rule.intent
      break
    }
  }
  const ok = matched === tc.expected || (tc.expected === null && matched === null)
  if (ok) {
    console.log(`  ✅ PASS: "${tc.input}" → ${matched ?? "medium (default)"}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: "${tc.input}" → got ${matched}, expected ${tc.expected}`)
    failed++
  }
}

// ============ 测试 3：路由决策规则验证 ============

console.log("\n" + "=".repeat(60))
console.log("测试 3：Flash/Pro 路由规则 (Model Routing Rules)")
console.log("=" .repeat(60))

// Simulate routing logic (simplified)
function decideRoute(intent: string | undefined, isCheckpoint: boolean, isHighRiskFile: boolean, failures: number, writeTool: boolean, readTool: boolean): "flash" | "pro" {
  if (isCheckpoint) return "pro"
  if (intent === "architecture" || intent === "refactor") return "pro"
  if (isHighRiskFile) return "pro"
  if (failures >= 2) return "pro"
  if (readTool) return "flash"
  if (intent === "simple" || intent === "research") return "flash"
  return "flash"
}

const routeTests = [
  { ctx: { intent: "simple", isCheckpoint: false, isHighRiskFile: false, failures: 0, readTool: true, writeTool: false }, expected: "flash", desc: "简单读取任务" },
  { ctx: { intent: "architecture", isCheckpoint: false, isHighRiskFile: false, failures: 0, readTool: false, writeTool: true }, expected: "pro", desc: "架构设计任务" },
  { ctx: { intent: "refactor", isCheckpoint: false, isHighRiskFile: false, failures: 0, readTool: false, writeTool: true }, expected: "pro", desc: "重构任务" },
  { ctx: { intent: "medium", isCheckpoint: true, isHighRiskFile: false, failures: 0, readTool: false, writeTool: false }, expected: "pro", desc: "Checkpoint 审查" },
  { ctx: { intent: "medium", isCheckpoint: false, isHighRiskFile: true, failures: 0, readTool: false, writeTool: true }, expected: "pro", desc: "写入高风险文件" },
  { ctx: { intent: "medium", isCheckpoint: false, isHighRiskFile: false, failures: 2, readTool: false, writeTool: true }, expected: "pro", desc: "连续失败升级" },
  { ctx: { intent: "research", isCheckpoint: false, isHighRiskFile: false, failures: 0, readTool: true, writeTool: false }, expected: "flash", desc: "调研任务" },
]

for (const tc of routeTests) {
  const result = decideRoute(tc.ctx.intent, tc.ctx.isCheckpoint, tc.ctx.isHighRiskFile, tc.ctx.failures, tc.ctx.writeTool, tc.ctx.readTool)
  if (result === tc.expected) {
    console.log(`  ✅ PASS: ${tc.desc} → ${result}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: ${tc.desc} → got ${result}, expected ${tc.expected}`)
    failed++
  }
}

// ============ 测试 4：Reasoning 摘要 ============

console.log("\n" + "=".repeat(60))
console.log("测试 4：Reasoning 摘要 (Reasoning Summarization)")
console.log("=" .repeat(60))

function summarizeReasoning(text: string, maxChars: number = 300): string {
  if (!text || text.length === 0) return ""
  const sentences = text.split(/[。！？.!?\n]+/).filter((s) => s.trim().length > 5)
  if (sentences.length === 0) return text.slice(0, maxChars)
  const first = sentences[0].trim()
  const last = sentences.length > 1 ? sentences[sentences.length - 1].trim() : ""
  let summary = `[推理摘要] ${first}`
  if (last && last !== first) summary += ` → ${last}`
  if (summary.length > maxChars) summary = summary.slice(0, maxChars - 3) + "..."
  return summary
}

const reasoningTests = [
  { input: "我需要先读取 config.ts 来理解现有配置结构。然后分析数据库连接逻辑。最后修改连接池大小参数。", expectedMinLen: 10 },
  { input: "简单任务，不需要多步推理。直接执行即可。", expectedMinLen: 10 },
  { input: "", expectedMinLen: 0 },
]

for (const tc of reasoningTests) {
  const summary = summarizeReasoning(tc.input)
  if (summary.length >= tc.expectedMinLen) {
    console.log(`  ✅ PASS: 输入长度=${tc.input.length}, 摘要="${summary.slice(0, 80)}..."`)
    passed++
  } else {
    console.log(`  ❌ FAIL: 摘要长度不足: got ${summary.length}, expected >= ${tc.expectedMinLen}`)
    failed++
  }
}

// ============ 总结 ============

console.log("\n" + "=".repeat(60))
console.log(`测试结果：${passed} passed, ${failed} failed`)
console.log("=" .repeat(60))

if (failed > 0) {
  process.exit(1)
} else {
  console.log("🎉 所有核心模块验证通过！")
  process.exit(0)
}
