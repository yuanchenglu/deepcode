/**
 * DeepCode Harness — Review切换防漂移（论文 I-07）
 *
 * Review切换防漂移模块。
 * 完整实现参考 docs/deepcode/raptor-reference/review-anti-drift.ts
 *
 * TODO(Raptor): 完整实现——需要使用 Context.Service + Layer.effect 模式重写
 *
 * @module
 */

import { Effect, Layer } from "effect"
import { makeLocationNode } from "../effect/app-node"

/** 占位层：模块注册后无实质功能，等待完整适配 */
const layer = Layer.effectDiscard(Effect.logInfo("DeepCode review-anti-drift module loaded (stub)"));

export const node = makeLocationNode({
  name: "deepcode-review-anti-drift",
  layer,
  deps: [],
})
