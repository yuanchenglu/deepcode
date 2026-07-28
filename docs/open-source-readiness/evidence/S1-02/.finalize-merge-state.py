from pathlib import Path

root = Path.cwd()


def replace_required(path: str, old: str, new: str, count: int = 1) -> None:
    target = root / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"required text missing in {path}: {old!r}")
    target.write_text(text.replace(old, new, count))


plan = "docs/open-source-readiness/PLAN.md"
replace_required(
    plan,
    "- S1-02-E 当前远程分支：`coexistence-boundary-audit`；PR #7 `test(identity): close S1-02-E coexistence boundary gaps`。\n- S1-02-E 已验证代码 head：`2442d6b11b7eb7add9ff6685af04e81c3615c657`；typecheck #116、test #118 全部 SUCCESS。",
    "- PR #7 / S1-02-E 已通过完整门禁并 squash 合入 `develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90`。\n- PR #7 最终 clean docs head：`ebc6365f4b110bb90e56abc48daf8dc9cf00fe30`；typecheck #120 / `30355593747`、test #122 / `30355593871` 全部 SUCCESS。HttpApi 首次尝试在 Effect phase 遭遇 runner stall 并触发 15 分钟 timeout；同一 run 仅重跑失败的 Linux unit job后，HttpApi artifact `httpapi-2` 成功，未修改或放宽门禁。",
)
replace_required(
    plan,
    "| 2026-07-28 |  1.3 | 完成 S1-02-D/E 与父任务验收；回填 PR #6/#7、双平台全链 CI、字符串分类和下一唯一任务 S1-03 | PR #6、PR #7、typecheck #116、test #118 与 evidence |",
    "| 2026-07-28 |  1.3 | 完成 S1-02-D/E 与父任务验收；回填 PR #6/#7、双平台全链 CI、字符串分类和下一唯一任务 S1-03 | PR #6、PR #7、typecheck #120、test #122 与 evidence |",
)

readme = "docs/open-source-readiness/evidence/S1-02/README.md"
replace_required(
    readme,
    "> 完成 PR：#7",
    "> 完成 PR：#7\n> 合并基线：`develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90`",
)
replace_required(
    readme,
    "- 已验证代码 head `2442d6b11b7eb7add9ff6685af04e81c3615c657`：typecheck #116、test #118 全绿。",
    "- 已验证实现 head `2442d6b11b7eb7add9ff6685af04e81c3615c657`：typecheck #116、test #118 全绿；最终 clean docs head `ebc6365f4b110bb90e56abc48daf8dc9cf00fe30`：typecheck #120、test #122 全绿。",
)

audit = "docs/open-source-readiness/evidence/S1-02/test-results/S1-02-E-boundary-audit.md"
replace_required(
    audit,
    "> PR：#7\n> 已验证代码 head：`2442d6b11b7eb7add9ff6685af04e81c3615c657`",
    "> PR：#7（已 squash 合入 `develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90`）\n> 已验证实现 head：`2442d6b11b7eb7add9ff6685af04e81c3615c657`\n> 最终 clean docs head：`ebc6365f4b110bb90e56abc48daf8dc9cf00fe30`",
)
replace_required(
    audit,
    "- typecheck run #116 / id `30354218370`：SUCCESS。\n- test run #118 / id `30354218292`：SUCCESS。",
    "- 实现 head typecheck run #116 / id `30354218370`：SUCCESS。\n- 实现 head test run #118 / id `30354218292`：SUCCESS。\n- 最终 docs head typecheck run #120 / id `30355593747`：SUCCESS。\n- 最终 docs head test run #122 / id `30355593871`：SUCCESS；首次 Linux HttpApi 尝试在 Effect phase runner stall 后触发 15 分钟 timeout，同一 run 仅重跑失败 job 后通过，成功 artifact `httpapi-2` / id `8687319884`。",
)

