import { describe, expect, test } from "bun:test"
import path from "path"
import {
  cleanShellConfigContent,
  hasDeepCodeShellEntry,
  isDeepCodeBinaryPath,
} from "../../src/cli/cmd/uninstall"

describe("uninstall isolation", () => {
  test("accepts only the exact DeepCode binary target", () => {
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "deepcode"))).toBe(true)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "deepcode.exe"))).toBe(
      process.platform === "win32",
    )

    expect(isDeepCodeBinaryPath(path.join("home", "user", ".opencode", "bin", "opencode"))).toBe(false)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "opencode"))).toBe(false)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "nested", "deepcode"))).toBe(false)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin-backup", "deepcode"))).toBe(false)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".local", "bin", "deepcode"))).toBe(false)
  })

  test("does not classify OpenCode or DeepCode lookalike shell entries as targets", () => {
    const unrelated = [
      "# opencode",
      'export PATH="$HOME/.opencode/bin:$PATH"',
      "fish_add_path $HOME/.opencode/bin",
      'export PATH="$HOME/.deepcode/bin-backup:$PATH"',
      "fish_add_path $HOME/.deepcode/bin-old",
      "",
    ].join("\n")

    expect(hasDeepCodeShellEntry(unrelated)).toBe(false)
    expect(hasDeepCodeShellEntry(`${unrelated}# deepcode\n`)).toBe(true)
  })

  test("removes exact DeepCode shell entries and preserves OpenCode and unrelated lines", () => {
    const input = [
      "# opencode",
      'export PATH="$HOME/.opencode/bin:$PATH"',
      "# deepcode",
      'export PATH="$HOME/.deepcode/bin:$PATH"',
      "fish_add_path $HOME/.opencode/bin",
      "fish_add_path $HOME/.deepcode/bin",
      'export PATH="$HOME/.deepcode/bin-backup:$PATH"',
      "fish_add_path $HOME/.deepcode/bin-old",
      "echo $HOME/.deepcode/bin",
      "export KEEP_ME=1",
      "",
    ].join("\n")

    const output = cleanShellConfigContent(input)

    expect(output).toContain("# opencode")
    expect(output).toContain(".opencode/bin")
    expect(output).toContain(".deepcode/bin-backup")
    expect(output).toContain(".deepcode/bin-old")
    expect(output).toContain("echo $HOME/.deepcode/bin")
    expect(output).toContain("export KEEP_ME=1")
    expect(output).not.toContain("# deepcode")
    expect(output).not.toContain('export PATH="$HOME/.deepcode/bin:$PATH"')
    expect(output).not.toContain("fish_add_path $HOME/.deepcode/bin\n")
  })
})
