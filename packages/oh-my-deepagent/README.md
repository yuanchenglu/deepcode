# DeepAgent

`@opencode-ai/deep-agent` 是 DeepCode 自有的 Agent 系统，参考 oh-my-openagent 架构思想
重新实现，**不与上游同步代码**。

## 六大子系统

| 模块 | 职责 |
|------|------|
| `runtime` | Agent 运行时：消息循环 + 工具调用调度 |
| `tool` | 工具：注册/查找/参数校验/内置工具 |
| `skill` | 技能：SKILL.md 目录加载、挂载、卸载 |
| `memory` | 记忆：会话消息列表 + 文件持久化 |
| `planning` | 规划：goal → steps 拆解 + 执行追踪 |
| `role` | 角色：coding-agent / builder-agent / knowledge-agent / planner-agent / system-agent |

## 最小使用

```ts
import {
  AgentRuntime, ToolRegistry, MemoryStore,
  RoleRegistry, defaultRoles, MockLLMProvider,
} from "@opencode-ai/deep-agent"

const registry = new ToolRegistry()
registry.register(echoTool)
const memory = new MemoryStore()
const role = new RoleRegistry().register(defaultRoles.codingAgent).get("coding-agent")!
const llm = new MockLLMProvider([
  { content: "你好，我是 coding-agent。" },
])

const agent = new AgentRuntime({ role, llm, registry, memory })
const result = await agent.chat("你好")
console.log(result.text)
```

## 测试

```bash
cd packages/deep-agent
bun test
```
