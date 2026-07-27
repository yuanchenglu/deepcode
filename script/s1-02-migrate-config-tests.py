from pathlib import Path


def replace_exact(path: Path, old: str, new: str, expected: int | None = None) -> None:
    text = path.read_text()
    count = text.count(old)
    if expected is not None and count != expected:
        raise SystemExit(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    if count == 0:
        return
    path.write_text(text.replace(old, new))


core = Path("packages/core/test/config/config.test.ts")
replace_exact(core, "loads opencode JSON and JSONC files from lowest to highest priority", "loads DeepCode JSON and JSONC files from lowest to highest priority", 1)
replace_exact(core, "opencode.jsonc", "deepcode.jsonc", 5)
replace_exact(core, "opencode.json", "deepcode.json", 14)
replace_exact(core, ".opencode", ".deepcode", 9)

location = Path("packages/core/test/location-layer.test.ts")
replace_exact(location, "opencode.json", "deepcode.json", 2)

cli = Path("packages/opencode/test/config/config.test.ts")
replace_exact(cli, "OPENCODE_TEST_MANAGED_CONFIG_DIR", "DEEPCODE_TEST_MANAGED_CONFIG_DIR", 1)
replace_exact(cli, "opencode.jsonc", "deepcode.jsonc")
replace_exact(cli, '"opencode.json"', '"deepcode.json"')
replace_exact(cli, ".opencode", ".deepcode")

# Preserve explicit negative OpenCode coexistence fixtures.
replace_exact(
    cli,
    'writeConfigEffect(test.directory, { username: "opencode-only" }, "deepcode.json")',
    'writeConfigEffect(test.directory, { username: "opencode-only" }, "opencode.json")',
    1,
)
replace_exact(
    cli,
    'writeConfigEffect(test.directory, { username: "opencode-user" }, "deepcode.json")',
    'writeConfigEffect(test.directory, { username: "opencode-user" }, "opencode.json")',
    1,
)

# Preserve upstream-compatible remote transport and plugin samples.
replace_exact(cli, "https://config.example.com/deepcode.json", "https://config.example.com/opencode.json")
replace_exact(
    cli,
    "https://config.example.com/{env:TEST_TOKEN}/deepcode.json",
    "https://config.example.com/{env:TEST_TOKEN}/opencode.json",
)
replace_exact(
    cli,
    "https://config.example.com/test-token/deepcode.json",
    "https://config.example.com/test-token/opencode.json",
)
replace_exact(
    cli,
    "file:///project/.deepcode/plugin/oh-my-opencode.js",
    "file:///project/.opencode/plugin/oh-my-opencode.js",
    1,
)
