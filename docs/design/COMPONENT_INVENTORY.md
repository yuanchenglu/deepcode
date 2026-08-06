# DeepCode 组件清单（COMPONENT_INVENTORY）

> 日期：2026-08-05
> 状态：DRAFT（S3-01 交付）
> 数据来源：代码审计（2026-08-05）

## 1. packages/ui 基础组件（87 个 tsx + 46 stories）

| 分类 | 组件 | 数量 |
|---|---|---|
| 输入 | button、checkbox、radio-group、switch、text-field、inline-input、select、tabs、accordion、collapsible、dropdown-menu、context-menu、popover、hover-card | 14 |
| 反馈 | toast、dialog、progress、progress-circle、spinner、tooltip、animated-number、typewriter、text-reveal、text-shimmer、text-strikethrough、motion-spring | 12 |
| 布局 | card、list、scroll-view、dock-surface、resize-handle、sticky-accordion-header | 6 |
| 内容 | avatar、app-icon、file-icon、icon、icon-button、logo、provider-icon、favicon、font、keybind、tag、image-preview | 12 |
| 会话专用 | diff-changes、thinking-heading | 2 |
| 其他 | app-icons 子目录（多图标）、custom-elements | — |

**注意**：`v2/` 子目录存在（新组件演进面）。

## 2. packages/app 组件（72 个）与页面映射

| 页面 | 任务 | 主要组件 |
|---|---|---|
| home.tsx + home-session-open/archive | T1 打开项目/会话 | 会话列表、归档、新建入口 |
| new-session.tsx | T2 发起任务 | 输入、Agent/模型选择 |
| session.tsx | T2/T3 掌控任务 + 审查 | 消息流、输入框、diff、工具调用 |
| directory-layout.tsx | 目录浏览 | 文件树 |
| error.tsx + error-description | 错误恢复 | 错误说明、重试 |
| layout.tsx / layout-new.tsx | 全局导航 | 双布局并存（见 UX_AUDIT） |
| settings.tsx / settings-v2 | 设置 | 表单、Gateway/多 Agent 管理 |

## 3. Keep / Adapt / Replace（草案）

| 分类 | 组件 | 理由 |
|---|---|---|
| Keep | button、dialog、toast、avatar、tabs、switch、text-field、tooltip、dropdown-menu、tag | 稳定、有 stories、Token 驱动 |
| Keep(待查) | diff-changes、thinking-heading | 会话核心，需确认 Token 一致性 |
| Adapt | select、popover、context-menu、accordion | 行为可用，样式需对齐新 Token |
| Adapt | dock-surface、resize-handle | 布局相关，待 NewLayout 定稿后对齐 |
| Replace(候选) | 无大组件需替换 | 若审计发现硬编码样式 → 迁 Token |
| Remove(候选) | text-shimmer、motion-spring 等装饰组件 | 若未在 app 使用（待 usage 确认） |

## 4. Token 到现有变量的迁移映射（S3-03 冻结）

基于 theme 审计（见 CURRENT_UX_AUDIT §3）：

| 设计 Token | 现有变量 | 状态 |
|---|---|---|
| 原始色阶 | v2-{grey..pink}-100..1200（v2/default-primitives.ts） | Keep |
| 语义色 | v2-background-bg-*/v2-text-text-*/v2-state-*/v2-elevation-*（mapping.ts） | Keep（v2 收敛方向） |
| v1 语义 token | --button-primary-base 等（resolve.ts 生成） | **Adapt → 迁 v2** |
| 间距/圆角/字体/阴影 | --radius-*/--spacing/--font-size-*/--shadow-*（styles/theme.css） | Keep（去重：tailwind 副本待删） |
| 悬空引用 | toast.css `--color-primary`；oc-2.json `icon-weak-base` 缺 # | **P1 修复项** |

**迁移原则（草案）**：以 v2 为唯一语义 token 源；v1 token 在组件迁移后退役；修复 `--color-primary` 悬空与 hex 缺 `#`；删除重复定义与注释死代码。
