# Contributing to DeepCode

欢迎为 DeepCode 贡献代码！以下是最常见的贡献类型：

- Bug 修复
- 新的 LSP / 格式化器支持
- LLM 性能改进
- 新 Provider 支持
- 环境特定问题修复
- 缺失的标准行为
- 文档改进

涉及 UI 或核心产品功能的改动必须先通过设计审查。

## 开发流程

1. Fork 仓库，从 `develop` 分支创建功能分支
2. 分支名最多三个短词，用连字符，不用斜杠（如 `fix-scroll-state`）
3. 提交信息用 Conventional Commit 格式：`type(scope): summary`
4. 正文包含双语说明（English + 简体中文）
5. PR 通过 CI（typecheck + test）后可合入

## 代码规范

- 使用 Bun 运行时和 TypeScript
- typecheck 从包目录运行：`cd packages/opencode && bun typecheck`
- 测试从包目录运行，不从仓库根目录运行
- 使用 Effect 4 的函数式风格
- 避免 `any` 类型
- 代码注释用简体中文

## 提交规范

```
type(scope): English summary | 简体中文摘要

English:
<what, why, verification>

简体中文:
<做了什么、为什么、如何验证>
```

有效 type：`feat`、`fix`、`docs`、`chore`、`refactor`、`test`。

## 项目结构

```
packages/
├── core/              # 核心逻辑：Harness 模块、Session 管理、Tool 注册
├── opencode/          # CLI 入口（deepcode 命令）
├── deepcode-gateway/  # 消息网关（飞书/微信）
├── tui/               # 终端 UI 组件
├── schema/            # 数据模型定义
└── ...
```

## 许可证

贡献的代码遵循 [MIT License](LICENSE)。
