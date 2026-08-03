# DeepCode ⚡

<strong>把你的 DeepSeek V4 模型武装成顶级的 AI 编程助手。</strong>

<br>

> **Alpha 状态**：DeepCode 正在准备首个可信 Release。安装命令将在 Release 准备就绪后更新。

<br>

<a href="https://github.com/yuanchenglu/deepcode/blob/develop/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" /></a>
<a href="https://github.com/yuanchenglu/deepcode/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/yuanchenglu/deepcode?style=social" /></a>

---

## 你是不是也有这种感觉？

你试过在 AI 编程助手里用 DeepSeek V4，但总感觉差点意思？

- **模型的能力没完全发挥** —— reasoning_effort、thinking 模式这些 V4 的独有能力，在大多数工具里跟"不支持"没区别
- **复杂项目越聊越乱** —— Agent 经常"忘了"前面说过什么，自己写的代码自己解释不了
- **想要飞书/微信上管理代码** —— 不想每次都开终端，能在聊天框里管代码吗？

**DeepCode 就是这些问题的答案。** 不是又一个 OpenCode 换皮，是专为 DeepSeek V4 做了全栈适配。

---

## 三个你该选 DeepCode 的理由

### 1. DeepSeek V4 除了它，没有替代品

DeepCode 是唯一一个对 DeepSeek V4 做了**全栈适配**的编程助手：

- `reasoning_effort` 三级控制：简单任务轻推理省 Token，复杂任务深推理保质量
- thinking 模式深度集成：不光能用，还能帮你管理推理过程的消耗
- DSML 工具调用格式原生支持：V4 专属的 XML 标记格式，不走弯路

对比其他工具：它们要么不支持，要么当通用模型对待——V4 怎么想的它不知道。

### 2. 14 个 Harness 模块让 AI 不乱来

DeepCode 内置了从 llm-harness-agent 研究成果中提炼的 **14 个控制模块**：

| 模块 | 作用 |
|------|------|
| 意图路由 | 自动识别你是要重构、Debug 还是写新代码，匹配不同策略 |
| 模型路由 | Flash-first 省钱策略，复杂问题自动切 Pro |
| 免疫审查 | Agent 说了"不做什么"之后自动检查是否遵守 |
| 级联规划 | 改了计划中的一个步骤，自动修正对其他步骤的影响 |
| …… | 更多模块见 `packages/core/` |

说白了就是：**模型只负责"想"，Harness 保证它"不乱来"。**

### 3. 飞书/微信里也能写代码

不想开终端？DeepCode 支持通过飞书和微信消息网关跟 Agent 对话：

```
你（在飞书里）：帮我看看生产环境的报错日志
DeepCode：正在分析……找到问题了，第 42 行有个空指针，需要加个 null check
```

纯 TypeScript 实现，无 Python 桥接依赖，部署简单。

---

## 快速开始

> Alpha 阶段通过 GitHub Release 安装。首个 Release 准备中。

```bash
# Alpha 安装（Release 准备就绪后启用）
# curl -fsSL https://github.com/yuanchenglu/deepcode/releases/latest/download/install.sh | bash

# 配置 API Key
export DEEPSEEK_API_KEY=your_key_here

# 启动对话
deepcode
```

配置参考 `docs/` 目录下的示例。

---

## 和 OpenCode 的关系

DeepCode 基于 [OpenCode](https://github.com/anomalyco/opencode) 二次开发，在保持核心架构的基础上做了五件事：

1. **DeepSeek V4 深度适配** — reasoning_effort、thinking 模式、DSML 格式全部原生支持
2. **14 个 Harness 模块接入主流程** — 不是简单的功能列表，是深度嵌入
3. **飞书/微信消息网关** — 纯 TypeScript，零 Python 依赖
4. **多轮会话续接** — Session Bridge 让长篇对话不断上下文
5. **所有深度优化全在 Effect TS 强类型层** — 编译期就拦住问题，不用跑到运行时才发现

---

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

---

## 许可证

MIT。详见 [LICENSE](LICENSE)。

DeepCode 基于 OpenCode (MIT) 进行二次开发，保留原作者版权。

---

> ⭐ 觉得有用？点个 Star，让更多人发现 DeepSeek V4 编程助手的正确用法。
