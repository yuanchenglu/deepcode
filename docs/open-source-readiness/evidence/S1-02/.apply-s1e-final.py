from pathlib import Path
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
print("S1-02-E transform complete")

p = Path.cwd() / "packages/core/src/tool/webfetch.ts"
s = p.read_text().replace('execute(http, input.url, input.format, "opencode")', 'execute(http, input.url, input.format, "deepcode")')
p.write_text(s)
