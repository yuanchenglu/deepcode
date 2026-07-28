# S1-02-D 安装、升级与卸载 fail-closed 验证

> 状态：DONE
> 基线：`develop@babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`
> 分支：`agent/s1-02-d-install-uninstall-guard`
> 已验证实现 head：`874dc9c959ccd91320e46d3bf3675c2b30ee861e`
> Pull Request：#6 `fix(lifecycle): fail closed DeepCode install and uninstall boundaries`

## 目标

在 S1-03 建立并验证 DeepCode GitHub Release/curl 渠道之前，安装生命周期不得回退到 OpenCode 或第三方包管理目标；卸载不得识别、修改或删除 OpenCode 路径。

## 实施结果

- `Installation.detectMethod()` 只识别直接位于 `.deepcode/bin` 下的原生 DeepCode 二进制：Unix 为 `deepcode`，Windows 为 `deepcode` / `deepcode.exe`。
- 检测使用平台原生大小写语义；Unix 不接受 `.DeepCode/bin/DeepCode` 或 `deepcode.exe`，Windows 保持路径大小写不敏感。
- `.deepcode/bin/<subdir>/deepcode`、`.deepcode/bin-backup/deepcode`、`.opencode/bin/opencode`、`.local/bin/deepcode` 和错误二进制名全部返回 `unknown`。
- `Installation.latest()` 暂时返回当前已安装版本，不执行 HTTP 请求或包管理器探测。
- `Installation.upgrade()` 对所有 method 返回类型化 `UpgradeFailedError`，不执行脚本、下载、brew/npm/choco/scoop 等命令。
- Upgrade CLI 只暴露 `curl` 选项；安装位置未知时立即停止，不再提供上游回退入口。
- Uninstall CLI 只收集 `Global.Path` 下的 DeepCode data/cache/config/state；未知安装方式不删除二进制或 shell 配置。
- shell 清理按 PATH 分量解析，只删除精确 `.deepcode/bin` 条目；保留 `.opencode/bin`、`# opencode`、`.deepcode/bin-backup`、`.deepcode/bin-old` 和无关文本。
- 删除所有 OpenCode package-manager 卸载命令；不访问 OpenCode/anomalyco 下载源，不执行 OpenCode 包管理器命令。

## 回归测试

### `test/installation/installation.test.ts`

- DeepCode user-agent；
- Unix/Windows 原生二进制识别；
- 嵌套目录、相似目录、OpenCode、`.local/bin` 和错误二进制名拒绝；
- 平台大小写与 `.exe` 语义；
- 所有历史 method 的 latest 均不访问外部渠道；
- 所有 upgrade method 均 fail-closed。

### `test/installation/uninstall.test.ts`

- 只接受精确 DeepCode 二进制目标；
- OpenCode-only 和 DeepCode PATH 相似项不被识别；
- 清理 DeepCode 条目后 OpenCode、相似 PATH 和无关文本保持不变。

## CI 根因与修复记录

1. 审查发现原 shell 匹配使用字符串前缀，可能删除 `.deepcode/bin-*`；分类为 `PRODUCT_DEFECT`，已改为精确 PATH 分量解析并补回归。
2. 审查发现安装检测接受嵌套路径、Unix 大小写变体和 Unix `.exe`；分类为 `PRODUCT_DEFECT`，已按平台原生路径语义收紧。
3. 审计 unit artifact 发现 generic Turbo unit 未执行 `packages/opencode` 的 lifecycle tests；分类为 `TEST_DEFECT`。最终 workflow 在 Linux/Windows unit 中增加明确的 `packages/opencode/test/installation` 门禁和独立 artifact，不删除、跳过或降级原有 unit、E2E、generated client、HttpApi 检查。
4. 临时启用整个 `deepcode#test` 暴露 S1-02-C 遗留的 OpenCode 命名断言和 Windows Core snapshot 波动；这些不属于 S1-02-D 生命周期实现，已作为 S1-02-E 的第一项整包回归债务，不以修改产品回退路径换取通过。

## 最终验证

已验证实现 head：`874dc9c959ccd91320e46d3bf3675c2b30ee861e`

| 门禁 | GitHub Actions | 结果 |
| --- | --- | --- |
| Typecheck | workflow `typecheck` run #65，run id `30330973893` | SUCCESS |
| Linux unit | workflow `test` run #67，job `unit (linux)` | SUCCESS；Turbo 8/8 tasks |
| Windows unit | workflow `test` run #67，job `unit (windows)` | SUCCESS；Turbo 8/8 tasks |
| Linux lifecycle | `packages/opencode/test/installation` | 17 pass / 0 fail / 93 assertions |
| Windows lifecycle | `packages/opencode/test/installation` | 17 pass / 0 fail / 93 assertions |
| Generated client | `Check generated client` | SUCCESS |
| HttpApi | coverage / auth / effect exerciser gates | SUCCESS |
| Linux E2E | `e2e (linux)` | SUCCESS |
| Windows E2E | `e2e (windows)` | SUCCESS |

Artifacts：

- `unit-linux-1`：包含 `unit-linux.log` 与 `packages/opencode/installation-linux.log`；
- `unit-windows-1`：包含 `unit-windows.log` 与 `packages/opencode/installation-windows.log`；
- `httpapi-1`：包含 HttpApi 三模式日志。

## 结论

S1-02-D 的代码、回归和双平台门禁全部通过，证据状态为 `DONE`。PR #6 可 squash 合入 `develop`；S1-02-E 必须从合入后的最新 `develop` 独立实施，不得在本任务提前引入 S1-03 的 Release installer、制品、checksum、rollback 或 purge。
