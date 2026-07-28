# DeepCode 新会话交接提示词

以下代码块可直接完整复制到新的 ChatGPT / Codex 会话。

```text
@GitHub yuanchenglu/deepcode

你现在接手 GitHub 仓库 `yuanchenglu/deepcode` 的三阶段交付计划实施工作。

## 一、事实源与启动检查

GitHub 远程仓库是唯一事实源。不要依赖任何旧容器、旧工作区、未推送文件或口头记忆。

开始前必须从远程完整读取并遵守：

1. 根目录 `AGENTS.md`
2. `docs/open-source-readiness/PLAN.md`（应为 v1.4 或更新）
3. `docs/open-source-readiness/HANDOFF_2026-07-28.md`
4. `docs/open-source-readiness/SESSION_HANDOFF_PROMPT.md`
5. `docs/open-source-readiness/evidence/S1-02/README.md`
6. `docs/open-source-readiness/evidence/S1-02/test-results/S1-02-E-boundary-audit.md`
7. PR #7、PR #9 及其最终 CI

随后重新核验：

- `develop`、`master` 当前 HEAD
- 开放 PR、远程功能分支、最新 commits
- 当前 HEAD 的 GitHub Actions 状态
- PLAN、evidence、handoff 与实际远程状态是否一致
- 是否存在任何尚未合并但已推送的有效工作

提示词记录的已知代码基线为：

- S1-02-E：PR #7，合入 `develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90`
- S1-02 post-merge closeout：PR #9，typecheck #124 / `30359898506`、test #126 / `30359898493` 全绿，合入 `develop@ea9d848e29dc9ae04ace7c5e1f12921157c224ed`

若 GitHub 实时状态更新，以实时远程状态为准。

## 二、当前计划进度

- 产品发布判断：`NO-GO`
- 第一阶段：`IN_PROGRESS`，父级任务卡 2/9 `DONE`
- S1-01A：`DONE`
- S1-01B：`NOT_STARTED`
- S1-02-A/B/C/D/E 与父任务：`DONE`
- S1-03：下一唯一代码任务，当前 `NOT_STARTED`
- S1-04、S1-05：尚未开始
- S1-06~S1-08：受前置任务阻塞
- 第二阶段：0/8，受 Gate 1 阻塞
- 第三阶段：0/8，受 Gate 2 与 Design Gate 阻塞
- 全计划按父级任务卡计数：2/25 `DONE`，该数字不是加权工程量百分比

不要重做 S1-02，不得恢复任何 OpenCode 默认配置、路径、环境变量、安装、升级、服务、身份或用户 fallback。

## 三、下一唯一任务 S1-03

从最新 `develop` 创建符合根 `AGENTS.md` 的短功能分支，领取 `S1-03 统一 CLI 构建、安装、升级与卸载`。

目标：

1. 建立唯一 DeepCode launcher、bin 和归档命名：`deepcode-<os>-<arch>.<ext>`，归档内部二进制为 `deepcode`。
2. 修复 package bin、build、postinstall、版本检测、upgrade、rollback、uninstall 的 DeepCode 身份和下载源。
3. Alpha 只启用 DeepCode-owned GitHub Release/curl 渠道；brew/npm/choco/scoop 等未迁移渠道必须禁用或明确 fail-closed，不能回退上游。
4. 下载到临时目录，验证 SHA-256 后原子替换 `~/.deepcode/bin/deepcode`。
5. 升级保留上一版本，失败自动回滚；同版本重复安装必须幂等。
6. uninstall 只删除 DeepCode manifest 所有物；默认保留用户数据，`--purge` 必须列清单并二次确认。
7. 建立 fake release server/fixture 测试，覆盖错误哈希、下载中断、权限不足、重复安装、升级回滚和卸载。
8. OpenCode 和 Oh-my-OpenAgent 的命令、配置、数据库与目录树在完整生命周期前后必须保持不变。

先建立失败基线和 evidence，再做最小实现。不得提前实施 S1-04、S1-06 或官网发布。

## 四、五仓统一开发流程规范

本规范适用于以下 5 个项目：

- `deepseekagent`
- `deepcode`
- `deepseek_runtime`
- `llm-harness-agent`
- `oh-my-deepseek-harness`

Remote：`https://github.com/yuanchenglu/<项目名>.git`

