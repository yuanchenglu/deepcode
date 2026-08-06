# S1-01A 仓库、分支与发行基线证据

> 状态：DONE
> 核验日期：2026-07-27
> 仓库：`yuanchenglu/deepcode`
> 实施分支：`develop`

## 假设与结论

- 假设：`develop` 承载实施，阶段里程碑经审查后合入 `master`；Alpha Release 归属 `yuanchenglu/deepcode`。
- 依据：GitHub 仓库元数据、远端分支清单、仓库权限和修订后的工作流。
- 反证条件：GitHub 默认分支、仓库所有者或 Release 仓库发生管理员级变更。
- 置信度：确定。

## 已验证事实

| 项目 | 已验证值 | 证据 |
| --- | --- | --- |
| Repository | `yuanchenglu/deepcode`，public | [Repository](https://github.com/yuanchenglu/deepcode) |
| 当前 GitHub 默认分支 | `master` | GitHub repository metadata，2026-07-27 读取 |
| 实施分支 | `develop` | [AGENTS.md](https://github.com/yuanchenglu/deepcode/blob/develop/AGENTS.md) |
| 远端分支 | `develop`、`master`；不存在 `dev` | GitHub branch list，2026-07-27 读取 |
| 当前操作者权限 | admin / maintain / push / pull / triage 均为 true | GitHub repository permissions，2026-07-27 读取 |
| Alpha Release owner/repo | `yuanchenglu/deepcode` | Repository owner 与本计划冻结值 |
| Alpha 版本格式 | `v0.1.0-alpha.N` | [PLAN.md](https://github.com/yuanchenglu/deepcode/blob/develop/docs/open-source-readiness/PLAN.md) |

## 实施结果

| 变更 | Commit | 结果 |
| --- | --- | --- |
| 修正 AGENTS 中不存在的 `dev` 分支说明 | [08d8788](https://github.com/yuanchenglu/deepcode/commit/08d8788ee778a6c6a8577e4165ef80dc8073a682) | 明确 `develop` 实施、`master` 默认/发布 |
| 拆分 S1-01A/S1-01B | [c597329](https://github.com/yuanchenglu/deepcode/commit/c597329918f5864ff534005e925a63c71bda17c2) | 官网外部阻塞不再卡住代码任务 |
| Test CI 对齐分支 | [7fcbfb0](https://github.com/yuanchenglu/deepcode/commit/7fcbfb048080d35a75448a9a47d27ec2efce263c) | push/PR 覆盖 `develop`、`master` |
| Typecheck CI 对齐分支 | [014e14b](https://github.com/yuanchenglu/deepcode/commit/014e14bd58a8cfc1ae87b98ebd794051a750dfb8) | push/PR 覆盖 `develop`、`master` |
| 冻结旧 Publish 自动触发 | [f1c09fe](https://github.com/yuanchenglu/deepcode/commit/f1c09fea9231b0e0534c0a2dee0797fd9810de2d) | S1-06 前仅保留手动入口，且上游仓库 guard 使其在本仓库保持 inert |
| 冻结未确认官网 Deploy | [69cc2d6](https://github.com/yuanchenglu/deepcode/commit/69cc2d6b107600bd0ff572f29c662559650dafcd) | S1-01B 前不自动部署未知官网源 |

## 验证

通过 GitHub 在 `develop` 上重新读取四个工作流：

- `.github/workflows/test.yml`：push/PR 均为 `develop`、`master`；
- `.github/workflows/typecheck.yml`：push/PR 均为 `develop`、`master`；
- `.github/workflows/publish.yml`：无 push 自动触发，仅 `workflow_dispatch`；
- `.github/workflows/deploy.yml`：无 push 自动触发，仅 `workflow_dispatch`；
- `AGENTS.md`、`PLAN.md` 不再把不存在的 `dev` 当作工作分支。

本任务只修改仓库治理、计划和工作流触发，不修改产品 Runtime，因此没有运行产品测试。

## 已知后续工作

- S1-06 必须替换 `publish.yml` 中的 `anomalyco/opencode` guard、OpenCode 制品名、上游凭据和发布目标；当前 Publish 只是安全冻结，不代表 Release 已可用。
- S1-06 必须把现有根级 typecheck/test 调用与仓库 package 级执行规范统一。
- S1-01B 独立核实 `deepcode.starseas.org` 的真实源码、部署所有者和线上止损。
- 本任务完成后，S1-02、S1-04、S1-05 已解锁。

## 验收结论

- 后续任务不再使用 `dev` 或模糊 owner/repo：通过。
- `develop`、`master` 职责及合入方向唯一明确：通过。
- 代码任务不依赖官网权限即可开始：通过。

结论：`S1-01A = DONE`。
