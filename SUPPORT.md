# Support

## 获取帮助

- **GitHub Issues**: https://github.com/yuanchenglu/deepcode/issues
- **邮件**: yuanchenglu001@gmail.com

## 常见问题

### 安装

DeepCode Alpha 阶段通过 GitHub Release 安装，不通过 npm。请参考 README 中的安装说明。

### 与 OpenCode 共存

DeepCode 与 OpenCode 完全隔离。两者可以同时安装在同一台机器上，互不影响。

- DeepCode 使用 `~/.deepcode/` 目录
- OpenCode 使用 `~/.opencode/` 目录
- DeepCode 不读取 OpenCode 的配置、数据库或插件

### 报告 Bug

请通过 GitHub Issues 报告 Bug，包含：

1. DeepCode 版本（`deepcode --version`）
2. 操作系统和架构
3. 复现步骤
4. 预期行为和实际行为
5. 错误日志（脱敏后）