分支策略：

- 开发分支：`develop`
- 发布分支：`master`
- `develop` 已取消 PR 强制保护，可以直接推送；但直推仅是异常兜底，不是默认流程
- DeepCode 还必须遵守根 `AGENTS.md`：分支名最多三个单词、用连字符分隔、不得使用斜杠或 `feat/`、`fix/` 前缀

### 第一优先：PR 流程

1. 创建功能分支
2. 提交 Pull Request
3. 等待完整 CI 通过
4. 处理所有有效 review thread
5. squash 合入 `develop`
6. 按项目 `docs/` 下的权威计划文档领取和更新任务
7. PR 标题与描述必须清晰说明变更范围、原因、影响、测试和证据

### 第二优先：异常处理与直推

只有 PR 流程持续异常，例如 CI 环境不可用、测试依赖无法安装、规则冲突或平台故障时，才执行：

1. 先分析原因：明确是代码、测试、环境、权限还是规则问题
2. 尝试最小修复：代码或配置问题必须直接修复并重跑
3. 无法在当前环境解决时，才允许直推 `develop`，避免有效工作因会话或容器销毁而丢失

不得把真实代码缺陷伪装成环境问题；不得删除失败测试、关闭安全校验、放宽权限、恢复 OpenCode fallback 或静默吞错。

### 直推 `develop` 的 commit 纪律

Commit 信息必须包含「问题原因」和「技术债务」：

```text
type(scope): <变更说明>

## 问题原因
<说明 PR/CI 为什么无法通过，根因、已尝试的修复和验证结果>

## 技术债务
- <遗留问题 1>
- <遗留问题 2>
```

示例：

```text
feat(auth): add login ticket validation

## 问题原因
CI 环境的 Playwright 依赖版本与锁定版本不一致，E2E 在 CI 无法启动；已定位为 runner 环境问题并完成本地与可用平台验证。

## 技术债务
- 统一 Playwright 版本锁定
- 单独修复 CI E2E runner 镜像
```

### 技术债务记录

二选一，推荐同时在 commit 中写明：

- `deepseekagent` → `docs/TECH_DEBT.md` 或 `docs/BUG_LIST.md`
- `deepcode` → `docs/BUG_LIST.md`
- `deepseek_runtime` → `docs/TECH_DEBT.md`
- `oh-my-deepseek-harness` → `docs/TECH_DEBT.md`
- `llm-harness-agent` → 根目录 `TECH_DEBT.md`

文档条目格式：

```text
[YYYY-MM-DD] 描述 | 遗留原因 | 状态
```

核心原则：

- 能走 PR 就走 PR，直推是兜底方案
- 直推必须解释原因和遗留问题
- 技术债务必须可发现、可追踪
- 会话结束前必须把所有有效代码、测试、证据、计划和交接信息推送到 GitHub 远程
- 即使不能合入 `develop`，也必须创建或复用远程功能分支保存工作

## 五、S1-03 验证与收口

至少运行并保存：

```bash
cd packages/opencode && bun typecheck
cd packages/opencode && bun test test/installation
cd packages/opencode && ./script/build.ts
```

同时保留现有完整门禁：Linux/Windows unit、E2E、typecheck、lifecycle、完整 config/permission、generated client、HttpApi 和 OpenCode coexistence inventory。

完成当前可完成工作后，必须更新 PLAN/evidence/handoff，并明确列出：

- 已合入 `develop` 的 commit
- 当前远程分支、PR 和 head SHA
- 完整 CI run 与结论
- 修改文件和测试证据
- 尚未解决的技术债务或外部阻塞
- 下一唯一执行点

请直接执行，不要只做状态汇报。不要依赖旧容器，也不要让任何有效修改只存在于本地。
```
