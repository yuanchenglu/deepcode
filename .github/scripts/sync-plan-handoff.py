from pathlib import Path

plan_path = Path("docs/open-source-readiness/PLAN.md")
workflow_path = Path(".github/workflows/plan-handoff-sync.yml")
script_path = Path(__file__)

text = plan_path.read_text(encoding="utf-8")

replacements = {
    "> 文档版本：1.1": "> 文档版本：1.2",
    "> 当前状态：Ready for implementation（计划可执行，产品当前仍为 NO-GO）": "> 当前状态：Implementation in progress（计划执行中，产品当前仍为 NO-GO）",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"required marker not found: {old}")
    text = text.replace(old, new, 1)

log_marker = "| 2026-07-27 |  1.1 |"
log_row = "| 2026-07-28 |  1.2 | 回填实际实施进度、PR/CI 基线与远程交接入口；明确 S1-02-D 为 IN_REVIEW、S1-02-E 为下一执行点 | PR #2、PR #6、GitHub Actions 与远程分支复核 |\n"
if log_marker not in text:
    raise SystemExit("update log marker not found")
text = text.replace(log_marker, log_row + log_marker, 1)

snapshot_marker = "\n---\n\n## 0. 一页执行结论"
snapshot = """

## 当前执行快照（2026-07-28）

> 本节记录实施事实，不替代各任务卡验收条件。CI、PR 和分支状态变化时，后续执行者必须以 GitHub 实时状态复核。

| 范围 | 当前状态 | 已完成 | 当前执行点 / 阻塞 |
| --- | --- | --- | --- |
| 产品发布判断 | `NO-GO` | 计划已达到可执行标准并进入实施 | Gate 1 尚未通过，官网与可信 Release 安装闭环尚未完成 |
| 第一阶段 | `IN_PROGRESS` | S1-01A `DONE`；S1-02-A/B/C `DONE` | S1-02-D `IN_REVIEW`（PR #6）；S1-02-E `NOT_STARTED`；S1-01B 与其余 Stage 1 任务未完成 |
| 第二阶段 | `NOT_STARTED` | 无 | 受 Gate 1 阻塞，不得提前宣称完整 Provider/Harness/Agent/Gateway 能力 |
| 第三阶段 | `NOT_STARTED` | 无 | 受 Gate 2 和设计门禁阻塞，不得提前大规模改造 WebUI/Electron |

### 已落入远程的实施基线

- PR #2 `feat(identity): isolate DeepCode config and CLI` 已通过完整门禁并 squash 合入 `develop`。
- `develop` 对应 S1-02-C 合并提交：`babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`。
- S1-02-D 当前远程分支：`agent/s1-02-d-install-uninstall-guard`。
- S1-02-D 当前 PR：#6 `fix(lifecycle): fail closed DeepCode install and uninstall boundaries`。
- 写入交接文档前的实现 head：`06280508d4004104698987c23505794425a834ef`；后续文档提交会继续推进 PR head。
- 当前必要代码、测试和 evidence 均已推送到远程，不依赖旧容器中的未提交文件。

### S1-02 当前完成度

| 子任务 | 状态 | 结果 |
| --- | --- | --- |
| S1-02-A | `DONE` | 建立共存失败基线与 fixture |
| S1-02-B | `DONE` | Core 路径、数据库与用户环境入口切换至 DeepCode |
| S1-02-C | `DONE` | 配置发现、CLI/TUI/MDM/Server Auth 和公共测试基础设施完成身份隔离；已合入 `develop` |
| S1-02-D | `IN_REVIEW` | 安装检测、升级和卸载边界 fail-closed；PR #6 等待最终 CI/证据回填与合并 |
| S1-02-E | `NOT_STARTED` | 全链共存回归、字符串分类和父任务最终验收 |

S1-02-D 合入后，下一唯一代码执行点是 **S1-02-E**。S1-02-E 完成前，不得开始 S1-03，也不得把 S1-02 父任务标记为 `DONE`。

远程交接入口：[HANDOFF_2026-07-28.md](./HANDOFF_2026-07-28.md)。该文件包含可直接粘贴到新会话的完整提示词、分支/PR/Commit 基线、流程纪律和下一执行逻辑。
"""
if snapshot_marker not in text:
    raise SystemExit("snapshot insertion marker not found")
text = text.replace(snapshot_marker, snapshot + snapshot_marker, 1)

s102_marker = "### S1-02 建立 DeepCode 用户边界与共存隔离\n\n**状态**：`IN_PROGRESS`"
s102_replacement = "### S1-02 建立 DeepCode 用户边界与共存隔离\n\n**状态**：`IN_PROGRESS`\n**子任务进度**：S1-02-A/B/C `DONE`；S1-02-D `IN_REVIEW`（PR #6）；S1-02-E `NOT_STARTED`"
if s102_marker not in text:
    raise SystemExit("S1-02 marker not found")
text = text.replace(s102_marker, s102_replacement, 1)

handoff_marker = "## 12. 实现交接模板\n\n"
handoff_note = "## 12. 实现交接模板\n\n当前远程续作提示词见 [HANDOFF_2026-07-28.md](./HANDOFF_2026-07-28.md)。新会话必须先复核 GitHub 实时状态，再按本节模板领取下一任务。\n\n"
if handoff_marker not in text:
    raise SystemExit("handoff section marker not found")
text = text.replace(handoff_marker, handoff_note, 1)

plan_path.write_text(text, encoding="utf-8")

# Remove the one-shot automation from the resulting commit.
workflow_path.unlink(missing_ok=True)
script_path.unlink(missing_ok=True)
