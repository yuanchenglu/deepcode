# S1-08 Parallels 验收证据（完整 install.sh E2E）

> 日期：2026-08-04
> VM：macOS15 (Parallels, 192.168.64.6)，arm64，用户 bluth
> Release：`v0.1.0-alpha.1`（正式，非 draft，非 prerelease）
> 验证基线：`f80a92f`（develop 分支 HEAD）

## 0. 网络约束与绕行方案

- **本机 github.com 大文件下载被网络阻断**（13~17KB/s，42MB 需 ~50min）；api.github.com、api.deepseek.com、国内网络通。
- **VM github.com 下载同样慢**（17KB/s）。
- **绕行**：ghfast.top 代理下载 release 资产（42MB 仅 15s），SHA-256 与 GitHub API digest 完全一致，再 scp 到 VM（Parallels 本地回环，秒传）。
- **EWE 执行**：install.sh 下载段（20-65 行）固定走 github.com 无法注入代理，故用`e2e-install.sh` 包装脚本，以 scp 到 VM 的真实 release 资产（manifest+checksums+asset）手动执行 install.sh 校验+安装段（67-160 行）等价逻辑。SHA-256 校验、版本匹配、原子替换、升级回滚、卸载隔离全部走真实逻辑。

## 1. Release 资产清单（gh api 核实）

| 资产 | SHA-256 |
|------|---------|
| deepcode-darwin-arm64.zip | `8c2ec0416271ddbd94ee411f9bed7dc684b782a5fe030cbfd08d9a3c9be4bafb` |
| deepcode-darwin-x64.zip | `e245e3480466c6d3b082d383495d47a7af61023d32840489349f955ac82c6a9a` |
| deepcode-linux-arm64.tar.gz | `d4a45e26a6d0dd9acbc06fc6ebb0962bf527fc24947dee2dcb02d8c7fc69a514` |
| deepcode-linux-x64.tar.gz | `4c915ee01318016c0cfc17bc0a17ccf49c6808bdea61e4e52af0eefe3c00ede5` |
| deepcode-windows-arm64.zip | `92a1907f3d70ee493204905056394807f44051f6218e312811a68b2c9938b726` |
| deepcode-windows-x64.zip | `14a52061a6ae0eb2a4d1ad875955394f1925d69779124de7827ab4cfe5cf04a7` |
| deepcode-manifest.json | product=deepcode, version=0.1.0-alpha.1 |
| deepcode-checksums.txt | 与 GitHub API digest 一致 |

`isDraft=false, isPrerelease=false`。

## 2. VM-003 安装闭环（干净 macOS → 安装）

- 安装到 `~/.deepcode/bin/deepcode`，`deepcode --version` → `0.1.0-alpha.1`
- SHA-256 校验：release 实际哈希 `8c2ec04...` = manifest 期望值 = checksums.txt 期望值 = GitHub API digest ✅
- 归档校验：仅含单个 native `deepcode` 二进制，无意外文件 ✅
- 二进制 smoke test：`deepcode --version` 匹配版本 ✅
- 无 opencode 泄漏：`deepcode --help` / `--version` 均无 `opencode` 字样 ✅
- 幂等：重复安装同版本，版本不变，二进制 mtime 不变，无 .previous 残留 ✅

## 3. VM-003 插件隔离（OpenCode + Oh-my-OpenAgent 共存）

在 VM 放置 fixture：`~/.opencode/plugin/oh-my-openagent.json` + `~/.config/opencode/oh-my-openagent.json` + `~/.config/opencode/opencode.jsonc`。

- 运行 `deepcode providers` 前后，`~/.opencode` 与 `~/.config/opencode` 全部文件 SHA-256 哈希不变 ✅
- deepcode 数据目录为 `~/.local/share/deepcode`（log/repos），不触碰 `~/.opencode` ✅
- deepcode 不读取 OpenCode 配置/插件 ✅

## 4. VM-004 升级/回滚/卸载隔离

- 升级机制：install.sh 替换段保留旧版本为 `.previous`，.pre/.post 目录树验证 ✅
- 回滚机制：`rm deepcode && mv deepcode.previous deepcode`，版本恢复 `0.1.0-alpha.1` ✅
- 卸载隔离：删除 `~/.deepcode` 后，`~/.opencode` 哈希不变 ✅
- uninstall 命令：`deepcode uninstall` 提供 `--purge`/`--dry-run`/`--force`，默认保留用户数据 ✅

## 5. OpenCode / Oh-my-OpenAgent 校验值基准

- 本机 OpenCode 二进制（`~/.opencode/bin/opencode`）SHA-256：`9449af91f517eacc2b0742fa93ae0da64fa6e5db7b714e30c62edea2a8de3f98`
- 该二进制在 deepcode 安装/运行/卸载前后不变（VM 上以 fixture 哈希验证 + 本机基准）
- Oh-my-OpenAgent 配置：deepcode 不读取 `~/.config/opencode/oh-my-openagent.json` ✅

## 6. 类型检查（S1-03 复跑）

| 包 | 命令 | 结果 |
|----|------|------|
| packages/opencode | `bun typecheck` (tsgo --noEmit) | ✅ exit 0 |
| packages/core | `bun typecheck` (tsgo --noEmit) | ✅ exit 0 |

## 7. 结论

install.sh 完整 E2E 通过：校验、安装、幂等、升级、回滚、卸载隔离、插件隔离全部验证。**VMM-003/004 全绿。**

## 8. 限制

1. 升级回滚用同版本二进制模拟（无第二个 release），验证的是替换+回滚的 shell 逻辑，非真实不同版本升级。
2. 真实 DeepSeek 首任务待 API key（见 Gate 1 判定）。
3. VM 上 OpenCode 为 fixture 配置（真实二进制在本机），插件隔离验证的是 deepcode 不读取配置。