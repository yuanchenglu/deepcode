# DeepCode 组件规格（COMPONENT_SPEC）

> 日期：2026-08-05
> 状态：FROZEN（S3-03 交付；Token 源：仓库根 DESIGN.md）
> 依据：S3-01 组件清单审计 + DESIGN.md 冻结

## 1. 组件状态定义（每个组件必须定义）

default / hover / focus / active / disabled / loading / error / empty

## 2. 核心组件规格

### Button
- Token：height 28px、padding 12px、rounded md、backgroundColor primary、textColor invert
- 状态：hover=button-hover（primary-hover）、active=button-active、disabled=neutral-300 底 + neutral-600 字（不隐藏）
- 变体：primary（默认）、secondary（neutral-200 底 + text 字）、danger（danger 底 + 白字，危险操作专用）
- 键盘：Enter/Space 触发

### Input / TextField
- Token：height 28px、padding 8px、rounded md、surface 底
- focus：2px 焦点环（focus token）+ 2px offset；placeholder neutral-500
- error：1px danger 边框 + 错误文本（附 aria-describedby）
- loading：右侧 spinner 或禁用提交按钮

### Dialog
- Token：rounded xl、surface 底、overlay 遮罩
- 行为：Esc 关闭、焦点陷阱（Tab 循环）、打开时焦点入内、关闭还原焦点
- 危险确认（权限弹层）：显示操作对象 + 命令 + 工作区 + [拒绝][允许一次][始终允许]

### Toast
- Token：rounded lg、neutral-900 底、invert 字
- 行为：默认 5s 自动消失；**错误 toast 不自动消失**（需手动关闭）
- 分级：info（默认）、success（前缘 success 色条）、error（danger 色条）

### Tag
- Token：rounded sm、neutral-200 底、text-secondary 字
- 用途：Agent 名、模型 tier、状态（Experimental/Beta/Stable）
- 分级色：Experimental=neutral、Beta=warning 派生、Stable=success 派生

### Tooltip
- Token：rounded md、neutral-900 底、invert 字
- 触发：hover + focus 均可（键盘可达）

### Diff/Review
- mono 字体 13px、行内增（success 派生底）、删（danger 派生底）
- 行内评论：评论按钮 hover 可见，焦点时可见
- empty：无变更提示；loading：骨架

### 列表项（会话/文件）
- hover：neutral-100 底；active：neutral-200 底
- 键盘：上下导航、Enter 打开、右键菜单可键盘唤起

## 3. 组件到 token 引用核对

组件全部引用 DESIGN.md token（backgroundColor/textColor/rounded/padding/height），禁止硬编码（审计发现的 24/28px 高、16/20px padding 硬编码在迁移时改 token 引用）。

## 4. 待定（原型测试后冻结）

- 各组件 loading 具体形态（骨架 vs spinner 粒度）
- diff 面板密度（行数/屏）
