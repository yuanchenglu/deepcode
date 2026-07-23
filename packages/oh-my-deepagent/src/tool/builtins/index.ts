/**
 * 内置工具统一出口。
 */

export { echoTool } from "./echo"
export { calculatorTool } from "./calculator"
export { nowTool, createNowTool } from "./time"
export { createPlanReader } from "./plan-reader"

import { echoTool } from "./echo"
import { calculatorTool } from "./calculator"
import { nowTool } from "./time"
import type { Tool } from "../../types"

/** 全部默认内置工具（不含 plan-reader，因为它需要绑定 Plan 引用）。 */
export const builtinTools: Tool[] = [echoTool, calculatorTool, nowTool]
