# Security Policy

## 报告安全漏洞

如果你发现了安全漏洞，请**不要**在 GitHub Issue 中公开报告。

请通过以下方式私密报告：

1. 使用 GitHub 的 [Security Advisories](https://github.com/yuanchenglu/deepcode/security/advisories/new) 功能创建私密报告
2. 或发送邮件至 yuanchenglu001@gmail.com，标题前加 `[SECURITY]`

## 响应预期

- 收到报告后 48 小时内确认
- 7 天内提供初步评估
- 修复发布后公开致谢（如报告者同意）

## 威胁模型

### 概述

DeepCode 是基于 DeepSeek V4 的 AI 编程助手，在本地运行。它提供 Agent 系统和工具（Shell 执行、文件操作、Web 访问）。

### 无沙箱

DeepCode **不**对 Agent 做沙箱隔离。权限系统作为 UX 功能存在，帮助用户了解 Agent 正在执行的操作。如果你需要真正的隔离，请在 Docker 容器或虚拟机中运行 DeepCode。

### 权限边界

- DeepCode 与 OpenCode 完全隔离：不读取 OpenCode 配置、数据库或插件
- 安装/卸载只操作 `~/.deepcode/` 目录，不碰 OpenCode 数据
- Alpha 阶段升级 fail-closed：无可信 Release 时不执行上游下载

## 支持的版本

| 版本 | 支持状态 |
|------|---------|
| Alpha (v0.1.0-alpha.x) | 安全修复 |
| Beta (v0.1.0-beta.x) | 安全修复 |
| Stable | 计划中 |

## 安全措施

- Release 制品包含 SHA-256 校验和
- 安装器验证哈希后原子替换
- 升级保留旧版本可回滚
- 卸载保留用户数据，不模糊删除
- deny 权限规则不可被旁路（预批准只允许显式 allow）
