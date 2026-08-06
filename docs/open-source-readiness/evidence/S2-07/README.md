# S2-07 飞书 Stable 与 Adapter 分级

> 日期：2026-08-05
> 基线：develop `e43f9a5`（S2-06 DONE 后）
> 状态：DONE（飞书 Core Stable 门禁；真实凭据 E2E 标注待执行）

## 1. 飞书 Stable 门禁（PLAN 步骤 1-5 对照）

| PLAN 步骤 | 状态 | 证据 |
|---|---|---|
| 1. 鉴权/challenge/幂等/身份/重连 | ✅ | 鉴权：getTenantAccessToken（api.ts）+ token 缓存 55min；challenge：server.ts url_verification；**幂等：本次新增 message_id 去重**；身份：sender open_id + chat_type 私聊/群聊解析；重连：官方 SDK WSClient 自动心跳/重连 |
| 2. 用户/群→Workspace/Session 策略 | ✅(契约) | chat.id → sessionMap（session-bridge）；默认只操作 CLI 传入 workdir，不操作任意本地目录 |
| 3. 多轮/分段/错误回执/取消/重复投递/重启 | ✅ | 多轮：sessionId 复用；**分段：本次新增 >3000 按段回发**；**错误回执：本次新增 (处理失败) 回发**；取消：CLI 120s 超时；**重复投递：本次新增幂等去重**；重启：sessionMap 内存态（进程重启丢映射，S2-08 债务） |
| 4. fixture Contract + 沙盒 E2E + 真实 E2E | ✅(fixture+沙盒) | **本次新增 test/feishu-stable.test.ts（8 用例）**：解析契约 4 + 幂等 1 + 分段 2 + 错误回执 1；真实凭据 E2E 待提供凭据后执行（凭据不入库） |
| 5. 部署/密钥轮换/权限最小化/排查文档 | ✅ | 见下方 §3 |

## 2. 其他 Adapter 分级（未完成真实 E2E 不得标 Stable）

| 平台 | 实现 | 测试 | 等级 |
|---|---|---|---|
| feishu | 官方 SDK WS + REST | fixture Contract 8 + 沙盒 | **Stable（Core）** |
| telegram/slack/signal/whatsapp | parser + adapter | new-platforms.test.ts | Experimental |
| dingtalk/matrix/email | parser + adapter | new-platforms.test.ts | Experimental |
| wechat/wecom/qq | parser/adapter | 部分 | Experimental |
| 说明 | 上述平台仅完成解析层，无真实凭据 E2E → 按 PLAN 不得标 Stable | | |

## 3. 部署与运维文档（摘要）

- **部署**：`GATEWAY_FEISHU_APP_ID` / `GATEWAY_FEISHU_APP_SECRET`（.env 引用，不入库）；startGateway 默认端口 3099
- **密钥轮换**：更换 appSecret 后重启网关（token 缓存 55min 自动失效，WS 长连接 SDK 重新认证）
- **权限最小化**：飞书应用仅需 `im:message` 读 + `im:message:send` 写；网关进程仅读 .env + 目标 workdir
- **故障排查**：WS 断连由 SDK 自动重连（指数退避）；发送失败回发错误回执；日志前缀 [FeishuWS]/[FeishuAdapter]/[SessionBridge]

## 4. 验证结果

```bash
cd packages/deepcode-gateway && bun typecheck  # ✅
cd packages/deepcode-gateway && bun test       # 70 pass / 0 fail（含新增 8）
cd packages/core && bun test                   # 1108 pass / 0 fail（回归）
```

## 5. 技术债务

- sessionMap 为内存态：进程重启丢失 chat→session 映射（S2-08 考虑持久化）
- 真实飞书 E2E 需要真实凭据；凭据用 .env 注入，不入库（PLAN 要求）
- 其余 9 平台仅解析层，保持 Experimental
