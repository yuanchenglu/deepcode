#!/usr/bin/env bun

throw new Error(
  [
    "Legacy package-manager, container, AUR, and Homebrew publishing is disabled for DeepCode Alpha.",
    "S1-03 permits only DeepCode-owned GitHub Release artifacts produced by script/build.ts.",
    "Do not restore anomalyco/opencode, npm, brew, choco, scoop, AUR, or GHCR fallbacks.",
  ].join(" "),
)
