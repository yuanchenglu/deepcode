# DeepCode 用户流程（USER_FLOWS）

> 日期：2026-08-05
> 状态：DRAFT（S3-02 交付）
> 依据：S3-01 审计（Legacy/New 布局、e2e 覆盖、双 token 体系）

## 1. 核心任务流程（current-state vs proposed-state）

### T1 首次连接/打开项目

**Current（Legacy）**：启动 → home → 会话列表/打开目录 → createWorkspace 在 worktree.ready 前跳转（layout.tsx L1859/L390）→ 失败滞留空目录仅 toast（L1828）→ autoselecting 主区空白（L2250）。

**Proposed**：
```
启动 → 欢迎页（empty: 无项目）→ 选择目录
  → loading: 目录索引中（骨架屏）
  → 成功: home（会话列表可见）
  → 失败: 错误页 + 重试（error/recovery）
  → offline: 显示离线提示，缓存会话可浏览
```

### T2 发起并掌控 Agent 任务

**Current**：new-session → 输入 → session 消息流；计划/工具调用可见性依赖子页实现；无统一取消路径。

**Proposed**：
```
输入目标 → 模型/Agent 选择（permission: 未配 Provider 时引导配置）
  → 计划生成（loading + 可预览步骤）
  → 执行（running: 计划面板高亮当前步骤 + 工具调用实时显示）
  → 取消（cancel: 任意时刻可取消，回执"已取消"）
  → 失败（error: 错误回执 + 重试/回退步骤）
```

### T3 审查/接受修改

**Current**：session → diff-changes 面板 → 接受/拒绝；review-* e2e 已覆盖基本路径。

**Proposed**：
```
变更通知（badge）→ diff 面板（loading → 分文件视图）
  → 逐文件: 行内评论/接受/拒绝（permission: 写操作前确认）
  → 运行验证（终端可折叠展开）
  → 完成: 汇总 + 更新会话列表
```

## 2. 状态覆盖清单（每个关键状态有线框）

| 状态 | T1 | T2 | T3 | 线框位置 |
|---|---|---|---|---|
| permission | ✅ Provider 配置引导 | ✅ 权限确认弹层 | ✅ 写操作确认 | WIREFRAMES F3/F6 |
| loading | ✅ 目录索引骨架 | ✅ 计划生成 | ✅ diff 生成 | F2/F4/F7 |
| empty | ✅ 无项目欢迎页 | ✅ 空输入引导 | ✅ 无变更 | F1/F7 |
| offline | ✅ 离线提示 | ✅ 不可用提示 | ✅ diff 缓存 | F1 |
| error | ✅ 目录失效+重试 | ✅ 失败回执 | ✅ 审查失败 | F2/F5/F7 |
| cancel | — | ✅ 取消+回执 | ✅ 中止审查 | F4 |
| recovery | ✅ 重试 | ✅ 回退步骤/继续 | ✅ 重新加载 | F2/F5 |

## 3. 关键决策点（需用户确认）

1. **布局方向**（WIREFRAMES A/B/C 之一）
2. 会话列表是否常驻 Sidebar（vs 全屏会话沉浸式）
3. 计划面板默认展开还是折叠
