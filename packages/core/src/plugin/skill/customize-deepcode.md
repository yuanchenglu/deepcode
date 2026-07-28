<!--
  Built-in DeepCode configuration skill. The upstream schema URL and
  @opencode-ai package names are compatibility identifiers, not local product
  paths or fallback configuration sources.
-->

# Customizing DeepCode

Use this skill only when editing DeepCode's own configuration, agents,
commands, skills, plugins, MCP servers, or permission rules. Do not use it for
ordinary application code.

## Source of truth

DeepCode currently consumes the upstream-compatible schema at:

**<https://opencode.ai/config.json>**

The URL is retained only as the verified schema contract. Local discovery is
DeepCode-only: do not create, read, migrate, or modify OpenCode configuration.

Every DeepCode config should declare:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

When an exact field shape is uncertain, inspect the schema rather than
guessing. DeepCode validates configuration strictly.

## File locations

| Scope | Path |
| --- | --- |
| Project config | `./deepcode.json`, `./deepcode.jsonc` |
| Project-local config | `.deepcode/deepcode.json`, `.deepcode/deepcode.jsonc` |
| Global config | platform-equivalent DeepCode config directory, normally `~/.config/deepcode/deepcode.json` |
| Project agents | `.deepcode/agent/<name>.md` or `.deepcode/agents/<name>.md` |
| Project commands | `.deepcode/command/<name>.md` or `.deepcode/commands/<name>.md` |
| Project skills | `.deepcode/skill/<name>/SKILL.md` or `.deepcode/skills/<name>/SKILL.md` |
| Project plugins | `.deepcode/plugin/*.ts` or `.deepcode/plugins/*.ts` |
| Project plans | `.deepcode/plans/*.md` |

Never use `.opencode`, `opencode.json`, `opencode.jsonc`, or an OpenCode global
configuration directory as an implicit DeepCode source. Importing another
product requires a future explicit import command and is not part of normal
configuration discovery.

## Configuration skeleton

```json
{
  "$schema": "https://opencode.ai/config.json",
  "username": "user",
  "model": "provider/model-id",
  "small_model": "provider/model-id",
  "default_agent": "build",
  "shell": "/bin/zsh",
  "logLevel": "INFO",
  "share": "disabled",
  "autoupdate": false,
  "instructions": ["AGENTS.md"],
  "skills": {
    "paths": [".deepcode/skills"],
    "urls": []
  },
  "agent": {},
  "command": {},
  "provider": {},
  "mcp": {},
  "plugin": [],
  "permission": {
    "edit": "ask",
    "bash": {
      "git status": "allow",
      "*": "ask"
    }
  }
}
```

Key shape rules:

- `model` includes a provider prefix.
- `skills` is an object containing `paths` and/or `urls`.
- `agent` and `command` are objects keyed by name.
- `plugin` is an array of package specs, file paths, or `[spec, options]`
  tuples. Existing `@opencode-ai/*` package names may remain where required by
  the current package ecosystem.
- `mcp[name].command` is an array of strings.
- `permission` accepts an action or a rule object. The last matching rule wins.

## Agents

Create non-trivial agents as Markdown files:

```text
.deepcode/agents/reviewer.md
```

```markdown
---
description: Reviews changes for correctness and regressions.
mode: subagent
model: provider/model-id
permission:
  edit: deny
  bash: ask
---

Review the requested changes and report evidence-backed findings.
```

The file body is the prompt. Do not duplicate it in a `prompt` frontmatter key.

## Commands

Project commands live under `.deepcode/command/` or `.deepcode/commands/`:

```markdown
---
description: Run the project verification sequence.
agent: build
---

Run the package-scoped checks required by AGENTS.md. Arguments: $ARGUMENTS
```

## Skills

A skill is stored as:

```text
.deepcode/skills/<name>/SKILL.md
```

```markdown
---
name: example-skill
description: Use when the task matches the documented trigger.
---

# Example skill

Instructions and references.
```

The directory name and `name` should match. Keep descriptions concrete enough
for deterministic triggering.

## Plugins

Local plugins belong under `.deepcode/plugin/` or `.deepcode/plugins/`.
Package-based plugins may still use upstream-compatible package names where no
DeepCode package exists; that package compatibility does not authorize reading
OpenCode configuration or directories.

## Runtime environment variables

Only DeepCode user variables are valid:

- `DEEPCODE_CONFIG`
- `DEEPCODE_CONFIG_DIR`
- `DEEPCODE_CONFIG_CONTENT`
- `DEEPCODE_DISABLE_PROJECT_CONFIG`
- `DEEPCODE_DISABLE_DEFAULT_PLUGINS`
- `DEEPCODE_DISABLE_EXTERNAL_SKILLS`
- `DEEPCODE_PURE`
- `DEEPCODE_SERVER_USERNAME`
- `DEEPCODE_SERVER_PASSWORD`

Do not recommend `OPENCODE_*` variables for DeepCode. Their presence must not
change DeepCode behavior.

## Applying changes

Configuration is not assumed to hot-reload. After changing DeepCode config or
config-time files, tell the user to restart DeepCode. Before writing:

1. identify the exact DeepCode target path;
2. preserve unrelated keys and comments where possible;
3. validate the resulting shape against the schema;
4. do not touch coexisting OpenCode files;
5. report every file created or modified.
