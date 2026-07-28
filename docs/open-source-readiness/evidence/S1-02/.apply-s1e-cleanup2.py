from pathlib import Path
import re
root=Path.cwd() / 'packages'

def rw(rel, fn):
 p=root/rel
 if not p.exists(): print('MISSINGFILE',rel); return
 s=p.read_text(); n=fn(s)
 if n==s: print('NOCHANGE',rel)
 p.write_text(n)

def rep(rel,pairs):
 def f(s):
  for a,b in pairs:
   if a not in s: print('MISSING',rel,repr(a))
   s=s.replace(a,b)
  return s
 rw(rel,f)

rep('core/src/project.ts', [
 ('old opencode project service','legacy project service'),
 ('path.join(dir, "opencode")','path.join(dir, "deepcode")'),
 ('path.join(input.store, "opencode")','path.join(input.store, "deepcode")'),
])

def core_project_test(s):
 s=s.replace('path.join(tmp.path, ".git", "opencode")','path.join(tmp.path, ".git", "deepcode")')
 s=s.replace('"returns previous cached id from common dir"','"returns previous DeepCode cached id from common dir"')
 anchor='''  it.live("does not write the cache while resolving", () =>
'''
 negative='''  it.live("ignores an OpenCode cache file", () =>
    Effect.gen(function* () {
      const tmp = yield* Effect.acquireRelease(
        Effect.promise(() => tmpdir()),
        (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
      )
      yield* Effect.promise(() => initRepo(tmp.path, { commit: true, remote: "git@github.com:owner/repo.git" }))
      yield* Effect.promise(() => Bun.write(path.join(tmp.path, ".git", "opencode"), "opencode-id"))
      const project = yield* ProjectV2.Service

      const result = yield* project.resolve(abs(tmp.path))

      expect(result.previous).toBeUndefined()
      expect(result.id).toBe(remoteID("github.com/owner/repo"))
      expect(yield* Effect.promise(() => Bun.file(path.join(tmp.path, ".git", "opencode")).text())).toBe(
        "opencode-id",
      )
    }),
  )

'''
 if negative not in s:
  s=s.replace(anchor,negative+anchor)
 return s
rw('core/test/project.test.ts',core_project_test)

for rel in ['opencode/test/project/project.test.ts','opencode/test/server/project-init-git.test.ts']:
 rw(rel,lambda s:s.replace('"opencode"','"deepcode"').replace('opencodeFile','deepcodeFile').replace('correctCache','correctCache').replace('wrongCache','wrongCache'))

def shell(s):
 if 'import { Product } from "./product"' not in s:
  s=s.replace('import { which } from "./util/which"','import { which } from "./util/which"\nimport { Product } from "./product"')
 return s.replace('\n      "opencode",\n      cwd,','\n      Product.cli,\n      cwd,')
rw('core/src/shell.ts',shell)
rep('core/src/observability/otlp.ts', [('serviceName: "opencode"','serviceName: "deepcode"')])
rep('opencode/src/server/mdns.ts', [('domain ?? "opencode.local"','domain ?? "deepcode.local"'),('`opencode-${port}`','`deepcode-${port}`')])
rep('opencode/src/cli/network.ts', [('default: "opencode.local"','default: "deepcode.local"')])
rep('core/src/v1/config/server.ts', [('default: opencode.local','default: deepcode.local')])
rep('core/src/v1/config/config.ts', [('Server configuration for opencode serve and web commands','Server configuration for DeepCode serve and web commands')])
rep('opencode/test/server/httpapi-mdns.test.ts', [('`opencode-${listener.port}`','`deepcode-${listener.port}`')])
rep('opencode/test/cli/help/__snapshots__/help-snapshots.test.ts.snap', [('opencode.local','deepcode.local'),('running opencode server','running DeepCode server')])

