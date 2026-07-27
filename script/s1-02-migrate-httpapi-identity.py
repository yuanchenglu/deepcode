from pathlib import Path


def replace_exact(path: Path, old: str, new: str, expected: int) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    path.write_text(text.replace(old, new))


httpapi = Path("packages/opencode/test/server/httpapi-exercise/index.ts")
replace_exact(httpapi, "isolates `OPENCODE_DB`", "isolates `DEEPCODE_DB`", 1)
replace_exact(httpapi, '"opencode.jsonc"', '"deepcode.jsonc"', 2)

auth = Path("packages/opencode/test/server/auth.test.ts")
replace_exact(auth, "defaults to the opencode username", "defaults to the deepcode username", 1)
replace_exact(auth, 'Buffer.from("opencode:secret")', 'Buffer.from("deepcode:secret")', 1)
replace_exact(
    auth,
    'ServerAuth.authorized({ username: "opencode", password: Redacted.make("secret") }, config)',
    'ServerAuth.authorized({ username: "deepcode", password: Redacted.make("secret") }, config)',
    1,
)
