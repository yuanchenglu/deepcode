#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")

import { Script } from "@opencode-ai/script"
import pkg from "../package.json"

const singleFlag = process.argv.includes("--single")
const skipInstall = process.argv.includes("--skip-install")
const sourcemapsFlag = process.argv.includes("--sourcemaps")
const plugin = createSolidTransformPlugin()
const skipEmbedWebUi = process.argv.includes("--skip-embed-web-ui")

const createEmbeddedWebUIBundle = async () => {
  console.log("Building Web UI to embed in the binary")
  const appDir = path.join(import.meta.dirname, "../../app")
  const dist = path.join(appDir, "dist")
  await $`OPENCODE_CHANNEL=${Script.channel} bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".map"))
    .sort()
  const imports = files.map((file, i) => {
    const spec = path.relative(dir, path.join(dist, file)).replaceAll("\\", "/")
    return `import file_${i} from ${JSON.stringify(spec.startsWith(".") ? spec : `./${spec}`)} with { type: "file" };`
  })
  const entries = files.map((file, i) => `  ${JSON.stringify(file)}: file_${i},`)
  return [
    `// Import all files as file_$i with type: "file"`,
    ...imports,
    `// Export with original mappings`,
    `export default {`,
    ...entries,
    `}`,
  ].join("\n")
}

const embeddedFileMap = skipEmbedWebUi ? null : await createEmbeddedWebUIBundle()

const allTargets: {
  os: "linux" | "darwin" | "win32"
  arch: "arm64" | "x64"
  avx2?: false
}[] = [
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64", avx2: false },
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64", avx2: false },
  { os: "win32", arch: "arm64" },
  { os: "win32", arch: "x64", avx2: false },
]

const targets = singleFlag
  ? allTargets.filter((item) => item.os === process.platform && item.arch === process.arch)
  : allTargets

await $`rm -rf dist`

const binaries: Record<string, string> = {}
if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`
  await $`bun install --os="*" --cpu="*" @ff-labs/fff-bun@${pkg.dependencies["@ff-labs/fff-bun"]}`
}

for (const item of targets) {
  const platform = item.os === "win32" ? "windows" : item.os
  const name = `${pkg.name}-${platform}-${item.arch}`
  const target = ["bun", platform, item.arch, item.avx2 === false ? "baseline" : undefined].filter(Boolean).join("-")
  console.log(`building ${name}`)
  await $`mkdir -p dist/${name}/bin`

  const localPath = path.resolve(dir, "node_modules/@opentui/core/parser.worker.js")
  const rootPath = path.resolve(dir, "../../node_modules/@opentui/core/parser.worker.js")
  const parserWorker = fs.realpathSync(fs.existsSync(localPath) ? localPath : rootPath)
  const workerPath = "./src/cli/tui/worker.ts"
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")
  const binaryPath = `dist/${name}/bin/${pkg.name}${item.os === "win32" ? ".exe" : ""}`

  await Bun.build({
    conditions: ["bun", "node"],
    tsconfig: "./tsconfig.json",
    plugins: [plugin],
    external: ["node-gyp"],
    format: "esm",
    minify: true,
    sourcemap: sourcemapsFlag ? "linked" : "none",
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: target as any,
      outfile: binaryPath,
      execArgv: [`--user-agent=${pkg.name}/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    files: embeddedFileMap ? { "opencode-web-ui.gen.ts": embeddedFileMap } : {},
    entrypoints: ["./src/index.ts", parserWorker, workerPath, ...(embeddedFileMap ? ["opencode-web-ui.gen.ts"] : [])],
    define: {
      FFF_LIBC: JSON.stringify("gnu"),
      OPENCODE_VERSION: `'${Script.version}'`,
      OPENCODE_MODELS_DEV: generated.modelsData,
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      OPENCODE_WORKER_PATH: workerPath,
      OPENCODE_CHANNEL: `'${Script.channel}'`,
      OPENCODE_LIBC: item.os === "linux" ? `'glibc'` : "",
      ...(item.os === "linux" ? { "process.env.OPENTUI_LIBC": JSON.stringify("glibc") } : {}),
    },
  })

  if (item.os === process.platform && item.arch === process.arch) {
    console.log(`Running smoke test: ${binaryPath} --version`)
    const versionOutput = await $`${binaryPath} --version`.text().catch((error) => {
      console.error(`Smoke test failed for ${name}:`, error)
      process.exit(1)
    })
    console.log(`Smoke test passed: ${versionOutput.trim()}`)
  }

  await $`rm -rf ./dist/${name}/bin/tui`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: Script.version,
        preferUnplugged: true,
        os: [item.os],
        cpu: [item.arch],
      },
      null,
      2,
    ),
  )
  binaries[name] = Script.version
}

if (Script.release) {
  const repository = process.env.GH_REPO
  if (repository !== "yuanchenglu/deepcode") {
    throw new Error(`Refusing to publish DeepCode CLI artifacts to unverified repository: ${repository ?? "missing"}`)
  }

  const assets: { name: string; sha256: string }[] = []
  for (const key of Object.keys(binaries).sort()) {
    const extension = key.includes("linux") ? "tar.gz" : "zip"
    const file = `${key}.${extension}`
    if (extension === "tar.gz") await $`tar -czf ../../${file} *`.cwd(`dist/${key}/bin`)
    else await $`zip -r ../../${file} *`.cwd(`dist/${key}/bin`)
    assets.push({ name: file, sha256: await hashFile(`dist/${file}`) })
  }

  await Bun.file("dist/deepcode-manifest.json").write(
    `${JSON.stringify({ schema: 1, product: "deepcode", version: Script.version, assets }, null, 2)}\n`,
  )
  await Bun.file("dist/deepcode-checksums.txt").write(
    `${assets.map((asset) => `${asset.sha256}  ${asset.name}`).join("\n")}\n`,
  )
  await $`gh release upload v${Script.version} ./dist/deepcode-*.zip ./dist/deepcode-*.tar.gz ./dist/deepcode-manifest.json ./dist/deepcode-checksums.txt --clobber --repo ${repository}`
}

async function hashFile(file: string) {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(new Uint8Array(await Bun.file(file).arrayBuffer()))
  return hasher.digest("hex")
}

export { binaries }
