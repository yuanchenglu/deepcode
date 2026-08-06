---
name: DeepCode
description: DeepCode 设计系统规范 — 唯一机器可读/人可读设计系统源（S3-03 冻结）
version: "alpha"
colors:
  primary: "#3b5cf6ff"
  primary-hover: "#3250dfff"
  primary-active: "#2c47c8ff"
  background: "#f7f8fa"
  surface: "#ffffff"
  text: "#1c1c1c"
  text-secondary: "#5a5a5a"
  text-invert: "#ffffff"
  border: "#e0e0e0"
  success: "#2da44e"
  warning: "#d4a72c"
  danger: "#cf222e"
  info: "#3b5cf6ff"
  focus: "#3b5cf6ff"
  code: "#1c1c1c"
  code-bg: "#f2f2f2"
  overlay: "rgba(0, 0, 0, 0.4)"
  neutral-100: "#f7f8fa"
  neutral-200: "#eceef1"
  neutral-300: "#d9dde3"
  neutral-400: "#c4c9d1"
  neutral-500: "#9aa1ac"
  neutral-600: "#6c7480"
  neutral-700: "#4c5360"
  neutral-800: "#333a45"
  neutral-900: "#242b35"
  neutral-1000: "#1a1f27"
typography:
  small:
    fontFamily: "var(--font-sans)"
    fontSize: 13px
    fontWeight: 400
  base:
    fontFamily: "var(--font-sans)"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  large:
    fontFamily: "var(--font-sans)"
    fontSize: 16px
    fontWeight: 400
  heading:
    fontFamily: "var(--font-sans)"
    fontSize: 20px
    fontWeight: 600
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: 13px
    fontWeight: 400
spacing:
  unit: 4px
  scale: [4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px]
rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 10px
  full: 9999px
components:
  button:
    height: 28px
    padding: 12px
    rounded: {rounded.md}
    backgroundColor: {colors.primary}
    textColor: {colors.text-invert}
  button-hover:
    backgroundColor: {colors.primary-hover}
  button-active:
    backgroundColor: {colors.primary-active}
  button-disabled:
    backgroundColor: {colors.neutral-300}
    textColor: {colors.neutral-600}
  input:
    height: 28px
    padding: 8px
    rounded: {rounded.md}
    backgroundColor: {colors.surface}
    textColor: {colors.text}
  card:
    rounded: {rounded.lg}
    backgroundColor: {colors.surface}
    textColor: {colors.text}
  dialog:
    rounded: {rounded.xl}
    backgroundColor: {colors.surface}
    textColor: {colors.text}
  toast:
    rounded: {rounded.lg}
    backgroundColor: {colors.neutral-900}
    textColor: {colors.text-invert}
  tag:
    rounded: {rounded.sm}
    backgroundColor: {colors.neutral-200}
    textColor: {colors.text-secondary}
  tooltip:
    rounded: {rounded.md}
    backgroundColor: {colors.neutral-900}
    textColor: {colors.text-invert}
  focus-ring:
    size: 2px
omitted:
---

## Overview

DeepCode 是本地优先的 AI 编码 Agent 桌面应用。设计目标：**任务可掌控**——用户任何时刻都能看到 Agent 在做什么、下一步是什么、如何停止；**证据优先**——diff/测试/路由证据与结论并列展示、可追溯。

布局方向（S3-02 决策 A）：收敛 New 壳 + 常驻可收 Sidebar，两层导航（会话列表 + 目录），设置入 Titlebar。设计原则：渐进披露、一致 Token、WCAG 2.2 AA、键盘完全可达。

本文件是**唯一设计系统源**（S3-03 冻结）。Token 值提取自 `packages/ui/src/styles/theme.css`（--radius-*/--spacing/--font-size-*）与 `packages/ui/src/theme/v2/default-primitives.ts` + `mapping.ts`（v2 色阶/语义色）。组件 css 统一引用 CSS 变量，禁止硬编码主题色（审计见 docs/design/CURRENT_UX_AUDIT.md §3）。

## Colors

