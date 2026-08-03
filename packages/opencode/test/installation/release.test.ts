import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  artifactName,
  downloadVerifiedRelease,
  parseInstallManifest,
  parseReleaseManifest,
  replaceBinaryAtomically,
  sha256,
} from "../../src/installation/release"

const version = "1.2.3"
const asset = "deepcode-linux-x64.tar.gz"
const bytes = new TextEncoder().encode("verified DeepCode archive fixture")

describe("DeepCode release lifecycle", () => {
  test("uses one canonical artifact name per supported platform and architecture", () => {
    expect(artifactName("linux", "x64")).toBe("deepcode-linux-x64.tar.gz")
    expect(artifactName("darwin", "arm64")).toBe("deepcode-darwin-arm64.zip")
    expect(artifactName("win32", "x64")).toBe("deepcode-windows-x64.zip")
    expect(() => artifactName("freebsd", "x64")).toThrow("does not support platform")
    expect(() => artifactName("linux", "ia32")).toThrow("does not support architecture")
  })

  test("rejects non-DeepCode assets, duplicate assets, and malformed checksums", () => {
    expect(() =>
      parseReleaseManifest(
        JSON.stringify({ schema: 1, product: "deepcode", version, assets: [{ name: "opencode-linux-x64.tar.gz", sha256: "a".repeat(64) }] }),
      ),
    ).toThrow("non-DeepCode asset")

    expect(() =>
      parseReleaseManifest(
        JSON.stringify({
          schema: 1,
          product: "deepcode",
          version,
          assets: [
            { name: asset, sha256: "a".repeat(64) },
            { name: asset, sha256: "b".repeat(64) },
          ],
        }),
      ),
    ).toThrow("duplicate asset")

    expect(() =>
      parseReleaseManifest(JSON.stringify({ schema: 1, product: "deepcode", version, assets: [{ name: asset, sha256: "invalid" }] })),
    ).toThrow("invalid checksum")
  })

  test("downloads only the manifest-selected asset and verifies SHA-256", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname
        if (pathname.endsWith("/deepcode-manifest.json")) {
          return Response.json({
            schema: 1,
            product: "deepcode",
            version,
            assets: [{ name: asset, sha256: sha256(bytes) }],
          })
        }
        if (pathname.endsWith(`/${asset}`)) return new Response(bytes)
        return new Response("missing", { status: 404 })
      },
    })

    try {
      const downloaded = await downloadVerifiedRelease(version, {
        releaseBaseUrl: server.url.toString(),
        platform: "linux",
        architecture: "x64",
      })
      expect(downloaded.asset.name).toBe(asset)
      expect(downloaded.bytes).toEqual(bytes)
    } finally {
      server.stop(true)
    }
  })

  test("rejects interrupted downloads and wrong hashes without returning an asset", async () => {
    const interrupted = Bun.serve({
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname
        if (pathname.endsWith("/deepcode-manifest.json")) {
          return Response.json({
            schema: 1,
            product: "deepcode",
            version,
            assets: [{ name: asset, sha256: sha256(bytes) }],
          })
        }
        return new Response("partial", { status: 503 })
      },
    })

    try {
      await expect(
        downloadVerifiedRelease(version, {
          releaseBaseUrl: interrupted.url.toString(),
          platform: "linux",
          architecture: "x64",
        }),
      ).rejects.toThrow("HTTP 503")
    } finally {
      interrupted.stop(true)
    }

    const wrongHash = Bun.serve({
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname
        if (pathname.endsWith("/deepcode-manifest.json")) {
          return Response.json({
            schema: 1,
            product: "deepcode",
            version,
            assets: [{ name: asset, sha256: "0".repeat(64) }],
          })
        }
        return new Response(bytes)
      },
    })

    try {
      await expect(
        downloadVerifiedRelease(version, {
          releaseBaseUrl: wrongHash.url.toString(),
          platform: "linux",
          architecture: "x64",
        }),
      ).rejects.toThrow("checksum mismatch")
    } finally {
      wrongHash.stop(true)
    }
  })

  test("restores the previous binary when post-replacement verification fails", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "deepcode-upgrade-"))
    const executable = path.join(directory, "deepcode")
    const candidate = path.join(directory, "candidate")
    await fs.writeFile(executable, "old")
    await fs.writeFile(candidate, "new")
    let calls = 0

    try {
      await expect(
        replaceBinaryAtomically(executable, candidate, version, {
          verifyBinary: async () => {
            calls += 1
            if (calls === 2) throw new Error("installed smoke failed")
          },
        }),
      ).rejects.toThrow("installed smoke failed")
      expect(await fs.readFile(executable, "utf8")).toBe("old")
      expect(await fs.access(`${executable}.previous`).then(() => true, () => false)).toBe(false)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  test("rejects install manifests that could delete files outside .deepcode", () => {
    const executable = path.join(os.tmpdir(), ".deepcode", "bin", "deepcode")
    expect(() =>
      parseInstallManifest(
        JSON.stringify({ schema: 1, product: "deepcode", version, files: [path.join(os.tmpdir(), ".opencode", "bin", "opencode")] }),
        executable,
      ),
    ).toThrow("outside the verified DeepCode install file set")
  })
})
