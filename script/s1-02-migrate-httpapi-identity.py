from pathlib import Path


def replace_all(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count == 0:
        raise SystemExit(f"{path}: no occurrences of {old!r}")
    path.write_text(text.replace(old, new))
    print(f"{path}: replaced {count} occurrence(s) of {old!r}")


httpapi = Path("packages/opencode/test/server/httpapi-exercise/index.ts")
replace_all(httpapi, "isolates `OPENCODE_DB`", "isolates `DEEPCODE_DB`")
replace_all(httpapi, '"opencode.jsonc"', '"deepcode.jsonc"')

auth = Path("packages/opencode/test/server/auth.test.ts")
replace_all(auth, "defaults to the opencode username", "defaults to the deepcode username")
replace_all(auth, 'Buffer.from("opencode:secret")', 'Buffer.from("deepcode:secret")')
replace_all(
    auth,
    'ServerAuth.authorized({ username: "opencode", password: Redacted.make("secret") }, config)',
    'ServerAuth.authorized({ username: "deepcode", password: Redacted.make("secret") }, config)',
)
