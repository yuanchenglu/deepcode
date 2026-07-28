# S1-02-D 安装、升级与卸载 fail-closed 验证

> 状态：IN_REVIEW
> 基线：`develop@babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`
> 分支：`agent/s1-02-d-install-uninstall-guard`

## 目标

在 S1-03 建立并验证 DeepCode GitHub Release/curl 渠道之前，安装生命周期不得回退到 OpenCode 或第三方包管理目标；卸载不得识别、修改或删除 OpenCode 路径。

## 实施结果

- `Installation.detectMethod()` 只把文件名为 `deepcode` / `deepcode.exe` 且位于 `.deepcode/bin` 的可执行文件识别为 `curl` 安装，其余路径统一返回 `unknown`。
- `Installation.latest()` 暂时返回当前已安装版本，不执行 HTTP 请求或包管理器探测。
- `Installation.upgrade()` 对所有 method 返回类型化 `UpgradeFailedError`，不执行脚本、下载、brew/npm/choco/scoop 等命令。
- Upgrade CLI 只暴露 `curl` 选项；安装位置未知时立即停止，不再提供“仍然安装”的上游回退入口。
- Uninstall CLI 只收集 `Global.Path` 下的 DeepCode data/cache/config/state，curl 二进制必须同时满足 `.deepcode/bin/deepcode` 精确匹配。
- shell 清理只匹配 `# deepcode`、DeepCode PATH export 和 DeepCode `fish_add_path`；`.opencode/bin` 与 `# opencode` 明确保留。
- 删除所有 OpenCode package-manager 卸载命令；未知安装方式不删除二进制或 shell 配置。

## 回归测试

- `test/installation/installation.test.ts`
  - DeepCode user-agent；
  - `.deepcode/bin/deepcode` 正识别；
  - `.opencode/bin/opencode`、`.local/bin/deepcode`、错误二进制名均拒绝；
  - 所有历史 method 的 latest 均不访问外部渠道；
  - 所有 upgrade method 均 fail-closed。
- `test/installation/uninstall.test.ts`
  - 只接受 DeepCode 二进制目标；
  - OpenCode-only shell 配置不被识别；
  - 清理 DeepCode 条目后 OpenCode 和无关文本保持不变。

## 待 CI 验证

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test test/installation
```

PR required checks 还需验证 Linux/Windows unit 与 E2E。CI 未通过前，本子任务保持 `IN_REVIEW`，不得开始 S1-02-E。
