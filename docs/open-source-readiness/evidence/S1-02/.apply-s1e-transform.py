from pathlib import Path
import re
root=Path.cwd() / 'packages'
changed=[]

def edit(rel, fn):
    p=root/rel
    old=p.read_text()
    new=fn(old)
    if new!=old:
        p.write_text(new)
        changed.append(rel)
    return old,new

def replace(rel, pairs):
    def f(s):
        for a,b in pairs:
            if a not in s:
                print('WARN missing',rel,repr(a))
            s=s.replace(a,b)
        return s
    edit(rel,f)

# Local/persisted DeepCode identity
replace('opencode/src/agent/agent.ts', [("path.join(\".opencode\", \"plans\", \"*.md\")", "path.join(\".deepcode\", \"plans\", \"*.md\")")])
replace('opencode/src/session/session.ts', [("path.join(instance.worktree, \".opencode\", \"plans\")", "path.join(instance.worktree, \".deepcode\", \"plans\")")])

# MCP config write/discovery and CLI text
def mcp(s):
    s=s.replace('import { Global } from "@opencode-ai/core/global"', 'import { Global } from "@opencode-ai/core/global"\nimport { Product } from "@opencode-ai/core/product"')
    s=s.replace('prompts.outro("Add servers with: opencode mcp add")','prompts.outro("Add servers with: deepcode mcp add")')
    s=s.replace('Add a remote server in opencode.json:', 'Add a remote server in deepcode.json:')
    old='''async function resolveConfigPath(baseDir: string, global = false) {\n  // Check for existing config files (prefer .jsonc over .json, check .opencode/ subdirectory too)\n  const candidates = [path.join(baseDir, "opencode.json"), path.join(baseDir, "opencode.jsonc")]\n\n  if (!global) {\n    candidates.push(path.join(baseDir, ".opencode", "opencode.json"), path.join(baseDir, ".opencode", "opencode.jsonc"))\n  }\n\n  for (const candidate of candidates) {\n    if (await Filesystem.exists(candidate)) {\n      return candidate\n    }\n  }\n\n  // Default to opencode.json if none exist\n  return candidates[0]\n}'''
    new='''async function resolveConfigPath(baseDir: string, global = false) {\n  // Prefer JSONC, then JSON, and never discover OpenCode configuration.\n  const files = [...Product.config.files].toReversed()\n  const candidates = files.map((file) => path.join(baseDir, file))\n\n  if (!global) {\n    candidates.push(...files.map((file) => path.join(baseDir, Product.config.directory, file)))\n  }\n\n  for (const candidate of candidates) {\n    if (await Filesystem.exists(candidate)) return candidate\n  }\n\n  // New configuration is written to the canonical project DeepCode file.\n  return path.join(baseDir, Product.config.files[0])\n}'''
    if old not in s: print('WARN missing mcp helper')
    return s.replace(old,new)
edit('opencode/src/cli/cmd/mcp.ts',mcp)

# CLI identity and messages
def add_product_and_replace(rel, old_import, pairs):
    def f(s):
        if 'from "@opencode-ai/core/product"' not in s:
            s=s.replace(old_import, old_import+'\nimport { Product } from "@opencode-ai/core/product"')
        for a,b in pairs: s=s.replace(a,b)
        return s
    edit(rel,f)
add_product_and_replace('opencode/src/cli/cmd/pr.ts','import { Process } from "@opencode-ai/core/process"',[("Process.spawn([\"opencode\", ...opencodeArgs]", "Process.spawn([Product.cli, ...opencodeArgs]")])
replace('opencode/src/cli/cmd/providers.ts', [('configure it in opencode.json','configure it in deepcode.json'),('Configure via opencode.json options','Configure via deepcode.json options')])
replace('opencode/src/cli/error.ts', [('config (opencode.json)','config (deepcode.json)')])
replace('opencode/src/cli/cmd/run.ts', [('defaults to OPENCODE_SERVER_PASSWORD','defaults to DEEPCODE_SERVER_PASSWORD')])
replace('opencode/src/cli/cmd/attach.ts', [('defaults to OPENCODE_SERVER_PASSWORD','defaults to DEEPCODE_SERVER_PASSWORD')])
replace('opencode/src/cli/cmd/serve.ts', [('OPENCODE_SERVER_PASSWORD is not set','DEEPCODE_SERVER_PASSWORD is not set')])
replace('opencode/src/cli/cmd/web.ts', [('OPENCODE_SERVER_PASSWORD is not set','DEEPCODE_SERVER_PASSWORD is not set')])
replace('opencode/src/cli/cmd/run/trace.ts', [('OPENCODE_DIRECT_TRACE','DEEPCODE_DIRECT_TRACE'),('~/.local/share/opencode/log','~/.local/share/deepcode/log')])
replace('opencode/src/cli/cmd/acp.ts', [('process.env.OPENCODE_CLIENT','process.env.DEEPCODE_CLIENT')])
replace('opencode/src/tool/task.ts', [('OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS','DEEPCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS')])