handoff = root / "docs/open-source-readiness/HANDOFF_2026-07-28.md"
handoff.write_text('''# DeepCode 实施交接提示词（2026-07-28）

> 用途：在新会话中从 GitHub 远程继续实施，不依赖旧容器、旧工作区或未推送文件。
>
> 远程仓库：`https://github.com/yuanchenglu/deepcode.git`

## 当前远程状态

- 开发分支：`develop`
- 发布/默认分支：`master`
- S1-02-C：PR #2，已合入 `develop@babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`
- S1-02-D：PR #6，已合入 `develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`
- S1-02-E：PR #7 `fix(identity): close DeepCode coexistence boundaries`，已 squash 合入 `develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90`
- PR #7 最终 clean docs head：`ebc6365f4b110bb90e56abc48daf8dc9cf00fe30`
- 最终 CI：typecheck #120 / id `30355593747` SUCCESS；test #122 / id `30355593871` SUCCESS
- test #122 首次 Linux HttpApi 尝试在 Effect phase 遭遇单次 runner stall 并触发 15 分钟 timeout；未修改代码或门禁，仅重跑失败 job，HttpApi artifact `httpapi-2` / id `8687319884` 成功。
- 当前代码、测试、CI、inventory 与 evidence 均在远程；不存在必须依赖旧容器的修改。

## 计划进度

- 产品发布判断：`NO-GO`
- 第一阶段：`IN_PROGRESS`
  - S1-01A：`DONE`
  - S1-01B：`NOT_STARTED`
  - S1-02-A/B/C/D/E 与父任务：`DONE`
  - S1-03：下一唯一代码任务
  - S1-04、S1-05：按 PLAN 可并行，但不得与 S1-03 重叠修改
  - S1-06~S1-08：受前置任务阻塞
- 第二阶段：`NOT_STARTED`，受 Gate 1 阻塞
- 第三阶段：`NOT_STARTED`，受 Gate 2 与 Design Gate 阻塞

## S1-02 最终结论

- DeepCode 只默认读取/写入 `deepcode.json(c)`、`.deepcode`、DeepCode Global Path、数据库、日志、项目缓存与环境变量。
- OpenCode-only 和双配置并存测试证明 `.opencode` / `opencode.json(c)` 不被默认加载或修改。
- TUI、插件、MCP、ACP、OAuth、Provider headers、Agent/Plan/Session 和 shell 生命周期均已隔离。
- 安装、upgrade fail-closed、卸载前后 OpenCode shell/目录保持不变。
- 最终 inventory 4,168 行全部分类，未分类用户边界为 0。
- launcher、bin、publish、归档、checksum、rollback、purge 和 Release channel 明确属于 S1-03。

## 开发流程规范

第一优先：功能分支 → PR → 完整 CI → squash 合入 `develop`。

只有 PR/CI 持续异常且完成根因分析、最小修复后仍不可解决，才允许直推 `develop`。不得关闭检查、删除失败测试、恢复 OpenCode fallback 或跳过 Windows/Linux unit、E2E、typecheck、HttpApi、lifecycle/config/permission 门禁。

## 可复制到新会话的提示词

```text
@GitHub yuanchenglu/deepcode

请从 GitHub 远程仓库继续实施 DeepCode 三阶段交付计划。不要依赖任何旧容器、旧工作区或未推送本地文件；GitHub 远程仓库是唯一事实源。

一、首先完整读取并遵守
1. 仓库根 AGENTS.md
2. docs/open-source-readiness/PLAN.md（应为 v1.3 或更新）
3. docs/open-source-readiness/HANDOFF_2026-07-28.md
4. docs/open-source-readiness/evidence/S1-02/README.md
5. docs/open-source-readiness/evidence/S1-02/test-results/S1-02-E-boundary-audit.md
6. 已合并 PR #7：fix(identity): close DeepCode coexistence boundaries

二、重新核验远程实时状态
- develop、master 当前 HEAD
- PR #7 已合并状态和 merge commit
- develop 上 PLAN/evidence/HANDOFF 是否完整
- 当前开放 PR、分支和最新 CI

已知基线：
- S1-02-D 已合入 develop@c848bc537e8c5677c36a360dd00122745a2f5b2e
- S1-02-E 已合入 develop@1ad663ee07aa5ba72a333f9d2dc1ba3fe981be90
- 最终 PR head ebc6365f4b110bb90e56abc48daf8dc9cf00fe30
- typecheck #120 / 30355593747：SUCCESS
- test #122 / 30355593871：SUCCESS
- Linux/Windows unit、lifecycle、完整 config/permission、E2E、generated client、HttpApi 全绿

三、执行逻辑
1. 不重做 S1-02，不恢复任何 OpenCode 用户 fallback。
2. 从最新 develop 创建独立功能分支，领取 PLAN 的下一唯一代码任务 S1-03。
3. 先建立失败基线与 evidence，再做最小实现，完整 CI 全绿后 squash 合入 develop。
4. 不提前实施 S1-04 或后续 Release 门禁；跨任务文件冲突必须先在 PLAN/evidence 中明确。

四、S1-03 目标
- 建立 DeepCode-owned launcher、二进制/归档命名和跨平台构建矩阵。
- 建立可信 GitHub Release/manifest/checksum/SBOM 路径。
- upgrade 只读取 DeepCode-owned channel；支持失败回滚。
- uninstall 与 --purge 只删除 DeepCode，自始至终保持 OpenCode/Oh-my-OpenAgent 不变。
- 不宣称官网可安装，除非 S1-01B/S1-07 的真实官网与部署证据已完成。

请自主执行，不要只做状态汇报。完成当前可完成工作后，明确列出：已合入 develop 的内容、当前分支/PR/commit、完整 CI、修改文件、证据、下一唯一执行点和外部阻塞。
```

## 交接边界

- 本文件不替代 PLAN；新会话必须重新读取 GitHub 实时状态。
- S1-02 已完成并合入，不得在 S1-03 中重新引入 OpenCode 默认配置、路径、环境变量、安装或升级渠道。
- 产品继续为 NO-GO，直到 Gate 1 全部通过。
''')

print("S1-02 merge state finalized")
