import { AppNodeBuilder } from "../src/effect/app-node-builder"
import { makeRuntime } from "../src/effect/runtime"
import { RipgrepBinary } from "../src/ripgrep/binary"

const { runPromise } = makeRuntime(RipgrepBinary.Service, AppNodeBuilder.build(RipgrepBinary.node))
const filepath = await runPromise((service) => service.filepath)
console.log(filepath)
