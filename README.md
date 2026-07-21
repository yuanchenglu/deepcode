# DeepCode

<p align="center">
  <strong>面向 DeepSeek V4 深度优化的 AI 编程助手</strong>
</p>

<p align="center">
  <a href="https://github.com/yuanchenglu/deepcode/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" /></a>
</p>

## 介绍

**DeepCode** 基于 [OpenCode](https://github.com/anomalyco/opencode) 二次改造，是专为深度适配 DeepSeek V4 模型而设计的 AI 编程助手。

### 核心价值

- **DeepSeek V4 深度优化** — 针对 DeepSeek V4 的 `reasoning_effort` 参数、thinking 模式等特性量身定制，充分发挥模型能力
- **Harness 级联约束系统** — 内置 14 个智能模块（意图路由、模型路由、窗口管理、Meta 指令、免疫审查、OKR 级联等），让 AI 生成代码更可控、更可靠
- **飞书/微信消息网关** — 支持通过飞书/微信与 AI 编程助手交互，随时随地管理代码任务
- **纯 TypeScript + Effect 框架** — 利用 Effect TS 的强类型系统保障运行时安全，无 Python 依赖

### 与 OpenCode 的关系

DeepCode 是 OpenCode 的派生项目（Fork），在保持 OpenCode 核心架构的基础上，进行了以下深度改造：

1. **DeepSeek V4 适配** — `reasoning_effort`、thinking 模式深度集成
2. **Harness 层深度接入** — 14 个 Harness 模块接入主流程（意图分类、模型路由、免疫审查、OKR 计划等），非简单的功能列表
3. **消息网关** — 飞书/微信消息网关，纯 TypeScript 实现
4. **多轮会话续接** — Session Bridge，支持消息网关场景下多轮会话上下文保持
5. **去除 Python 桥接依赖** — 保持纯 TypeScript 技术栈

## 快速开始

```bash
# 安装
npm install -g deepcode
# 或者
bun add -g deepcode

# 配置 DeepSeek API Key
export DEEPSEEK_API_KEY=your_key_here

# 启动
deepcode
```

## 配置

在项目根目录创建 `.opencode/opencode.jsonc`（沿用 OpenCode 配置格式），参考 `docs/` 目录下的示例配置。

## 项目结构

```
packages/
├── core/          # 核心逻辑：Harness 14 模块、Session 管理、Tool 注册
├── opencode/      # CLI 入口
├── deepcode-gateway/  # 消息网关（飞书/微信）
├── tui/           # 终端 UI 组件
├── schema/        # 数据模型定义
└── ...            # 其他辅助包
```

## 许可证

MIT License。详见 [LICENSE](LICENSE) 文件。

DeepCode 基于 OpenCode (MIT) 进行二次开发，保留原作者版权。
