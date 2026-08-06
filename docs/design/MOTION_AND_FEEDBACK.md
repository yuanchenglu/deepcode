# DeepCode 动效与反馈（MOTION_AND_FEEDBACK）

> 日期：2026-08-05
> 状态：FROZEN（S3-03 交付）
> Token 源：仓库根 DESIGN.md

## 1. 动效原则

- **动效服务于状态和空间关系，不以装饰延迟任务**（DESIGN.md）
- 默认时长 ≤200ms；弹层进入 150ms、退出 100ms
- `prefers-reduced-motion`：所有非必要动效禁用（保留透明度变化）
- 无位移动效必须声明 transform；避免 layout 抖动

## 2. 动效规格

| 场景 | 时长 | 缓动 | 说明 |
|---|---|---|---|
| 弹层进入 | 150ms | ease-out | fade + 8px 上移 |
| 弹层退出 | 100ms | ease-in | fade |
| hover 状态 | 100ms | linear | 颜色/背景过渡 |
| 计划面板展开 | 200ms | ease-out | 高度 + 透明度 |
| 消息进入 | 150ms | ease-out | fade（不位移，防读屏抖动） |
| 工具调用更新 | 立即 | — | 状态文本变化不带动效 |
| loading 骨架 | 800ms 循环 | — | shimmer（reduced-motion 下静态） |

## 3. 反馈规格

| 场景 | 反馈 |
|---|---|
| Agent 开始执行 | 计划面板出现 + 当前步骤高亮 |
| 工具调用 | 实时显示工具名 + 参数摘要 + 状态（running/success/failed） |
| 取消 | 立即回执"已取消" + 计划面板标记取消步骤 |
| 失败 | 错误回执（不自动消失）+ 重试/回退选项（USER_FLOWS F5） |
| 权限请求 | 弹层（命令 + 工作区 + 三选一） |
| 长任务 | 进度指示（步骤 x/y） |
| 无输出 | empty 状态引导（非空白） |

## 4. 禁止

- 装饰性循环动效（除 loading 指示）
- 弹层进入动画 >200ms（延迟任务）
- 消息位移进入（读屏抖动）
- reduced-motion 用户仍看到位移/shake
