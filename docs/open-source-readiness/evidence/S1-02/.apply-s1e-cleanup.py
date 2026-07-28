from pathlib import Path
import re
root=Path.cwd() / 'packages'

def rw(rel, fn):
 p=root/rel; s=p.read_text(); n=fn(s)
 if n==s: print('NOCHANGE',rel)
 p.write_text(n)

def rep(rel, pairs):
 def f(s):
  for a,b in pairs:
   if a not in s: print('MISSING',rel,repr(a))
   s=s.replace(a,b)
  return s
 rw(rel,f)

rep('core/test/plugin/skill.test.ts', [
 ('expect(list.some((item) => item.name === "customize-deepcode")).toBe(false)',
  'expect(list.some((item) => item.name === "customize-opencode")).toBe(false)')
])

def pr(s):
 if 'import { Product } from "@opencode-ai/core/product"' not in s:
  s=s.replace('import { Process } from "@/util/process"', 'import { Process } from "@/util/process"\nimport { Product } from "@opencode-ai/core/product"')
 s=s.replace('describe: "fetch and checkout a GitHub PR branch, then run opencode"','describe: "fetch and checkout a GitHub PR branch, then run DeepCode"')
 s=s.replace('          "headRefName,body",','          "headRefName",')
 s=s.replace('\n    let sessionId: string | undefined\n','\n')
 s=re.sub(r'''\n      if \(prInfo\?\.body\) \{.*?\n      \}\n''','\n',s,flags=re.S)
 s=s.replace('UI.println("Starting opencode...")','UI.println("Starting DeepCode...")')
 s=s.replace('const opencodeArgs = sessionId ? ["-s", sessionId] : []','const deepcodeArgs: string[] = []')
 s=s.replace('Process.spawn([Product.cli, ...opencodeArgs]','Process.spawn([Product.cli, ...deepcodeArgs]')
 s=s.replace('new Error(`opencode exited with code ${code}`)','new Error(`DeepCode exited with code ${code}`)')
 return s
rw('opencode/src/cli/cmd/pr.ts',pr)

rep('opencode/src/cli/cmd/run.ts', [('describe: "run opencode with a message"','describe: "run DeepCode with a message"')])
rep('opencode/src/mcp/index.ts', [('Run: opencode mcp auth ${key}','Run: deepcode mcp auth ${key}')])
rep('core/src/observability/otlp.ts', [('"opencode.run": runID','"deepcode.run": runID')])

def ide(s):
 s=s.replace('import { Process } from "@/util/process"\n','')
 pattern=r'''export async function install\(ide: \(typeof SUPPORTED_IDES\)\[number\]\["name"\]\) \{.*?\n\}'''
 new='''export async function install(ide: (typeof SUPPORTED_IDES)[number]["name"]) {
  const cmd = SUPPORTED_IDES.find((item) => item.name === ide)?.cmd
  if (!cmd) throw new Error(`Unknown IDE: ${ide}`)
  throw new InstallFailedError({
    stderr: "DeepCode IDE extension installation is unavailable until a verified DeepCode extension channel exists",
  })
}'''
 n,count=re.subn(pattern,new,s,flags=re.S)
 if count!=1: print('IDE REPLACE COUNT',count)
 return n
rw('opencode/src/ide/index.ts',ide)

def pinstall(s):
 s=s.replace('files: (dir: string, name: "opencode" | "tui") => string[]','files: (dir: string, name: string) => string[]')
 s=s.replace('function patchName(kind: Kind): "opencode" | "tui" {\n  if (kind === "server") return "opencode"\n  return "tui"\n}',
'''function patchName(kind: Kind): string {
  if (kind === "server") return Product.config.basename
  return "tui"
}''')
 return s
rw('opencode/src/plugin/install.ts',pinstall)
for rel in ['opencode/test/plugin/install.test.ts','opencode/test/plugin/install-concurrency.test.ts']:
 rw(rel,lambda s:s.replace('.opencode','.deepcode').replace('opencode.json','deepcode.json'))

def config_tests(s):
 old='''it.instance.skip("does not load an DeepCode-only project configuration", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeConfigEffect(test.directory, { username: "opencode-only" }, "deepcode.json")

    const config = yield* Config.use.get()
    expect(config.username).not.toBe("opencode-only")
  }),
)

it.instance.skip("loads DeepCode configuration when both products coexist", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* Effect.all([
      writeConfigEffect(test.directory, { username: "opencode-user" }, "deepcode.json"),
      writeConfigEffect(test.directory, { username: "deepcode-user" }, "deepcode.json"),
    ])

    const config = yield* Config.use.get()
    expect(config.username).toBe("deepcode-user")
  }),
)'''
 new='''it.instance("does not load an OpenCode-only project configuration", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* writeConfigEffect(test.directory, { username: "opencode-only" }, "opencode.json")

    const config = yield* Config.use.get()
    expect(config.username).not.toBe("opencode-only")
  }),
)

it.instance("loads DeepCode configuration when both products coexist", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* Effect.all([
      writeConfigEffect(test.directory, { username: "opencode-user" }, "opencode.json"),
      writeConfigEffect(test.directory, { username: "deepcode-user" }, "deepcode.json"),
    ])

    const config = yield* Config.use.get()
    expect(config.username).toBe("deepcode-user")
  }),
)'''
 if old not in s: print('MISSING CONFIG NEGATIVE BLOCK')
 return s.replace(old,new)
rw('opencode/test/config/config.test.ts',config_tests)

rep('opencode/src/session/llm/AGENTS.md', [
 ('`../llm.ts` is the opencode session LLM service. It owns opencode concerns:',
  '`../llm.ts` is the DeepCode session LLM service. It owns DeepCode concerns:')
])

ide_test=root/'opencode/test/ide/ide.test.ts'
if ide_test.exists():
 s=ide_test.read_text().replace('OPENCODE_CALLER','DEEPCODE_CALLER')
 s=s.replace('sst-dev.opencode','DeepCode IDE extension installation is unavailable')
 ide_test.write_text(s)
