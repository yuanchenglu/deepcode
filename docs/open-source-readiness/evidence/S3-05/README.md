# S3-05 核心 WebUI 与应用壳（切片 2：核心任务验证）

> 日期：2026-08-05
> 基线：develop `1fe594e`（S3-05 切片 1 后）
> 状态：IN_PROGRESS（切片 1 壳修复 DONE；切片 2 核心任务验证 DONE；Sidebar 结构留待设计验收）

## 2. 切片 2：核心任务验证（T1/T2/T3 在新壳下）

按 PONYTAIL 审计：S3-05 剩余切片（首次启动/Session/Composer/计划/diff/权限/设置）**大多已有完整实现**（NewHome 1658 行、new-session、providers.tsx 空状态、settings-v2/providers.tsx）——复用，不重写。真实缺口仅在壳层（已修）。

**验证结果（浏览器 chromium headless 1280×720，playwright-core 1.59.1 rev 1217）：**

| 任务 | e2e | 结果 |
|---|---|---|
| T2 发起任务 | new-session-panel-corner | 1 pass |
| T1 打开项目/会话 | session-list-path-loading | 1 pass |
| T3 审查修改 | review-line-comment（5 用例） | 5 pass |
| 壳层（切片 1） | session-timeline smoke（5 用例） | 5 pass |

**合计 12/12 e2e 全绿**；app unit 537 pass。

## 3. 审计结论（S3-05 剩余工作）

| 切片 | 状态 | 说明 |
|---|---|---|
| 应用壳/导航 | ✅ 切片 1 | Suspense fallback + ErrorBoundary |
| 首次启动/Provider | ✅ 已有 | new-session 完整 UI + providers.tsx 空状态文案 |
| Session/Composer | ✅ 已有 | session.tsx 完整 + e2e 覆盖 |
| 计划/子 Agent | ✅ 已有 | 依赖 S2-05 delegation 运行时（S2-08 记录） |
| diff/review | ✅ 已有 | review-* e2e 5 用例全绿 |
| 权限/错误 | ✅ 已有 | 权限弹层 + 错误边界（切片 1） |
| 设置 | ✅ 已有 | settings-v2/providers.tsx + useSettingsCommand |
| **Sidebar 常驻导航** | ⏳ 待设计验收 | 方向 A 新增结构，非修复；需高保真原型批准后实施 |

## 4. 技术债务

- Sidebar 导航结构（方向 A）：依赖设计验收，不抢跑（PLAN 步骤 2 顺序）
- Legacy 布局仍保留（feature flag 控制，newLayoutDesigns 默认开启）；收敛删除待 S3-06 后按 PLAN 步骤 1 处理

