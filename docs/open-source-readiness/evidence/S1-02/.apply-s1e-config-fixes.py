from pathlib import Path

root = Path.cwd()
changes: list[str] = []


def replace_required(path: str, old: str, new: str, count: int = 1) -> None:
    target = root / path
    before = target.read_text()
    if old not in before:
        raise SystemExit(f"required text missing in {path}: {old!r}")
    after = before.replace(old, new, count)
    target.write_text(after)
    changes.append(path)


replace_required(
    "packages/core/src/flag/flag.ts",
    '  OPENCODE_CONFIG_CONTENT: read("OPENCODE_CONFIG_CONTENT"),\n',
    '  get OPENCODE_CONFIG_CONTENT() {\n    return read("OPENCODE_CONFIG_CONTENT")\n  },\n',
)

config = "packages/opencode/test/config/config.test.ts"
replace_required(
    config,
    '''      { $schema: "https://opencode.ai/config.json", shell: "bash" },
      "config.json",
    )

    yield* Config.Service.use((svc) => svc.update(ConfigParse.schema(ConfigV1.Info, { shell: "" }, "test:config")))

    const writtenConfig = yield* FSUtil.use.readJson(path.join(test.directory, "config.json"))''',
    '''      { $schema: "https://opencode.ai/config.json", shell: "bash" },
      "deepcode.json",
    )

    yield* Config.Service.use((svc) => svc.update(ConfigParse.schema(ConfigV1.Info, { shell: "" }, "test:config")))

    const writtenConfig = yield* FSUtil.use.readJson(path.join(test.directory, "deepcode.json"))''',
)
replace_required(
    config,
    '    const writtenConfig = yield* FSUtil.use.readJson(path.join(test.directory, "config.json"))\n    expect(writtenConfig).toMatchObject({ model: "updated/model" })',
    '    const writtenConfig = yield* FSUtil.use.readJson(path.join(test.directory, "deepcode.json"))\n    expect(writtenConfig).toMatchObject({ model: "updated/model" })',
)

print("\n".join(changes))
print(f"CHANGED {len(changes)} files")
