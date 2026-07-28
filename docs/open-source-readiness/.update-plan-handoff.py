from pathlib import Path

ROOT = Path("docs/open-source-readiness")
PLAN = ROOT / "PLAN.md"
HANDOFF = ROOT / "HANDOFF_2026-07-28.md"
PROMPT = ROOT / "SESSION_HANDOFF_PROMPT.md"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


plan = PLAN.read_text(encoding="utf-8")
plan = replace_once(plan, "> 文档版本：1.3", "> 文档版本：1.4", "plan version")
plan = replace_once(plan, "> 基线日期：2026-07-27", "> 基线日期：2026-07-29", "baseline date")
plan = replace_once(
    plan,
    "| 2026-07-28 |  1.3 | 完成 S1-02-D/E 与父任务验收；回填 PR #6/#7、双平台全链 CI、字符串分类和下一唯一任务 S1-03 | PR #6、PR #7、typecheck #120、test #122 与 evidence |",
    "| 2026-07-29 |  1.4 | 回填 PR #9 合并收口、最终远程基线与父级任务卡计数；新增 canonical 会话交接提示词并固化五仓开发流程规范 | PR #9、typecheck #124、test #126、GitHub 远程状态 |\n| 2026-07-28 |  1.3 | 完成 S1-02-D/E 与父任务验收；回填 PR #6/#7、双平台全链 CI、字符串分类和下一唯一任务 S1-03 | PR #6、PR #7、typecheck #120、test #122 与 evidence |",
    "update log",
)
plan = replace_once(plan, "## 当前执行快照（2026-07-28）", "## 当前执行快照（2026-07-29）", "snapshot date")
plan = replace_once(
    plan,
    "| 第一阶段 | `IN_PROGRESS` | S1-01A `DONE`；S1-02-A/B/C/D/E 与父任务 `DONE` | 下一唯一代码任务 S1-03；S1-01B、S1-04、S1-05 及后续 Stage 1 任务仍未完成 |\n| 第二阶段 | `NOT_STARTED` | 无 | 受 Gate 1 阻塞，不得提前宣称完整 Provider/Harness/Agent/Gateway 能力 |\n| 第三阶段 | `NOT_STARTED` | 无 | 受 Gate 2 和设计门禁阻塞，不得提前大规模改造 WebUI/Electron |",
    "| 第一阶段 | `IN_PROGRESS` | 父级任务卡 2/9 `DONE`：S1-01A、S1-02；S1-02-A/B/C/D/E 5/5 `DONE` | 下一唯一代码任务 S1-03；S1-01B、S1-04、S1-05 及 S1-06~S1-08 尚未完成 |\n| 第二阶段 | `NOT_STARTED` | 父级任务卡 0/8 `DONE` | 受 Gate 1 阻塞，不得提前宣称完整 Provider/Harness/Agent/Gateway 能力 |\n| 第三阶段 | `NOT_STARTED` | 父级任务卡 0/8 `DONE` | 受 Gate 2 和 Design Gate 阻塞，不得提前大规模改造 WebUI/Electron |",
    "progress table",
)
plan = replace_once(
    plan,
    "| 第三阶段 | `NOT_STARTED` | 父级任务卡 0/8 `DONE` | 受 Gate 2 和 Design Gate 阻塞，不得提前大规模改造 WebUI/Electron |\n\n### 已落入远程的实施基线",
    "| 第三阶段 | `NOT_STARTED` | 父级任务卡 0/8 `DONE` | 受 Gate 2 和 Design Gate 阻塞，不得提前大规模改造 WebUI/Electron |\n\n> 按父级任务卡计数，当前为 2/25 `DONE`。该计数仅表示门禁任务完成数量，不代表加权工程量百分比；S1-02 是已完成的高风险基础任务。\n\n### 已落入远程的实施基线",
    "progress note",
)
plan = replace_once(
    plan,
    "- PR #7 最终 clean docs head：`ebc6365f4b110bb90e56abc48daf8dc9cf00fe30`；typecheck #120 / `30355593747`、test #122 / `30355593871` 全部 SUCCESS。HttpApi 首次尝试在 Effect phase 遭遇 runner stall 并触发 15 分钟 timeout；同一 run 仅重跑失败的 Linux unit job后，HttpApi artifact `httpapi-2` 成功，未修改或放宽门禁。\n- 代码、测试、CI boundary gate、inventory 和 evidence 均已推送到远程，不依赖旧容器中的未提交文件。",
    "- PR #7 最终 clean docs head：`ebc6365f4b110bb90e56abc48daf8dc9cf00fe30`；typecheck #120 / `30355593747`、test #122 / `30355593871` 全部 SUCCESS。HttpApi 首次尝试在 Effect phase 遭遇 runner stall 并触发 15 分钟 timeout；同一 run 仅重跑失败的 Linux unit job后，HttpApi artifact `httpapi-2` 成功，未修改或放宽门禁。\n- PR #8 因分支名不符合根 `AGENTS.md` 且遗漏生成的 `.pyc` 清理而关闭、未合并；由合规分支上的 PR #9 取代。\n- PR #9 / S1-02 post-merge closeout 已通过 typecheck #124 / `30359898506`、test #126 / `30359898493`，并 squash 合入 `develop@ea9d848e29dc9ae04ace7c5e1f12921157c224ed`。\n- 代码、测试、CI boundary gate、inventory、evidence 与交接基线均已推送到 GitHub 远程，不依赖旧容器中的未提交文件。",
    "remote baseline",
)
plan = replace_once(
    plan,
    "远程交接入口：[HANDOFF_2026-07-28.md](./HANDOFF_2026-07-28.md)。该文件包含可直接粘贴到新会话的完整提示词、分支/PR/Commit 基线、流程纪律和下一执行逻辑。",
    "远程交接状态：[HANDOFF_2026-07-28.md](./HANDOFF_2026-07-28.md)。可直接粘贴到新会话的 canonical 提示词：[SESSION_HANDOFF_PROMPT.md](./SESSION_HANDOFF_PROMPT.md)。新会话必须先读取 GitHub 实时状态，不能把旧容器或提示词中的 SHA 当作高于远程的事实源。",
    "handoff link",
)
plan = replace_once(
    plan,
    "远程交接状态：[HANDOFF_2026-07-28.md](./HANDOFF_2026-07-28.md)。可直接粘贴到新会话的 canonical 提示词：[SESSION_HANDOFF_PROMPT.md](./SESSION_HANDOFF_PROMPT.md)。新会话必须先读取 GitHub 实时状态，不能把旧容器或提示词中的 SHA 当作高于远程的事实源。\n\n---",
    "远程交接状态：[HANDOFF_2026-07-28.md](./HANDOFF_2026-07-28.md)。可直接粘贴到新会话的 canonical 提示词：[SESSION_HANDOFF_PROMPT.md](./SESSION_HANDOFF_PROMPT.md)。新会话必须先读取 GitHub 实时状态，不能把旧容器或提示词中的 SHA 当作高于远程的事实源。\n\n### 统一开发流程与远程保存纪律\n\n- 第一优先始终是：合规功能分支 → Pull Request → 完整 CI → squash 合入 `develop`。\n- PR/CI 持续异常时，必须先定位根因并区分代码、测试、环境或规则问题；能修复则修复，不能解决才允许直推 `develop`。\n- 直推 commit 必须包含 `## 问题原因` 和 `## 技术债务`；技术债务还可按项目约定写入 `TECH_DEBT.md` / `BUG_LIST.md`。\n- 无论是否完成合并，每次会话结束前都必须把有效代码、测试、证据、计划和交接信息推送到远程分支；不得把旧容器作为唯一保存位置。\n- 五仓统一规范及完整 commit 模板见 [SESSION_HANDOFF_PROMPT.md](./SESSION_HANDOFF_PROMPT.md)。\n\n---",
    "workflow section",
)
PLAN.write_text(plan, encoding="utf-8")

