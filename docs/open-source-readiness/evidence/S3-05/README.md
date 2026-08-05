# S3-05 核心 WebUI 与应用壳（第一切片：应用壳/导航）

> 日期：2026-08-05
> 基线：develop `2a5daad`（S3-04 DONE 后）
> 状态：IN_PROGRESS（第一切片 DONE：应用壳错误边界与加载态；后续切片待扩展）

## 1. 第一切片范围（PLAN 步骤 2：应用壳/导航）

按方向 A（收敛 New 壳）实施 app 壳层修复。基于 S3-01 审计对 layout-new.tsx 的 3 个发现：

| 审计发现 | 修复 |
|---|---|
| Suspense 无 fallback（L37）→ 路由切换白屏闪烁 | 新增 `LayoutFallback`（spinner + 加载中文案，role=status aria-live=polite） |
| 无错误边界 → 子页异常白屏 | 新增 `LayoutErrorBoundary`（SolidJS ErrorBoundary + 错误信息 + 重试按钮） |
| 反馈缺失（除 Titlebar 无状态提示） | 加载态/错误态均提供可见反馈 |

**未做（后续切片）**：Sidebar 导航结构（需设计验收后按垂直切片实施）、状态栏、首次启动流程——按 PLAN 步骤 2 顺序，壳→首次启动→Session 逐切片推进。

## 2. 测试记录

- **浏览器**：chromium headless shell（playwright-core 1.59.1 期望 revision 1217；本地缓存 1223 经软链提供，同架构 mac-arm64）
- **viewport**：playwright 默认 1280×720
- **视觉基线 commit**：本切片（2a5daad + 1）

```bash
cd packages/app && bun typecheck          # ✅
cd packages/app && bun test               # 537 pass / 0 fail
cd packages/app && bun run typecheck:e2e  # ✅
cd packages/app && bunx playwright test e2e/smoke  # 5 pass / 0 fail（session-timeline）
```

## 3. 与 PLAN 步骤对照

| 步骤 | 状态 |
|---|---|
| 1. 明确最终 Layout；不长期维持两套等价 UI | 方向 A 已选（S3-02）；New 壳增强不新增第三套布局 |
| 2. 按垂直切片：应用壳/导航 | ✅ 第一切片（壳错误边界+加载态） |
| 3. 业务状态/Server API/UI 分离 | ✅ 未复制 Session/Permission 逻辑 |
| 4. 每切片 unit/browser/keyboard/设计走查 | ✅ unit 537 + e2e smoke 5；键盘/视觉走查随后续切片 |
| 5. 复用现有 timeline/accessibility/visual 测试 | ✅ e2e smoke 复用 |

## 4. 技术债务

- Sidebar 导航/状态栏/首次启动流程：后续切片（需设计验收）
- e2e 浏览器版本软链是本地环境适配；CI 需按 playwright 版本下载对应浏览器
- 组件级键盘/a11y 测试随 S3-06