# Direct environment variables outside the internal Flag compatibility surface
replace('opencode/src/auth/index.ts', [('process.env.OPENCODE_AUTH_CONTENT','process.env.DEEPCODE_AUTH_CONTENT')])
replace('opencode/src/control-plane/workspace.ts', [('OPENCODE_AUTH_CONTENT:', 'DEEPCODE_AUTH_CONTENT:'),('OPENCODE_WORKSPACE_ID:', 'DEEPCODE_WORKSPACE_ID:'),('OPENCODE_EXPERIMENTAL_WORKSPACES:', 'DEEPCODE_EXPERIMENTAL_WORKSPACES:')])
replace('opencode/src/tool/websearch.ts', [('process.env.OPENCODE_WEBSEARCH_PROVIDER','process.env.DEEPCODE_WEBSEARCH_PROVIDER')])
replace('core/src/tool/websearch.ts', [('process.env.OPENCODE_WEBSEARCH_PROVIDER','process.env.DEEPCODE_WEBSEARCH_PROVIDER'),('truthy("OPENCODE_EXPERIMENTAL")','truthy("DEEPCODE_EXPERIMENTAL")'),('truthy("OPENCODE_ENABLE_EXA")','truthy("DEEPCODE_ENABLE_EXA")'),('truthy("OPENCODE_EXPERIMENTAL_EXA")','truthy("DEEPCODE_EXPERIMENTAL_EXA")'),('truthy("OPENCODE_ENABLE_PARALLEL")','truthy("DEEPCODE_ENABLE_PARALLEL")'),('truthy("OPENCODE_EXPERIMENTAL_PARALLEL")','truthy("DEEPCODE_EXPERIMENTAL_PARALLEL")')])
replace('core/src/repository.ts', [('process.env.OPENCODE_REPO_CLONE_GITHUB_BASE_URL','process.env.DEEPCODE_REPO_CLONE_GITHUB_BASE_URL')])
replace('opencode/src/util/repository.ts', [('process.env.OPENCODE_REPO_CLONE_GITHUB_BASE_URL','process.env.DEEPCODE_REPO_CLONE_GITHUB_BASE_URL')])
replace('opencode/src/share/share-next.ts', [('OPENCODE_DISABLE_SHARE','DEEPCODE_DISABLE_SHARE')])
replace('opencode/src/acp/profile.ts', [('process.env.OPENCODE_ACP_PROFILE','process.env.DEEPCODE_ACP_PROFILE')])

# Process/persistence identity
replace('core/src/pty.ts', [('OPENCODE_TERMINAL: "1"','DEEPCODE_TERMINAL: "1"')])
replace('core/src/models-dev.ts', [('`opencode/${InstallationChannel}/${InstallationVersion}/${Flag.OPENCODE_CLIENT}`','`deepcode/${InstallationChannel}/${InstallationVersion}/${Flag.OPENCODE_CLIENT}`')])
replace('core/src/observability/otlp.ts', [('"opencode.client": Flag.OPENCODE_CLIENT','"deepcode.client": Flag.OPENCODE_CLIENT')])
replace('core/src/skill/discovery.ts', [('.opencode-version','.deepcode-version')])
replace('opencode/src/skill/discovery.ts', [('.opencode-version','.deepcode-version')])

# Plugin local paths
def plugin_install(s):
    if 'from "@opencode-ai/core/product"' not in s:
        s=s.replace('import { Global } from "@opencode-ai/core/global"','import { Global } from "@opencode-ai/core/global"\nimport { Product } from "@opencode-ai/core/product"')
    return s.replace('return path.join(root, ".opencode")','return path.join(root, Product.config.directory)')
edit('opencode/src/plugin/install.ts',plugin_install)

def tui_runtime(s):
    if 'from "@opencode-ai/core/product"' not in s:
        s=s.replace('import { Global } from "@opencode-ai/core/global"','import { Global } from "@opencode-ai/core/global"\nimport { Product } from "@opencode-ai/core/product"')
    s=s.replace('path.basename(source_dir) === ".opencode"','path.basename(source_dir) === Product.config.directory')
    s=s.replace('path.join(source_dir, ".opencode", "themes")','path.join(source_dir, Product.config.directory, "themes")')
    s=s.replace('path.join(state.directory, ".opencode", "tui.json")','path.join(state.directory, Product.config.directory, "tui.json")')
    return s
edit('opencode/src/plugin/tui/runtime.ts',tui_runtime)

