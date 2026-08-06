import { describe, expect, test } from "bun:test"
import path from "path"

const root = path.resolve(import.meta.dir, "../..")

async function source(file: string) {
  return Bun.file(path.join(root, file)).text()
}

describe("DeepCode CLI artifact contract", () => {
  test("package and launcher expose only the deepcode command", async () => {
    const pkg = await Bun.file(path.join(root, "package.json")).json()
    expect(pkg.bin).toEqual({ deepcode: "./bin/deepcode" })
    expect(await Bun.file(path.join(root, "bin/deepcode")).exists()).toBe(true)
    expect(await Bun.file(path.join(root, "bin/opencode")).exists()).toBe(false)

    const launcher = await source("bin/deepcode")
    expect(launcher).toContain("DEEPCODE_BIN_PATH")
    expect(launcher).toContain("deepcode-")
    expect(launcher).not.toContain("OPENCODE_BIN_PATH")
  })

  test("build emits a deepcode binary, canonical archives, checksums, and a manifest", async () => {
    const build = await source("script/build.ts")
    expect(build).toContain("deepcode-manifest.json")
    expect(build).toContain("deepcode-checksums.txt")
    expect(build).toContain("--user-agent=${pkg.name}")
    expect(build).not.toContain("bin/opencode")
    expect(build).not.toContain("--user-agent=opencode")
  })

  test("Alpha installers and publishers cannot request upstream or package-manager release channels", async () => {
    const install = await source("script/install.sh")
    const postinstall = await source("script/postinstall.mjs")
    const publish = await source("script/publish.ts")
    const lifecycle = `${install}\n${postinstall}\n${publish}`

    expect(install).toContain('repo="yuanchenglu/deepcode"')
    expect(install).toContain("deepcode-checksums.txt")
    expect(install).toContain("checksum mismatch")
    expect(lifecycle).not.toContain("https://github.com/anomalyco")
    expect(lifecycle).not.toContain("npm install")
    expect(lifecycle).not.toContain("npm publish")
    expect(lifecycle).not.toContain("brew install")
  })
})
