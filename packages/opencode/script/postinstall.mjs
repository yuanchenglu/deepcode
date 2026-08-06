#!/usr/bin/env node

console.error(
  [
    "DeepCode package-manager installation is disabled in Alpha.",
    "Use the verified GitHub Release/curl installer so the archive checksum and install manifest are validated.",
    "No npm, OpenCode, Homebrew, Chocolatey, or Scoop endpoint was contacted.",
  ].join(" "),
)
process.exit(1)