- Primary (#3b5cf6ff, v2-blue-600)：交互元素（按钮、链接、焦点环）唯一主色。
- 语义色：success #2da44e / warning #d4a72c / danger #cf222e / info 主色。状态色仅用于对应状态，不作为装饰。
- 中性色阶 neutral-100..1000 对应 v2-grey-100..1000；背景 surface 用中性色，卡片用 surface，正文用 text。
- 深色主题：语义映射在 `mapping.ts` 中 light/dark 各一套（v2-background-bg-base: grey-100 ↔ grey-1000 对调）。本文件以 light 为基准，深色由映射层派生。
- 对比度要求：正文 ≥ 4.5:1（AA）、大文本/控件 ≥ 3:1；不能只凭肉眼判断，需工具校验。
- 禁止：`--color-primary` 悬空引用（toast.css 既有 bug，P1 修复项）；hex 缺 `#` 前缀（oc-2.json icon-weak-base 既有 bug）。

## Typography

- 字族：`--font-sans`（界面正文）、`--font-mono`（代码/终端/diff）。
- 字号：small 13px / base 14px / large 16px / heading 20px（600）。行高 base 1.5。
- 代码与正文并列场景（diff、证据）：code 用 mono 13px，背景 code-bg，保证与正文区分。
- 禁止：正文用 < 13px 字号；标题用 < 600 字重；长段落用全大写。

## Layout

- 布局语法：Titlebar（固定 40px）+ Sidebar（可收 240px/64px）+ Main（弹性）+ Statusbar（固定 24px）。方向 A 见 WIREFRAMES_A.md。
- 间距：单位 4px（--spacing: 0.25rem），刻度 4/8/12/16/20/24/32/40/48/64。组件内 padding 用刻度，不硬编码像素（审计发现 24/28px 高、16/20px padding 为既有硬编码，迁移时改 token）。
- 信息层级：2 层导航（Sidebar 会话列表 + 目录）；Inspector 仅在宽 viewport（≥1728）或用户展开时显示。
- Viewport：最小支持 1024×700（待原型测试冻结）；1440×900 主目标；1728×1117 宽消息流。
- 键盘：Tab 顺序 = DOM 顺序；Esc 关闭弹层/取消；/ 聚焦输入。

## Elevation & Depth

- 阴影（v2-elevation-* 8 级，theme.css --shadow-xs/md/lg）：
  - xs：卡片、列表项（0 1px 2px rgba(0,0,0,0.06)）
  - md：下拉、tooltip、hover 面板（0 4px 12px rgba(0,0,0,0.12)）
  - lg：dialog、命令面板（0 8px 24px rgba(0,0,0,0.16)）
- 层级原则：弹层（dialog/命令面板）最高，其次 hover 面板/下拉，卡片最低。z-index 由组件栈统一管理，禁止散落魔数。
- 禁止：无状态语义的装饰性阴影；弹层阴影弱于卡片阴影。

## Shapes

- 圆角刻度：xs 2 / sm 4 / md 6 / lg 8 / xl 10 / full。按钮/输入 md，卡片 lg，dialog xl，tag sm，tooltip md。
- 按钮：方角（md）非胶囊；tag 用 sm 保持紧凑；进度/头像用 full。
- 禁止：同一组件在不同页面用不同圆角；为装饰引入新圆角值（先用刻度）。

## Components

- 组件清单与 Keep/Adapt/Replace：见 docs/design/COMPONENT_INVENTORY.md（87 组件分类）。
- 关键组件契约：
  - Button：28px 高、12px 横向 padding、md 圆角、primary 底 + 白字；hover 用 primary-hover、active 用 primary-active；disabled 降低对比（不隐藏）。
  - Input/TextField：28px 高、8px padding、md 圆角、1px border；focus 用 2px 焦点环 + 2px offset。
  - Dialog：xl 圆角、surface 底、overlay 遮罩、lg 阴影；Esc 关闭；焦点陷阱。
  - Toast：lg 圆角、中性-900 底、白字；默认 5s 自动消失，错误 toast 不自动消失。
  - Tag：sm 圆角、8px padding；用于 Agent/模型/状态标记。
  - Tooltip：md 圆角、中性-900 底、白字；hover/focus 均触发。
  - Diff/Review：mono 字体、行内增删色（success/danger 派生，不直接用原色）、行内评论。
- 每个组件状态必须定义：default / hover / focus / active / disabled / loading / error / empty。
- 动效（MOTION_AND_FEEDBACK.md 细节）：动效服务于状态与空间关系，≤200ms 默认；支持 prefers-reduced-motion。

## Do's and Don'ts

### Do
- 所有颜色/尺寸引用本文件 token；组件 css 引用 CSS 变量。
- 每个设计决策引用用户证据、行为数据或界面审计（S3-01 原则）。
- 键盘完成核心任务；焦点可见（2px 环）；支持 reduced motion。
- 危险操作显示操作对象与可恢复性（权限确认弹层：命令 + 工作区 + 允许/拒绝/始终）。
- 错误可恢复：失败回执 + 重试/回退步骤（USER_FLOWS F5）。

### Don't
- 不引入第三套主题或布局（已存在 Legacy/New 双布局，收敛为方向 A）。
- 不用"我觉得不好看"直接推实现方案（需证据）。
- 不在组件内硬编码主题色/间距/圆角。
- 不把 Experimental/Beta 组件写成 Stable（组件分级随证据）。
- 不在正文用 < 13px 字号、不用纯色大面积背景承载正文（对比度）。
