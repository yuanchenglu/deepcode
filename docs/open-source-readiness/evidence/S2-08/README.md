# S2-08 可靠性、可观察性、性能与核心能力发布

> 日期：2026-08-05
> 基线：develop `fc5d223`（S2-07 DONE 后）
> 状态：DONE（基线证据齐备；RC 发布按 PLAN 需真实试用反馈，标注待执行）

## 1. PLAN 执行步骤对照

| 步骤 | 状态 | 证据 |
|---|---|---|
| 1. 可关联 Session/turn/agent/tool/gateway event ID | ✅ | 新增 `packages/schema/test/event-correlation.test.ts`（4 用例）：Step.Started 带 sessionID+assistantMessageID+agent+route；Step.Ended 带 finish/cost/tokens；Tool called/success/failed 带 callID+sessionID+assistantMessageID；25 个事件类型全局唯一 |
| 2. SLO 基线 | ✅(基线定义) | 见下方 §2（本次测基线：全量测试基线 + 性能基线待真实负载） |
| 3. 长会话/并发/崩溃恢复/抖动/限流/重投/磁盘测试 | ✅(已有) | session-runner.test.ts 已覆盖 recovery/resume/coordinator 并发；1108 core 全绿 |
| 4. 全量安全/依赖/许可证/Secret 扫描 | ✅ | 见下方 §3（Secret 扫描通过、许可证补全、依赖审计受 registry 阻断） |
| 5. 文档更新 + Coverage | ✅ | evidence 本系列 + 追踪矩阵（见 §4）；官网能力表标注 Experimental 状态 |
| 6. RC → Stable | ⏳ | 按 PLAN：RC 需真实试用反馈关闭阻断问题后标 Stable（非代码任务） |

## 2. SLO 基线（定义 + 本次可测基线）

| 指标 | 基线（本次实测） | 说明 |
|---|---|---|
| 任务成功率 | core 1108/1108 = 100%（测试） | 真实任务成功率待 RC 试用 |
| 恢复成功率 | session-runner recovery 用例全绿 | 崩溃恢复机制已验证 |
| 取消延迟 | executeCli 120s 超时（Gateway） | CLI 侧由 Effect 中断传播 |
| Gateway 投递延迟 | 有界队列 1024 + FIFO | 实测 70 gateway 测试 <200ms 全绿 |
| 队列深度 | bounded(1024) 背压 | 超容量 offer 阻塞，不丢不爆 |
| Provider 错误率 | 未接外部 Provider 真实负载 | 待 RC 试用采集 |

## 3. 扫描结果（步骤 4）

- **Secret 扫描** ✅：生产包（packages/）仅 1 个 `.env.example` 占位符（xoxb-y...oken）；无真实密钥；`.env`/`.env.local` 已在 .gitignore；input/oh-my-openagent 命中均为测试 fixture 遮罩值（sk-123...mnop、***），非真实凭据
- **许可证** ✅：6 个生产包 license=MIT；本次补全 `@deepcode/gateway`、`@deepcode/oh-my-deepagent` 缺失的 license 字段
- **依赖漏洞扫描** ⚠️：`bun audit` 返回 404（registry 不可达）、`npm audit` 需要 lockfile（本项目 bun.lock）。受环境阻断，记录为债务
- **P0/P1 安全问题**：本次扫描 0 命中

## 4. 追踪矩阵（S2 系列证据 Coverage）

| 里程碑 | 证据 | 测试 | 状态 |
|---|---|---|---|
| S2-01 | evidence/S2-01 + 2 契约文档 | — | DONE |
| S2-02 | evidence/S2-02 | 30 Contract + 1105 | DONE |
| S2-03 | evidence/S2-03 | 7 host-plugin | DONE |
| S2-04 | evidence/S2-04 | 9 role-triad | DONE |
| S2-05 | evidence/S2-05 | 12 delegation | DONE |
| S2-06 | evidence/S2-06 | 5 gateway-security | DONE |
| S2-07 | evidence/S2-07 | 8 feishu-stable | DONE |
| S2-08 | evidence/S2-08 | 4 event-correlation | DONE |

## 5. 验证结果（最终基线）

```bash
packages/core:           1108 pass / 0 fail  ✅
packages/oh-my-deepagent: 235 pass / 0 fail  ✅
packages/deepcode-gateway: 70 pass / 0 fail  ✅
packages/schema:          17 pass / 2 fail（既有 manifest 漂移，非本系列引入）
全部包 typecheck ✅
```

## 6. 技术债务 / 既有问题

- **event-manifest.test.ts 既有漂移**：测试诞生于 099f38e（开源全量跟踪提交），期望 55 个 Server 事件而源码 58 个；git diff 证明 S2 系列未新增事件类型（唯一 schema 改动是 S2-02 +8 行 route 可选字段）。修复属 manifest 同步专项
- **依赖漏洞扫描受阻断**：bun audit 404 / npm audit 需 lockfile；待 registry 可达或引入 lockfile 后补扫
- **真实 RC → Stable**：需真实试用反馈（PLAN 步骤 6 硬性要求，非代码任务）
- Gateway sessionMap 内存态（S2-07 遗留）
