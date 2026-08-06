# DeepCode UX 研究（UX_RESEARCH）

> 日期：2026-08-05
> 状态：DRAFT（S3-01 交付）
> 方法声明：**方向性研究**（未达到 5 名访谈样本，不声称统计结论）

## 1. 研究方法与样本

- 方法：启发式审计（Nielsen 10 项）+ 代码级行为审计 + e2e 任务路径记录
- 访谈样本：**0 名**（当前无真实用户访谈）
- 结论性质：方向性（PLAN S3-01 步骤 4 允许：不足 5 名时明确写为方向性研究）

> ⚠️ 诚实声明：本阶段结论基于代码审计与 e2e 路径，**无用户访谈证据**。
> 不声称任何统计结论；设计决策需在 S3-02 原型测试中补充用户证据。

## 2. e2e 任务路径基线（S3-01 步骤 3）

现有 e2e 覆盖（94 个文件）：

| 任务 | e2e 覆盖 | 文件 |
|---|---|---|
| T1 打开项目/会话 | smoke + session-list-path-loading | e2e/smoke/、regression/session-list-path-loading.spec.ts |
| T2 发起任务 | new-session-panel-corner、prompt-thinking-level | regression/ |
| T3 审查修改 | review-* 系列（image-flash、line-comment、tab-switch） | regression/ |
| 性能基线 | benchmark.ts、chrome-trace.ts | performance/ |

**步骤数/耗时基线**：待 S3-02 原型测试时用真实计时记录（当前 e2e 断言功能而非耗时）。

## 3. 核心任务完成路径（代码推断）

**T1 打开项目**：启动 → home → 会话列表/打开目录 → session
**T2 发起任务**：home/new-session → 输入目标 → Agent/模型选择 → session 消息流
**T3 审查**：session → diff-changes 面板 → 接受/拒绝 → 验证

## 4. 关键 UX 假设（需 S3-02 验证）

1. 用户能快速理解"Agent 正在做什么"（计划/工具调用可见性）
2. diff 审查流程无认知负担（diff-changes + 行内评论）
3. 双布局并存造成导航困惑（Legacy vs New）
4. 错误恢复路径清晰（error.tsx + error-description）
