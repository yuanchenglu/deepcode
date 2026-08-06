# DeepCode 可访问性规格（ACCESSIBILITY）

> 日期：2026-08-05
> 状态：FROZEN（S3-03 交付）
> 标准：WCAG 2.2 AA

## 1. 对比度（AA）

| 元素 | 要求 |
|---|---|
| 正文 | ≥ 4.5:1 |
| 大文本（≥18px 或 14px 粗体） | ≥ 3:1 |
| 控件边界/图标 | ≥ 3:1（非装饰性） |
| 焦点环 | 与相邻背景 ≥ 3:1 |

校验：不得只凭肉眼判断；用工具（axe/lint 报告）验证。DESIGN.md lint 含 contrast-ratio 规则。

## 2. 键盘可达

- 核心任务 T1/T2/T3 全部键盘可完成
- Tab 顺序 = DOM 顺序；焦点可见（2px 环 + 2px offset）
- 快捷键：Esc 关闭弹层/取消、/ 聚焦输入、Ctrl+K 命令面板
- 弹层焦点陷阱；关闭后还原焦点
- hover 独占交互必须有键盘等价（S3-01 审计：Legacy peek 面板纯 hover 无键盘路径 → 修复）

## 3. 读屏

- 所有图标有 aria-label；装饰图标 aria-hidden
- 状态变化 aria-live（Agent 状态、工具调用、错误回执）
- 消息流按逻辑顺序读（不因动效跳读）
- diff 增删行有文本等价（不只颜色区分）

## 4. reduced motion

- prefers-reduced-motion：禁用位移/循环动效（保留 fade）
- 见 MOTION_AND_FEEDBACK.md §1

## 5. 表单与错误

- label 关联（非 placeholder 当 label）
- 错误信息 aria-describedby 关联输入
- 危险操作：操作对象 + 可恢复性说明（权限弹层）

## 6. 已知 P1 修复项（S3-01 审计带出）

- Legacy peek 面板纯 hover 触发 → 需键盘等价
- 双导航 DOM 冗余（桌面+移动同时挂载）→ 方向 A 收敛
- `--color-primary` 悬空引用 → DESIGN.md Do's 已禁止，实现时修复