handoff = """# DeepCode 实施交接状态（更新于 2026-07-29）

> 用途：在新会话中从 GitHub 远程继续实施，不依赖旧容器、旧工作区或未推送文件。
>
> 远程仓库：`https://github.com/yuanchenglu/deepcode.git`
> Canonical 可复制提示词：[`SESSION_HANDOFF_PROMPT.md`](./SESSION_HANDOFF_PROMPT.md)

## 当前远程状态

- 开发分支：`develop`
- 发布/默认分支：`master`
- 当前已确认开发基线：`develop@ea9d848e29dc9ae04ace7c5e1f12921157c224ed`
- S1-02-C：PR #2，已合入 `develop@babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`
- S1-02-D：PR #6，已合入 `develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`
- S1-02-E：PR #7，已合入 `develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90`
- S1-02 合并状态收口：PR #9，typecheck #124 与 test #126 全绿，已 squash 合入 `develop@ea9d848e29dc9ae04ace7c5e1f12921157c224ed`
- PR #8 已关闭且未合并：原因是分支命名不符合根 `AGENTS.md`，并遗漏生成的 `.pyc` 清理；PR #9 已完成替代。
- 当前有效代码、测试、CI、inventory、evidence、计划与交接信息均在 GitHub 远程；不存在必须依赖旧容器的修改。

## 计划进度

- 产品发布判断：`NO-GO`
- 第一阶段：`IN_PROGRESS`
  - 父级任务卡：2/9 `DONE`
  - S1-01A：`DONE`
  - S1-01B：`NOT_STARTED`
  - S1-02-A/B/C/D/E 与父任务：`DONE`
  - S1-03：下一唯一代码任务，当前 `NOT_STARTED`
  - S1-04、S1-05：尚未开始；虽可并行，但新会话默认只领取 S1-03
  - S1-06~S1-08：受前置任务阻塞
- 第二阶段：0/8，`NOT_STARTED`，受 Gate 1 阻塞
- 第三阶段：0/8，`NOT_STARTED`，受 Gate 2 与 Design Gate 阻塞
- 全计划按父级任务卡计数：2/25 `DONE`；该计数不代表加权工程量百分比。

## S1-02 最终结论

- DeepCode 默认只读写 `deepcode.json(c)`、`.deepcode`、DeepCode Global Path、数据库、日志、项目缓存与 `DEEPCODE_*` 环境变量。
- `.opencode` / `opencode.json(c)` 不会被默认加载或修改。
- TUI、插件、MCP、ACP、OAuth、Provider headers、Agent/Plan/Session 和 shell 生命周期均已隔离。
- 安装、upgrade fail-closed、卸载前后 OpenCode shell/目录保持不变。
- 最终 inventory 4,168 行全部分类，未分类用户边界为 0。
- launcher、bin、publish、归档、checksum、rollback、purge 和 Release channel 属于 S1-03，不得重新归入 S1-02。

## 下一唯一任务：S1-03

目标：统一 DeepCode CLI 构建、安装、升级与卸载。

必须完成：

1. 唯一制品命名 `deepcode-<os>-<arch>.<ext>`，归档内部二进制为 `deepcode`。
2. 修复 package bin、build、postinstall、版本检测、upgrade、rollback、uninstall 的 DeepCode 身份与下载源。
3. Alpha 只启用 DeepCode-owned GitHub Release/curl 渠道；未迁移渠道必须 fail-closed。
4. 下载后验证 SHA-256，再原子替换；升级失败自动回滚。
5. uninstall 与 `--purge` 只删除 manifest 中的 DeepCode 所有物，OpenCode/Oh-my-OpenAgent 始终不变。
6. 建立 fake release server/fixture 测试，覆盖错误哈希、下载中断、权限不足、幂等安装、回滚与卸载。

## 开发流程规范

完整的五仓统一 PR/异常直推规范、commit 模板和技术债务路径已写入 [`SESSION_HANDOFF_PROMPT.md`](./SESSION_HANDOFF_PROMPT.md)。执行时还必须遵守根 `AGENTS.md`：DeepCode 分支名最多三个单词、用连字符分隔、不得使用斜杠或 `feat/`、`fix/` 前缀。

## 交接边界

- GitHub 远程是唯一事实源；新会话必须重新核验 `develop`、开放 PR、分支和 CI。
- 不重做 S1-02，不恢复 OpenCode 用户 fallback。
- 不提前宣称官网可安装；产品保持 `NO-GO`，直到 Gate 1 全部通过。
- 会话结束前，即使不能合入 `develop`，也必须把有效工作推送到远程功能分支，并更新 PLAN/evidence/handoff。
"""
HANDOFF.write_text(handoff, encoding="utf-8")

prompt = """# DeepCode 新会话交接提示词

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
"""
PROMPT.write_text(prompt, encoding="utf-8")
