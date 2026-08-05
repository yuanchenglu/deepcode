# DeepCode 产品 UI 设计简报（PRODUCT_UI_BRIEF）

> 日期：2026-08-05
> 状态：DRAFT（S3-01 交付，等待用户批准主方向）
> 作者：小路的数字分身

## 1. 目标用户与核心任务

**目标用户**（按优先级）：

| 用户 | 特征 | 核心诉求 |
|---|---|---|
| 独立开发者 | 单人、本地、CLI 习惯 | 快速打开项目、发起任务、审查改动 |
| 技术团队成员 | 多人协作、Gateway/飞书接入 | 远程发起任务、多 Agent 管理、审核产出 |
| 开源贡献者 | 读代码、提 PR | 理解会话结构、diff 审查、证据追溯 |

**前三个核心任务**（PLAN S3-01 步骤 1）：

| # | 任务 | 定义 |
|---|---|---|
| T1 | 首次连接/打开项目 | 从欢迎页 → 选择/打开工作区 → 看到可用 Agent 与模型 |
| T2 | 发起并掌控 Agent 任务 | 输入目标 → 观察计划/执行/工具调用 → 可暂停/取消/继续 |
| T3 | 审查/接受修改 | 查看 diff → 逐文件确认 → 接受/拒绝 → 运行验证 |

**次级流程**：Gateway/多 Agent 管理、设置、会话归档、技能/插件管理。

## 2. 现有布局现状（代码审计）

- **双布局并存**（PLAN 8.1 已确认风险）：
  - `packages/app/src/pages/layout.tsx`（LegacyLayout）
  - `packages/app/src/pages/layout-new.tsx`（NewLayout）
- **页面**：home、session、new-session、directory-layout、error
- **组件**：packages/ui 87 个 tsx 组件（+46 stories）+ packages/app 72 个组件
- **主题**：packages/ui/src/theme/ 含 color.ts、default-themes.ts、themes/、v2/

## 3. 设计原则（草案，S3-03 冻结）

1. **任务可掌控**：任何时刻用户能看到"Agent 在做什么、下一步是什么、如何停止"
2. **证据优先**：diff/测试/路由证据与结论并列展示，可追溯
3. **渐进披露**：初级用户只看到必要信息，高级信息可展开
4. **一致 Token**：全部组件用 packages/ui Token，不引入第三套主题
5. **可访问性**：WCAG 2.2 AA，键盘完整可达

## 4. 非目标（明确不做）

- 不做与 VSCode/JetBrains 相同的 IDE 全功能
- 不做移动端原生应用（响应式 Web 优先）
- 不引入第三方 UI 框架替换 packages/ui

## 5. 成功指标（草案）

| 指标 | 目标 |
|---|---|
| T2 任务发起耗时 | ≤30 秒（从输入到计划可见） |
| T3 diff 审查耗时 | ≤60 秒/文件 |
| 键盘完成 T1-T3 | 100% 可达 |
| 对比度 | WCAG AA（4.5:1 正文） |