# IDE: identify DeepCode callers and fail closed instead of installing the upstream extension.
def ide(s):
    s=s.replace('process.env["OPENCODE_CALLER"]','process.env["DEEPCODE_CALLER"]')
    old='''export async function install() {\n  const editor = await getEditor()\n  if (!editor) return\n  const cmd = editor === "vscode" ? "code" : "code-insiders"\n  const p = await Process.run([cmd, "--install-extension", "sst-dev.opencode"], {\n    stdout: "pipe",\n    stderr: "pipe",\n  })\n  if (p.code !== 0) throw new Error(p.stderr.toString())\n}'''
    new='''export async function install() {\n  const editor = await getEditor()\n  if (!editor) return\n  throw new Error("DeepCode editor extension installation is unavailable until a verified DeepCode extension channel exists")\n}'''
    if old not in s: print('WARN missing IDE install block')
    return s.replace(old,new)
edit('opencode/src/ide/index.ts',ide)

# User-facing docs/comments
for rel in ['core/src/deepcode/reasoning/manager.ts','core/src/deepcode/router/model-router.ts','opencode/src/provider/provider.ts']:
    edit(rel, lambda s: s.replace('opencode.json','deepcode.json'))
replace('opencode/src/control-plane/dev/README.md', [('.opencode/opencode.jsonc','.deepcode/deepcode.jsonc')])
replace('opencode/src/effect/config-service.ts', [('OPENCODE_SERVER_PASSWORD','DEEPCODE_SERVER_PASSWORD'),('OPENCODE_SERVER_USERNAME','DEEPCODE_SERVER_USERNAME'),('withDefault("opencode")','withDefault("deepcode")')])
replace('opencode/src/session/llm/AGENTS.md', [('OPENCODE_EXPERIMENTAL_NATIVE_LLM','DEEPCODE_EXPERIMENTAL_NATIVE_LLM'),('OPENCODE_EXPERIMENTAL=true','DEEPCODE_EXPERIMENTAL=true')])
replace('opencode/src/plugin/openai/README.md', [('OPENCODE_EXPERIMENTAL_WEBSOCKETS','DEEPCODE_EXPERIMENTAL_WEBSOCKETS')])

# Tests: update known product-boundary expectations; preserve explicit negative coexistence tests.
replace('opencode/test/agent/agent.test.ts', [('.opencode/plans/*','.deepcode/plans/*'),('.opencode/plans/foo.md','.deepcode/plans/foo.md')])
replace('core/test/plugin/skill.test.ts', [('customize-opencode','customize-deepcode'),("opencode's own configuration",'DeepCode configuration')])

def runtime_test(s):
    s=re.sub(r'(?<!Flag\.)OPENCODE_', 'DEEPCODE_', s)
    s=s.replace('reads OPENCODE_', 'reads DEEPCODE_')
    return s
edit('opencode/test/effect/runtime-flags.test.ts',runtime_test)

def cp_test(s):
    return re.sub(r'(?<!Flag\.)OPENCODE_(AUTH_CONTENT|WORKSPACE_ID|EXPERIMENTAL_WORKSPACES)', r'DEEPCODE_\1', s)
edit('opencode/test/control-plane/workspace.test.ts',cp_test)

for rel in ['opencode/test/cli/help/__snapshots__/help-snapshots.test.ts.snap','opencode/test/cli/error.test.ts']:
    edit(rel, lambda s: s.replace('OPENCODE_SERVER_PASSWORD','DEEPCODE_SERVER_PASSWORD').replace('OPENCODE_SERVER_USERNAME','DEEPCODE_SERVER_USERNAME').replace("'opencode'","'deepcode'").replace('opencode.json','deepcode.json').replace('.opencode','.deepcode'))

edit('opencode/test/cli/mcp-add.test.ts', lambda s: s.replace('path.join(home, ".config", "opencode", "opencode.json")','path.join(home, ".config", "deepcode", "deepcode.json")'))

def product_test(s):
    s=re.sub(r'(?<!Flag\.)OPENCODE_', 'DEEPCODE_', s)
    s=s.replace('opencode.jsonc','deepcode.jsonc').replace('opencode.json','deepcode.json').replace('.opencode','.deepcode')
    s=s.replace('OpenCode','DeepCode').replace('opencode config','deepcode config')
    return s
for rel in ['opencode/test/config/config.test.ts','opencode/test/config/tui.test.ts']:
    edit(rel,product_test)

for p in (root/'opencode/test').rglob('*.ts'):
    rel=str(p.relative_to(root))
    if rel in {'opencode/test/config/coexistence.test.ts','opencode/test/config/deepcode-coexistence.test.ts','opencode/test/config/tui-coexistence.test.ts'}:
        continue
    s=p.read_text(); n=re.sub(r'(?<!Flag\.)OPENCODE_CONFIG_CONTENT','DEEPCODE_CONFIG_CONTENT',s)
    n=re.sub(r'(?<!Flag\.)OPENCODE_TEST_HOME','DEEPCODE_TEST_HOME',n)
    n=re.sub(r'(?<!Flag\.)OPENCODE_AUTH_CONTENT','DEEPCODE_AUTH_CONTENT',n)
    if n!=s:
        p.write_text(n); changed.append(rel)

print('\n'.join(changed))
print('CHANGED',len(changed))