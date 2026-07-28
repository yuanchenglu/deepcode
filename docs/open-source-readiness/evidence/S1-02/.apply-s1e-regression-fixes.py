from pathlib import Path

root = Path.cwd()
changed: list[str] = []


def edit(path: str, transform) -> None:
    target = root / path
    before = target.read_text()
    after = transform(before)
    if after == before:
        return
    target.write_text(after)
    changed.append(path)


def replace_required(path: str, old: str, new: str) -> None:
    def transform(text: str) -> str:
        if old not in text:
            raise SystemExit(f"required text missing in {path}: {old!r}")
        return text.replace(old, new)

    edit(path, transform)


# Production defects and type-surface mismatches.
replace_required(
    "packages/core/src/plugin/provider/opencode.ts",
    "process.env.OPENCODE_API_KEY || connected || item.provider.request.body.apiKey",
    "process.env.DEEPCODE_API_KEY || connected || item.provider.request.body.apiKey",
)
replace_required(
    "packages/opencode/src/cli/cmd/plug.ts",
    'files: (dir: string, name: "opencode" | "tui") => string[]',
    "files: (dir: string, name: string) => string[]",
)


def add_product_import(text: str) -> str:
    line = 'import { Product } from "@opencode-ai/core/product"\n'
    if line in text:
        return text
    anchor = 'import { NamedError } from "@opencode-ai/core/util/error"\n'
    if anchor not in text:
        raise SystemExit("cli/error.ts import anchor missing")
    return text.replace(anchor, anchor + line, 1)


edit("packages/opencode/src/cli/error.ts", add_product_import)

# Flag's public TypeScript property names remain upstream-compatible internally;
# the getters resolve DEEPCODE_* environment variables through Product.envPrefix.
for target in (root / "packages/opencode/test").rglob("*"):
    if not target.is_file() or target.suffix not in {".ts", ".tsx"}:
        continue
    before = target.read_text()
    after = before.replace("Flag.DEEPCODE_", "Flag.OPENCODE_")
    if after != before:
        target.write_text(after)
        changed.append(str(target.relative_to(root)))

# Assertions for product-owned network and telemetry identity.
core_pairs = [
    ('"HTTP-Referer": "https://opencode.ai/"', '"HTTP-Referer": "https://github.com/yuanchenglu/deepcode"'),
    ('"http-referer": "https://opencode.ai/"', '"http-referer": "https://github.com/yuanchenglu/deepcode"'),
    ('"X-Title": "opencode"', '"X-Title": "deepcode"'),
    ('"x-title": "opencode"', '"x-title": "deepcode"'),
    ('"X-Source": "opencode"', '"X-Source": "deepcode"'),
    ('"X-BILLING-INVOKE-ORIGIN": "OpenCode"', '"X-BILLING-INVOKE-ORIGIN": "DeepCode"'),
    ('"X-Cerebras-3rd-Party-Integration": "opencode"', '"X-Cerebras-3rd-Party-Integration": "deepcode"'),
    ('expect.stringContaining("opencode/")', 'expect.stringContaining("deepcode/")'),
    ('/^opencode\\/', '/^deepcode\\/'),
    ('"opencode.client"', '"deepcode.client"'),
    ('"opencode.run"', '"deepcode.run"'),
]
for target in (root / "packages/core/test").rglob("*"):
    if not target.is_file() or target.suffix not in {".ts", ".tsx"}:
        continue
    before = target.read_text()
    after = before
    for old, new in core_pairs:
        after = after.replace(old, new)
    if after != before:
        target.write_text(after)
        changed.append(str(target.relative_to(root)))

replace_required(
    "packages/core/test/tool-webfetch.test.ts",
    'expect(requests[1]?.headers["user-agent"]).toBe("opencode")',
    'expect(requests[1]?.headers["user-agent"]).toBe("deepcode")',
)

if not changed:
    raise SystemExit("S1-02-E regression fix produced no changes")

print("\n".join(sorted(set(changed))))
print(f"CHANGED {len(set(changed))} files")
