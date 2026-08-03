# S1-08 Parallels 验收证据

> 日期：2026-08-03
> VM：macOS15 (Parallels, 192.168.64.6)
> 构建：deepcode-darwin-arm64 v0.0.0-develop-202608032206

## VM-001 等价：干净 macOS 安装闭环

- 二进制从宿主机构建后 scp 到 VM
- `deepcode --version` 输出 `0.0.0-develop-202608032206`
- `deepcode --help` 显示 DeepCode 命令列表，无 OpenCode 泄漏
- 手动安装到 `~/.deepcode/bin/deepcode` 成功

## VM-002 等价：OpenCode 共存

- `~/.opencode` 目录在 DeepCode 安装前后 SHA-256 哈希不变：
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`（空目录）
- `~/.deepcode` 和 `~/.opencode` 同时存在，互不影响

## 身份隔离验证

- `deepcode --help` 无 `opencode` 字样：PASS
- `deepcode --version` 无 `opencode` 字样：PASS

## 卸载隔离验证

- 删除 `~/.deepcode` 后 `~/.opencode` 目录完整：PASS

## 限制

1. 未通过 install.sh 完整安装（无 GitHub Release 可用）
2. 未测试升级/回滚（需要 Release 管线运行）
3. 未测试真实 DeepSeek API 任务（需要 API Key）
4. VM 中 OpenCode 目录为空（无完整 OpenCode 安装）

## 结论

Alpha 阶段共存隔离和身份隔离验证通过。完整 Gate 1 需要首个 GitHub Release 后补充 install.sh 端到端测试。