def mcp(s):
 if 'import { Product } from "@opencode-ai/core/product"' not in s:
  s=s.replace('import { InstallationVersion } from "@opencode-ai/core/installation/version"','import { InstallationVersion } from "@opencode-ai/core/installation/version"\nimport { Product } from "@opencode-ai/core/product"')
 s=s.replace('new Client({ name: "opencode", version: InstallationVersion }','new Client({ name: Product.cli, version: InstallationVersion }')
 s=s.replace('...(cmd === "opencode" ? { BUN_BE_BUN: "1" } : {})','...(cmd === Product.cli ? { BUN_BE_BUN: "1" } : {})')
 return s
rw('opencode/src/mcp/index.ts',mcp)

def acp(s):
 if 'import { Product } from "@opencode-ai/core/product"' not in s:
  s=s.replace('import { InstallationVersion } from "@opencode-ai/core/installation/version"','import { InstallationVersion } from "@opencode-ai/core/installation/version"\nimport { Product } from "@opencode-ai/core/product"')
 s=s.replace('export const AuthMethodID = "opencode-login"','export const AuthMethodID = "deepcode-login"')
 s=s.replace('Run `opencode auth login` in the terminal','Run `deepcode auth login` in the terminal')
 s=s.replace('name: "Login with opencode"','name: "Login with DeepCode"')
 s=s.replace('command: "opencode"','command: Product.cli')
 s=s.replace('label: "OpenCode Login"','label: "DeepCode Login"')
 return s
rw('opencode/src/acp/service.ts',acp)
rep('opencode/test/cli/acp/initialize-auth.test.ts', [('opencode-login','deepcode-login')])

rep('opencode/src/cli/cmd/run.ts', [
 ('`opencode run`','`deepcode run`'),('`opencode --mini`','`deepcode --mini`'),
 ('running opencode server','running DeepCode server'),('http://opencode.internal','http://deepcode.internal'),
 ('$0: "opencode"','$0: "deepcode"')
])
rep('opencode/src/cli/cmd/run/runtime.ts', [('`opencode --mini`','`deepcode --mini`'),('http://opencode.internal','http://deepcode.internal')])
rep('opencode/src/cli/cmd/run/splash.ts', [('opencode entry logo','DeepCode entry logo'),('`opencode --mini -s ${meta.session_id}`','`deepcode --mini -s ${meta.session_id}`')])
rep('opencode/src/cli/cmd/run/types.ts', [('(`opencode --mini`)','(`deepcode --mini`)')])
rep('opencode/src/cli/cmd/run/tool.ts', [('`opencode run`','`deepcode run`')])
rep('opencode/src/cli/cmd/run/variant.shared.ts', [('~/.local/state/opencode/model.json','~/.local/state/deepcode/model.json')])
rep('opencode/src/cli/error.ts', [
 ('opencode does not support MCP authentication yet','DeepCode does not support MCP authentication yet'),
 ('Run `opencode auth login ${url}`','Run `deepcode auth login ${url}`')
])

rep('opencode/src/control-plane/dev/debug-workspace-plugin.ts', [('/tmp/opencode-workspace-dev-data.json','/tmp/deepcode-workspace-dev-data.json')])
rep('opencode/src/lsp/server.ts', [('opencode-jdtls-data','deepcode-jdtls-data')])
rep('opencode/src/tool/websearch.ts', [('`opencode/${InstallationVersion}`','`deepcode/${InstallationVersion}`')])
rep('core/src/tool/webfetch.ts', [('"You are opencode, an AI coding agent"','"You are DeepCode, an AI coding agent"')])
rep('opencode/src/tool/truncate.ts', [('values from `tool_output` in opencode config','values from `tool_output` in DeepCode config')])

for p in list((root/'core/src').rglob('*.ts'))+list((root/'opencode/src').rglob('*.ts')):
 s=p.read_text(); n=s.replace('`opencode/${InstallationVersion}`','`deepcode/${InstallationVersion}`')
 n=n.replace('`opencode/${InstallationChannel}/${InstallationVersion}/${Flag.OPENCODE_CLIENT}`','`deepcode/${InstallationChannel}/${InstallationVersion}/${Flag.OPENCODE_CLIENT}`')
 if n!=s: p.write_text(n)

p=root/'core/src/effect/dfdf'
if p.exists(): p.unlink()
