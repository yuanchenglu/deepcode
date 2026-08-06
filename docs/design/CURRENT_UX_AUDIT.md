# DeepCode 当前 UX 审计（CURRENT_UX_AUDIT）

> 日期：2026-08-05
> 状态：DONE（S3-01 交付；基于代码审计 + 子代理布局/Tokne 审计）
> 方法：启发式审计（Nielsen 10 项）+ 代码审计（含行号证据）

## 1. 审计范围

- 布局：`packages/app/src/pages/layout.tsx`（Legacy，2436 行）、`layout-new.tsx`（New，44 行）
- 页面：home / new-session / session / directory-layout / error / settings
- 组件库：packages/ui 87 组件 + 46 stories
- Token：packages/ui/src/theme/（v1 + v2 双套）

## 2. 布局审计（Legacy vs New）

### Legacy（layout.tsx）

**导航结构**：顶部 Titlebar（L2251）+ 左侧 64px 图标栏（sidebar-shell.tsx L52-53：可拖拽项目图标、"+ 开项目"、底部设置齿轮/帮助 L92-111）+ 项目/工作区/会话树侧栏（L2258-2281 桌面、L2309-2332 移动抽屉）+ hover 悬浮预览面板（L2357-2379）。无底部导航；入口靠 URL（`/:dir/session/:id`）。

**主要区域**：侧栏承载"新建会话"（L2105-2116）、LocalWorkspace 会话列表（L2119）、SortableWorkspace 拖拽排序（L2157-2169）、getting-started 卡片（L2187-2214）、更新提示（L2252-2254）。消息流/输入框/diff 在 children 会话页。

**UX 问题**：
1. **信息层级混乱**：getting-started 卡片（L2190）与项目菜单、会话列表同侧栏竞争，靠 dismiss 隐藏
2. **错误恢复弱**：createWorkspace（L1859）在 worktree.ready（L390）到达前跳转，失败后滞留在空目录，仅 toast（L1828）；autoselecting 期间主区空白无加载态（L2250/L2351）
3. **键盘可达性差**：peek 面板（L2357-2379）纯鼠标 hover 触发，无键盘等价路径；桌面与移动双导航同时挂载（L2280/L2330），panel 仅靠 inert/aria-hidden（sidebar-shell L39-47/L119），AT 与焦点易混淆

### New（layout-new.tsx）

**导航结构**：仅 Titlebar + `<main><Suspense>{children}</Suspense></main>`（L35-38）+ HelpButton + ToastRegion。**自身零导航入口**，全部委托子页面（app.tsx L503 包裹、L533-534 NewHome/TargetSessionRoute 带 tabs）。

**UX 问题**：
1. 壳无设置/home 入口，导航一致性依赖各子页自建
2. Suspense 无 fallback（L37），路由切换白屏闪烁，无错误边界
3. 反馈缺失：除 Titlebar 外无状态提示，更新安装无进度反馈

### 关键差异

Legacy 为 2436 行单体壳（自管项目/工作区/会话/预取队列 L637-792/通知/命令 L897-1094）；New 为 44 行透传壳（UI 由 tabs 子页承担）。Toast 体系：Legacy v1（L2399 v2=false），New v2（L15/L41）。

## 3. Token 体系审计（packages/ui/src/theme/）

**核心 token**：
- 原始色阶：theme/v2/default-primitives.ts 9 色相 × 12 级（v2-grey..pink-100..1200，约 110 个）+ alpha 色阶（v2/styles/colors.css）
- 语义 token：theme/v2/mapping.ts + foreground.ts（v2-background-bg-*、v2-text-text-*、v2-icon-*、v2-border-*、v2-overlay-*、v2-state-*、v2-elevation-* 8 阴影、v2-agent-*），分 light/dark
- 间距/圆角/字体/阴影：src/styles/theme.css（--radius-xs..xl、--spacing:0.25rem、--font-size-small/base/large、--shadow-xs/md/lg）；v1 语义 token（button-primary-base 等）由 theme/resolve.ts 生成
- default-themes.ts 存在：聚合 36 主题 JSON（oc-2…zenburn），各含 light/dark 双 variant

**组件 css 使用关系**：抽查 button.css/dialog.css/toast.css 均引用 CSS 变量（v1 token），无主题色硬编码；尺寸间距仍硬编码像素（24/28px 高、16/20px padding）。

**一致性问题**：
1. **v1/v2 双 token 并存**：--text-*/--surface-* 与 --v2-* 混用，组件同时依赖两套，维护成本翻倍
2. **重复定义**：--radius-* 在 theme.css 与 tailwind/index.css 各一份；v2/styles/theme.css :root 与 [data-color-scheme=light] 两处 300+ 行几乎完全重复；mapping.ts light 映射与 theme.css 静态值双份维护
3. **硬编码/悬空引用（bug 级）**：oc-2.json `icon-weak-base: "C7C7C7"` 缺 `#` 前缀（非法 hex）；toast.css 引用 `--color-primary` 包内无定义（悬空）；mapping.ts tab-scrim/agent rgba 硬编码
4. **死代码**：theme.css prefers-color-scheme 兜底块整段注释（L146-257）仍保留

## 4. 与 PLAN 验收对照

- "每个设计问题都能引用用户证据、行为数据或界面审计" → ✅ 本审计基于代码界面审计（行号证据）；用户证据待 S3-02 原型测试
- "不能用'我觉得不好看'直接推出实现方案" → ✅ 所有发现附代码/e2e 证据

## 5. 关键结论（供 S3-03 设计决策）

1. 双布局并存确认（P1）：Legacy 功能全但过载 + hover 独占 + 双导航 DOM 冗余；New 极简但导航责任下放 + 无兜底反馈
2. Token 双轨确认（P1）：v1/v2 并存，`--color-primary` 悬空 + `icon-weak-base` 缺 `#` 为确定 bug
3. S3-03 DESIGN.md 需明确：布局收敛方向（继承 New 壳 + 补齐导航/反馈/错误边界）与 Token 迁移路径（v2 收敛，修复悬空引用）
