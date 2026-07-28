from pathlib import Path
import subprocess
import traceback

root = Path.cwd() / "packages"
exclude = {
    "core/test/global.test.ts",
    "opencode/test/config/coexistence.test.ts",
    "opencode/test/effect/runtime-flags-deepcode.test.ts",
}
for base in [root / "core/test", root / "opencode/test"]:
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        rel = str(p.relative_to(root))
        if rel in exclude:
            continue
        try:
            s = p.read_text()
        except UnicodeDecodeError:
            continue
        n = s.replace("OPENCODE_", "DEEPCODE_")
        if n != s:
            p.write_text(n)

replacements = {
    "opencode/src/server/routes/instance/httpapi/public.ts": [
        ("Server configuration for opencode serve and web commands", "Server configuration for DeepCode serve and web commands")
    ],
    "opencode/src/provider/provider.ts": [
        ("via env var, opencode auth, or provider options.", "via an environment variable, deepcode auth, or provider options.")
    ],
    "opencode/src/cli/cmd/serve.ts": [("starts a headless opencode server", "starts a headless DeepCode server")],
    "opencode/src/cli/cmd/attach.ts": [("attach to a running opencode server", "attach to a running DeepCode server")],
    "opencode/src/cli/cmd/web.ts": [("start opencode server and open web interface", "start the DeepCode server and open the web interface")],
    "opencode/src/cli/cmd/run.ts": [("`opencode --mini --attach`", "`deepcode --mini --attach`"), ("opencode server", "DeepCode server")],
    "opencode/src/cli/cmd/providers.ts": [("opencode auth provider", "DeepCode auth provider")],
    "core/src/tool/AGENTS.md": [("`opencode.tools.register(...)`", "`deepcode.tools.register(...)`")],
}
for rel, pairs in replacements.items():
    p = root / rel
    s = p.read_text()
    for old, new in pairs:
        s = s.replace(old, new)
    p.write_text(s)

(root / "opencode/src/cli/cmd/github.ts").write_text('import { Effect } from "effect"\nimport { cmd } from "./cmd"\nimport { effectCmd, fail } from "../effect-cmd"\n\nexport { extractResponseText, formatPromptTooLargeError, parseGitHubRemote } from "./github.shared"\n\nconst unavailable = () =>\n  fail(\n    "The GitHub agent is disabled until DeepCode provides a verified DeepCode-owned app, API endpoint, workflow, and sharing channel.",\n  )\n\nexport const GithubInstallCommand = effectCmd({\n  command: "install",\n  describe: "install the GitHub agent (currently unavailable)",\n  handler: Effect.fn("Cli.github.install")(unavailable),\n})\n\nexport const GithubRunCommand = effectCmd({\n  command: "run",\n  describe: "run the GitHub agent (currently unavailable)",\n  builder: (yargs) =>\n    yargs\n      .option("event", { type: "string", describe: "GitHub mock event to run the agent for" })\n      .option("token", { type: "string", describe: "GitHub personal access token" }),\n  handler: Effect.fn("Cli.github.run")(unavailable),\n})\n\nexport const GithubCommand = cmd({\n  command: "github",\n  describe: "manage GitHub agent (currently unavailable)",\n  builder: (yargs) => yargs.command(GithubInstallCommand).command(GithubRunCommand).demandCommand(),\n  async handler() {},\n})\n')

p = Path.cwd() / "packages/core/src/tool/webfetch.ts"
s = p.read_text().replace('execute(http, input.url, input.format, "opencode")', 'execute(http, input.url, input.format, "deepcode")')
p.write_text(s)

try:
    repo = Path.cwd()
    for file in [
        ".apply-s1e-transform.py",
        ".apply-s1e-cleanup.py",
        ".apply-s1e-cleanup2.py",
        ".apply-s1e-final-cleanup.py",
        ".apply-s1e-final.py",
    ]:
        (repo / "docs/open-source-readiness/evidence/S1-02" / file).unlink(missing_ok=True)
    (repo / ".github/workflows/s1e-apply.yml").unlink(missing_ok=True)

    workflow = repo / ".github/workflows/test.yml"
    text = workflow.read_text()
    snapshot = text.find("      - name: Upload temporary S1-02-E source snapshot")
    if snapshot != -1:
        snapshot_end = text.find("      - name: Check generated client", snapshot)
        if snapshot_end == -1:
            raise RuntimeError("temporary source snapshot end marker missing")
        text = text[:snapshot] + text[snapshot_end:]
    begin = text.find("  # BEGIN TEMP S1-02-E APPLY")
    end = text.find("  # END TEMP S1-02-E APPLY", begin)
    if begin == -1 or end == -1:
        raise RuntimeError("temporary apply job markers missing")
    end = text.find("\n", end)
    if end == -1:
        end = len(text)
    else:
        end += 1
    workflow.write_text(text[:begin] + text[end:])

    subprocess.run(["git", "diff", "--check"], check=True)
    subprocess.run(["git", "config", "user.email", "bot@deepcode.local"], check=True)
    subprocess.run(["git", "config", "user.name", "deepcode-ci"], check=True)
    subprocess.run(["git", "add", "-A"], check=True)
    message = """fix(identity): close DeepCode coexistence boundaries

English:
Move remaining user-visible environment, path, process, UI, OAuth, MCP, ACP, plugin, project-cache, and CLI boundaries to DeepCode. Fail closed for unverified upstream UI, account, IDE, and GitHub-agent channels while preserving explicitly classified package, schema, protocol, and provider compatibility identifiers.

简体中文:
将剩余用户可见环境变量、路径、进程、UI、OAuth、MCP、ACP、插件、项目缓存和 CLI 边界切换到 DeepCode；对未验证的上游 UI、账户、IDE 和 GitHub Agent 渠道实行 fail-closed，同时保留已分类的包、Schema、协议和 Provider 兼容标识。"""
    subprocess.run(["git", "commit", "-m", message], check=True)
    subprocess.run(["git", "push", "origin", "HEAD:coexistence-boundary-audit"], check=True)
    Path("s1e-commit.log").write_text("S1-02-E atomic migration pushed successfully\n")
    print("S1-02-E atomic migration pushed")
except Exception:
    error = traceback.format_exc()
    Path("s1e-commit.log").write_text(error)
    print(error)
    raise

# Stop the stale run after the push; the clean head starts the authoritative CI.
raise SystemExit(1)
