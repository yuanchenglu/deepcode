import { describe, expect, test } from "bun:test"
import path from "path"
import {
  cleanShellConfigContent,
  hasDeepCodeShellEntry,
  isDeepCodeBinaryPath,
} from "../../src/cli/cmd/uninstall"

describe("uninstall isolation", () => {
  test("accepts only the DeepCode binary target", () => {
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "deepcode"))).toBe(true)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "deepcode.exe"))).toBe(true)

    expect(isDeepCodeBinaryPath(path.join("home", "user", ".opencode", "bin", "opencode"))).toBe(false)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".deepcode", "bin", "opencode"))).toBe(false)
    expect(isDeepCodeBinaryPath(path.join("home", "user", ".local", "bin", "deepcode"))).toBe(false)
  })

  test("does not classify OpenCode shell entries as DeepCode targets", () => {
    const openCodeOnly = [
      "# opencode",
      'export PATH="$HOME/.opencode/bin:$PATH"',
      "fish_add_path $HOME/.opencode/bin",
      "",
    ].join("\n")

    expect(hasDeepCodeShellEntry(openCodeOnly)).toBe(false)
    expect(hasDeepCodeShellEntry(`${openCodeOnly}# deepcode\n`)).toBe(true)
  })

  test("removes exact DeepCode shell entries and preserves OpenCode and unrelated lines", () => {
    const input = [
      "# opencode",
      'export PATH="$HOME/.opencode/bin:$PATH"',
      "# deepcode",
      'export PATH="$HOME/.deepcode/bin:$PATH"',
      "fish_add_path $HOME/.opencode/bin",
      "fish_add_path $HOME/.deepcode/bin",
      "echo $HOME/.deepcode/bin",
      "export KEEP_ME=1",
      "",
    ].join("\n")

    const output = cleanShellConfigContent(input)

    expect(output).toContain("# opencode")
    expect(output).toContain(".opencode/bin")
    expect(output).toContain("echo $HOME/.deepcode/bin")
    expect(output).toContain("export KEEP_ME=1")
    expect(output).not.toContain("# deepcode")
    expect(output).not.toContain('export PATH="$HOME/.deepcode/bin:$PATH"')
    expect(output).not.toContain("fish_add_path $HOME/.deepcode/bin")
  })
})
