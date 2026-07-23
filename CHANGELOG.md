# Changelog

## 2026-07-23 第35期整合

### Gateway（packages/deepcode-gateway/）
- 来源主体：617-2255-husk-2（评分24/30）
- 补充来源：617-2254-goblet-2（7个额外平台适配器 + crypto/ 通用模块）
- 变更：2平台 -> 11平台（新增 wecom/qq/telegram/slack/signal/whatsapp/dingtalk/matrix/email）
- 核心文件扩展：adapter.ts(handleWebhook+crypto)、config.ts(11配置接口)、message.ts(12平台类型+sourceAdapter)、router.ts(9平台路由)、lifecycle.ts(多适配器)、server.ts(handleWebhook路由)、session-bridge.ts(多适配器回复)
- 测试：1个 -> 7个测试文件

### Agent（packages/oh-my-deepagent/）
- 来源主体：616-2252-ether-2（49源文件 + transport/ 模块）
- 补充来源：616-2251-husk-2（DeepSeek适配器 + coordinator + search + event-bus + task-graph）
- 角色改名：去掉Agent后缀（codingAgent -> coding 等）
- 角色补全：新增 oracle/metis/momus/multimodal/artistry 5个角色
- 总角色数：13个（8原有+5新增）
- 测试：208 pass / 0 fail
