# S2-06 Gateway Core 安全和生命周期

> 日期：2026-08-05
> 基线：develop `b2a4fa4`（S2-05 DONE 后）
> 状态：DONE（Core 安全整改；飞书 Stable 在 S2-07）

## 1. PLAN 已知风险审计结果（源码确认）

| PLAN 风险 | 源码位置 | 确认 |
|---|---|---|
| Adapter 未完整传入 server | lifecycle.ts:59 `startServer(port, router)` | ✅ 确认：签名校验不可达 |
| Queue 无界 | lifecycle.ts:42 `Queue.unbounded` | ✅ 确认 |
| 首 Adapter 抢回复 | lifecycle.ts:62 `adapters.values().next().value` | ✅ 确认 |
| timeout 在 stream 读取后 | session-bridge.ts:181-195 | ✅ 确认（已内置 120s 超时赛跑，修复保留） |

## 2. 修复内容

### 2.1 有界队列（背压保护）
- `lifecycle.ts`: `Queue.unbounded` → `Queue.bounded(1024)`
- 超过容量时 offer 阻塞，由消费循环自然形成背压，防止内存无界增长

### 2.2 回发路由回原 source adapter（不抢回复）
- `session-bridge.ts` `processMessage`：签名改为 `(msg, workdir, adapters)`，按 `msg.sourceAdapter` 查找对应适配器回发
- 无 sourceAdapter 时回退第一个适配器（兼容旧行为）
- `startMessageConsumer` 接收完整 adapters map

### 2.3 Server 传入 adapters（签名校验可达）
- `lifecycle.ts`: `startServer(port, router, adapters)`——平台签名校验（adapter.handleWebhook）现在可达

## 3. 测试（新增 `test/gateway-security.test.ts`，5 用例）

- 有界队列：正常写读 FIFO；容量满时 offer 背压等待
- 回发路由：sourceAdapter 命中来源而非第一个注册；无 source 回退第一个
- startServer 签名接受 (port, router, adapters?) 三参数（编译期契约）

## 4. 验证结果

```bash
cd packages/deepcode-gateway && bun typecheck  # ✅
cd packages/deepcode-gateway && bun test       # 62 pass / 0 fail（含新增 5）
cd packages/core && bun typecheck              # ✅
cd packages/opencode && bun typecheck          # ✅
```

## 5. PLAN 执行步骤对照

| 步骤 | 状态 | 说明 |
|---|---|---|
| 1. 默认关闭/loopback | ⏳ 配置 | 飞书 Stable 时一并落实（S2-07） |
| 2. 平台签名/时间窗/Replay/幂等/大小限制 | ⏳ 适配器层 | adapter.handleWebhook 签名校验已可达；具体实现 S2-07 飞书优先 |
| 3. 身份→用户→Workspace→Session 映射 | ⏳ S2-07 | sessionMap 已存在，显式映射策略随飞书 Stable |
| 4. Queue 有界/背压/并发/公平 | ✅ | bounded(1024) + 消费循环 |
| 5. timeout 覆盖流生命周期；shutdown 等待 in-flight | ✅ | executeCli 120s 超时赛跑 + forkScoped 随 Scope 终止 |
| 6. Delivery 路由回原 source adapter | ✅ | sourceAdapter 回发 + fallback |
| 7. Gateway Tool 走 Host Permission | ⏳ S2-07 | 当前 CLI 子进程执行由 Host 权限控制 |

## 6. 技术债务

- 平台签名/幂等/大小限制的具体实现在 S2-07（飞书 Stable 门禁）
- 显式身份→Workspace 映射策略待 S2-07
- Gateway 默认 loopback 与公网警告属配置面，随部署文档（S2-07）
