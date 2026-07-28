from pathlib import Path

root = Path.cwd()


def replace_required(path: str, old: str, new: str, count: int = 1) -> None:
    target = root / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"required text missing in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, count))


audit = root / "docs/open-source-readiness/evidence/S1-02/test-results/S1-02-E-boundary-audit.md"
audit.write_text('''# S1-02-E 全链共存回归与字符串分类

> 状态：DONE
> 基线：`develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`
> 分支：`coexistence-boundary-audit`
> PR：#7
> 已验证代码 head：`2442d6b11b7eb7add9ff6685af04e81c3615c657`

## 假设与判定标准

- 内部 `@opencode-ai/*` package、Effect service tag、Provider ID、上游 schema/protocol 标识可保留，但必须不参与 DeepCode 默认用户边界。
- `.opencode`、`opencode.json(c)`、原始 `OPENCODE_*`、OpenCode shell PATH、OpenCode 数据目录只要参与默认读取、写入、迁移、删除或网络路由，即为产品缺陷。
- `packages/opencode` 源码目录、当前 launcher/build/publish 命名和 Release 制品属于 S1-03；本任务只验证它们未绕过已建立的运行时隔离。
- 每个保留字符串必须落入一项互斥分类；无法分类即不得完成任务。

## 首次失败基线

- PR head：`69ed7874ebf9734e258aaee514959a3be6742f6f`
- typecheck run #72 / id `30339514966`：SUCCESS
- test run #74 / id `30339514909`：Linux boundary gate FAILURE
- artifact：`unit-linux-1` / id `8680499518`

首次失败证明：

1. `tui-migrate.ts` 会读取并修改 `opencode.json(c)` / `.opencode`，违反目录树不变契约，分类为 `PRODUCT_DEFECT`；
2. inventory 使用 runner 未保证存在的 `rg`，artifact 为空，分类为 `TEST_DEFECT`；
3. 后续完整配置门禁又发现静态缓存 `DEEPCODE_CONFIG_CONTENT`、OpenCode Provider 仍读取原始 `OPENCODE_API_KEY`，均按产品缺陷修复；
4. 历史测试中大量 `Flag.DEEPCODE_*` 属性属于自动替换错误。Flag 的 TypeScript 属性名是内部兼容接口，实际环境读取由 `Product.envPrefix` 映射到 `DEEPCODE_*`，因此恢复内部属性而不恢复用户 fallback。

## 已实施结果

### 配置、TUI 与环境隔离

- Core、CLI、TUI、MDM、插件安装和 MCP 配置只发现或写入 `deepcode.json(c)` / `.deepcode`。
- OpenCode-only 配置、`.opencode`、原始 `OPENCODE_CONFIG_DIR`、`OPENCODE_DISABLE_PROJECT_CONFIG` 和其他 OpenCode 用户变量不会改变 DeepCode 行为。
- 双配置并存时只加载 DeepCode；TUI migration 只迁移 DeepCode 文件，并以 SHA-256 证明 OpenCode 树字节级不变。
- `DEEPCODE_CONFIG_CONTENT` 改为访问时读取，支持运行时 `{env:}` / `{file:}` substitution。
- RuntimeFlags 只读取 `DEEPCODE_*`；内部 `Flag.OPENCODE_*` 属性保留为受控兼容接口。

### 持久化、进程与网络身份

- Plan、Session、Agent、plugin、project cache、mDNS、日志、OAuth、MCP、ACP、Provider headers/user-agent 和 CLI 文案统一为 DeepCode。
- `.git/opencode` cache 被忽略且保持不变；DeepCode 使用 `.git/deepcode`。
- OpenCode-compatible Provider 仅在显式选择该 Provider 时保留其 ID/protocol，并从 `DEEPCODE_API_KEY` 获取用户凭据。
- 未建立 DeepCode 自有渠道前，上游 WebUI proxy、默认 OpenCode Account、OpenCode IDE extension 和 OpenCode GitHub Agent 均 fail-closed。
- S1-02-D 的安装、升级拒绝和卸载隔离继续保持：不下载上游、不执行包管理器、不修改 OpenCode shell 或目录。

### CI 门禁

永久 CI 现在显式执行：

- `packages/core` typecheck 和隔离测试；
- `packages/opencode` typecheck；
- Linux/Windows generic unit；
- Linux/Windows `test/installation`；
- Linux/Windows 完整 `test/config`、RuntimeFlags 与 `test/permission`；
- Linux inventory artifact；
- generated client；
- HttpApi exerciser（15 分钟 timeout）；
- Linux/Windows Playwright E2E。

未使用 `continue-on-error`，未删除失败测试，未恢复 OpenCode fallback。

## 最终验证

- typecheck run #116 / id `30354218370`：SUCCESS。
- test run #118 / id `30354218292`：SUCCESS。
- Linux generic unit：8/8 Turbo tasks success；Core 1,070 pass / 6 skip / 0 fail。
- Windows generic unit：SUCCESS。
- Linux Core isolation：6 pass / 0 fail / 10 assertions。
- Windows Core isolation：6 pass / 0 fail / 10 assertions。
- Linux lifecycle：17 pass / 0 fail / 93 assertions。
- Windows lifecycle：17 pass / 0 fail / 93 assertions。
- Linux full config/permission：305 pass / 3 skip / 0 fail / 551 assertions。
- Windows full config/permission：308 pass / 0 fail / 564 assertions。
- generated client：SUCCESS。
- HttpApi：SUCCESS；artifact `httpapi-1` / id `8686246980`。
- Linux E2E：SUCCESS；artifact `playwright-linux-1` / id `8686250999`。
- Windows E2E：SUCCESS；artifact `playwright-windows-1` / id `8686428755`。
- Linux boundary artifact：`unit-linux-1` / id `8686176658`。
- Windows boundary artifact：`unit-windows-1` / id `8686345236`。

## `opencode|OPENCODE` 最终分类

最终 inventory 共 4,168 行。分类规则按路径和语义互斥应用，合计与 inventory 行数一致：

| 分类 | 数量 | 处置与理由 |
| --- | ---: | --- |
| 测试、fixture、负向共存断言 | 2,710 | 用于证明 OpenCode 输入被忽略、OpenCode 树不变，或验证显式上游兼容；不作为默认用户入口 |
| 内部 package / service tag | 988 | `@opencode-ai/*`、`@opencode/*`、TypeId 和现有 workspace package ABI；第一阶段禁止全面重命名 |
| 文档与 specs | 115 | 历史设计、迁移说明或明确“不得使用 OpenCode 用户边界”的指导；不被生产代码加载为配置入口 |
| 内部源码路径与模块名 | 109 | `packages/opencode`、`OpencodePlugin` 等仓库内部路径/符号；不形成用户磁盘或进程边界 |
| 内部 Flag 兼容属性 | 105 | 属性名保持 `Flag.OPENCODE_*`，`read()` 统一映射到 `DEEPCODE_*`；原始 OpenCode 环境变量负向测试通过 |
| 开发/构建工具 | 56 | migration、trace、drizzle 和开发脚本，仅仓库维护使用，不进入默认产品运行链；记录为非发布工具债务 |
| S1-03 构建/发行边界 | 29 | launcher、bin、publish 和制品命名；由 S1-03 统一改造，当前升级与发布渠道已 fail-closed |
| 已禁用上游渠道实现 | 24 | `github.handler.ts` 等保留源码不可由当前 CLI 到达；公开命令立即返回 DeepCode-owned channel 尚未建立 |
| 上游 schema / provider / protocol | 21 | config schema、well-known、显式 OpenCode Provider ID/endpoint 等协议兼容；只有显式选择时生效 |
| 编译注入与协议元数据 | 11 | `OPENCODE_VERSION`、WASM/models 注入符号、OpenAI originator 等构建或上游 wire 兼容标识 |
| **未分类用户边界** | **0** | 无 |

重点例外：

- `packages/opencode/bin/opencode`、package bin 和 publish 脚本不是 S1-02 的发布成果；它们明确阻塞 S1-03，当前不存在可信 Release/upgrade 路径。
- `packages/opencode/src/cli/cmd/github.handler.ts` 仍含上游 URL，但 `github.ts` 已 fail-closed，生产 CLI 不导入或执行该 handler。
- `packages/core/src/plugin/provider/opencode.ts` 是显式 OpenCode-compatible Provider，不是 DeepCode 默认账户服务；默认 Account CLI 不再指向 OpenCode。

## 结论

S1-02-E 验收完成，S1-02-A/B/C/D/E 全部 DONE。DeepCode 默认用户边界、配置、持久化、生命周期与 OpenCode 共存隔离已由双平台全链测试证明。

产品总体仍为 NO-GO：可信 DeepCode launcher、归档名、Release/upgrade channel、checksum、rollback、`--purge` 和 GitHub Release 属于下一唯一代码任务 S1-03。
''')

readme_path = "docs/open-source-readiness/evidence/S1-02/README.md"
replace_required(readme_path, "> 状态：IN_PROGRESS", "> 状态：DONE")
replace_required(readme_path, "> 当前实施分支：`coexistence-boundary-audit`", "> 完成分支：`coexistence-boundary-audit`\n> 完成 PR：#7")
replace_required(
    readme_path,
    '| S1-02-E | `IN_PROGRESS` | 全链共存回归和字符串分类 | 配置/TUI/permission/lifecycle tests、CI boundary gate、分类证据与明确遗漏；构建输出留给 S1-03 | A-D | [边界审计](./test-results/S1-02-E-boundary-audit.md) |',
    '| S1-02-E | `DONE` | 全链共存回归和字符串分类 | 配置/TUI/permission/lifecycle tests、CI boundary gate、分类证据与明确遗漏；构建输出留给 S1-03 | A-D | [边界审计](./test-results/S1-02-E-boundary-audit.md) |',
)
old_tail = '''### S1-02-E：全链共存回归和字符串分类

- 基线：`develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`。
- 分支：`coexistence-boundary-audit`。
- 首批已确认测试债务：两个关键共存用例仍为 `.skip`；配置/TUI 测试仍包含 `OPENCODE_*`、`.opencode` 的旧产品断言。
- 执行顺序：先激活失败契约与 package-scoped boundary gate，再逐条修复测试或明确的生产遗漏，最后生成字符串分类和生命周期树哈希证据。

## 下一执行点

1. 激活 DeepCode-only、OpenCode-only、双配置并存测试，并新增 `.opencode` / `opencode.json(c)` 默认忽略的负向断言。
2. 在 Linux/Windows CI 中运行 `packages/opencode` 的 installation/config/permission 边界测试并上传日志。
3. 生成 `packages/core`、`packages/opencode` 的 `opencode|OPENCODE` 全量清单，逐条分类为内部命名、上游兼容、用户边界或遗漏。
4. 增加隔离 fixture，验证生命周期操作前后 OpenCode 目录树和 shell 配置哈希不变。
5. 全部通过后更新 PLAN 与本 evidence，将 S1-02 父任务标记 `DONE`。

## 当前结论

S1-02-A/B/C/D 已完成并合入 `develop`。S1-02-E 已从最新 `develop` 独立启动；父任务继续保持 `IN_PROGRESS`，产品仍为 NO-GO。
'''
new_tail = '''### S1-02-E：全链共存回归和字符串分类

- PR #7 已完成 DeepCode-only、OpenCode-only、双配置并存、TUI 树哈希、RuntimeFlags、完整 config/permission 和生命周期隔离回归。
- 修复 TUI migration、配置动态环境读取、Provider 凭据、插件/项目缓存/进程/网络身份等确认的用户边界遗漏。
- 对未验证的上游 WebUI、Account、IDE extension 和 GitHub Agent 渠道实行 fail-closed。
- 最终 inventory 为 4,168 行，全部归类；未分类用户边界为 0。构建/发行命名的 29 行明确归属 S1-03。
- 已验证代码 head `2442d6b11b7eb7add9ff6685af04e81c3615c657`：typecheck #116、test #118 全绿。
- Linux/Windows lifecycle 各 17 pass；Core isolation 各 6 pass；完整 config/permission Linux 305 pass、Windows 308 pass；generated client、HttpApi、双平台 E2E 全绿。

## 下一执行点

S1-02 父任务完成。下一唯一代码任务是 **S1-03：建立 DeepCode 安装、制品与 Release 边界**。不得继续依赖或发布 `opencode` launcher、上游归档名、上游 updater；S1-03 必须建立 DeepCode-owned artifact、checksum、rollback 和 release channel。

S1-01B、S1-04、S1-05 仍可按 PLAN 的依赖关系并行，但产品总体继续保持 NO-GO，Gate 1 未通过。

## 当前结论

S1-02-A/B/C/D/E 全部 DONE。默认用户配置、持久化、进程、网络和生命周期边界已与 OpenCode 隔离，并通过 Linux/Windows 全链验证。构建和公开发行闭环尚未完成，产品仍为 NO-GO。
'''
replace_required(readme_path, old_tail, new_tail)

plan_path = "docs/open-source-readiness/PLAN.md"
replace_required(plan_path, "> 文档版本：1.2", "> 文档版本：1.3")
replace_required(
    plan_path,
    "| 2026-07-28 |  1.2 | 回填实际实施进度、PR/CI 基线与远程交接入口；明确 S1-02-D 为 IN_REVIEW、S1-02-E 为下一执行点 | PR #2、PR #6、GitHub Actions 与远程分支复核 |",
    "| 2026-07-28 |  1.3 | 完成 S1-02-D/E 与父任务验收；回填 PR #6/#7、双平台全链 CI、字符串分类和下一唯一任务 S1-03 | PR #6、PR #7、typecheck #116、test #118 与 evidence |\n| 2026-07-28 |  1.2 | 回填实际实施进度、PR/CI 基线与远程交接入口；明确 S1-02-D 为 IN_REVIEW、S1-02-E 为下一执行点 | PR #2、PR #6、GitHub Actions 与远程分支复核 |",
)
replace_required(
    plan_path,
    '| 第一阶段 | `IN_PROGRESS` | S1-01A `DONE`；S1-02-A/B/C `DONE` | S1-02-D `IN_REVIEW`（PR #6）；S1-02-E `NOT_STARTED`；S1-01B 与其余 Stage 1 任务未完成 |',
    '| 第一阶段 | `IN_PROGRESS` | S1-01A `DONE`；S1-02-A/B/C/D/E 与父任务 `DONE` | 下一唯一代码任务 S1-03；S1-01B、S1-04、S1-05 及后续 Stage 1 任务仍未完成 |',
)
old_remote = '''- PR #2 `feat(identity): isolate DeepCode config and CLI` 已通过完整门禁并 squash 合入 `develop`。
- `develop` 对应 S1-02-C 合并提交：`babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`。
- S1-02-D 当前远程分支：`agent/s1-02-d-install-uninstall-guard`。
- S1-02-D 当前 PR：#6 `fix(lifecycle): fail closed DeepCode install and uninstall boundaries`。
- 写入交接文档前的实现 head：`06280508d4004104698987c23505794425a834ef`；后续文档提交会继续推进 PR head。
- 当前必要代码、测试和 evidence 均已推送到远程，不依赖旧容器中的未提交文件。'''
new_remote = '''- PR #2 / S1-02-C 已通过完整门禁并 squash 合入 `develop@babc3080f9d5c5c90dcf4abb16a0149e6dbc1eb8`。
- PR #6 / S1-02-D 已通过完整门禁并 squash 合入 `develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`。
- S1-02-E 当前远程分支：`coexistence-boundary-audit`；PR #7 `test(identity): close S1-02-E coexistence boundary gaps`。
- S1-02-E 已验证代码 head：`2442d6b11b7eb7add9ff6685af04e81c3615c657`；typecheck #116、test #118 全部 SUCCESS。
- 代码、测试、CI boundary gate、inventory 和 evidence 均已推送到远程，不依赖旧容器中的未提交文件。'''
replace_required(plan_path, old_remote, new_remote)
replace_required(
    plan_path,
    '| S1-02-D | `IN_REVIEW` | 安装检测、升级和卸载边界 fail-closed；PR #6 等待最终 CI/证据回填与合并 |\n| S1-02-E | `NOT_STARTED` | 全链共存回归、字符串分类和父任务最终验收 |',
    '| S1-02-D | `DONE` | 安装检测、升级和卸载边界 fail-closed；PR #6 已合入 `develop@c848bc537e8c5677c36a360dd00122745a2f5b2e` |\n| S1-02-E | `DONE` | 全链共存回归、4,168 行字符串分类、双平台最终验收；PR #7 |',
)
replace_required(
    plan_path,
    'S1-02-D 合入后，下一唯一代码执行点是 **S1-02-E**。S1-02-E 完成前，不得开始 S1-03，也不得把 S1-02 父任务标记为 `DONE`。',
    'S1-02-A/B/C/D/E 与父任务已完成。下一唯一代码执行点是 **S1-03**。S1-03 完成前，不得发布 DeepCode launcher/归档或恢复任何上游 updater。',
)
replace_required(plan_path, '**状态**：`IN_PROGRESS`\n**子任务进度**：S1-02-A/B/C `DONE`；S1-02-D `IN_REVIEW`（PR #6）；S1-02-E `NOT_STARTED`', '**状态**：`DONE`\n**子任务进度**：S1-02-A/B/C/D/E `DONE`；PR #6 已合入，PR #7 完成最终验收')
old_evidence = '''- `packages/core/src/global.ts`：路径应用名仍为 `opencode`；
- `packages/core/src/database/database.ts`：数据库仍为 `opencode.db`；
- `packages/core/src/config.ts`、`packages/opencode/src/config/config.ts`：默认发现 `opencode.json(c)` 与 `.opencode`；
- `packages/core/src/flag/flag.ts`：用户环境变量仍为 `OPENCODE_*`；
- `packages/opencode/src/index.ts`：`scriptName("opencode")`；
- `packages/opencode/src/installation/index.ts`、`packages/opencode/src/cli/cmd/uninstall.ts`：升级/卸载仍指向 OpenCode。'''
new_evidence = '''- `Product` 统一 DeepCode 产品名、CLI、路径、配置文件/目录、环境变量前缀和 MDM domain；Core/CLI/TUI/MDM 不再默认发现 OpenCode 用户配置。
- Global Path、数据库、日志、项目缓存、插件、Agent/Plan/Session、MCP/ACP/OAuth 与用户网络身份已切换为 DeepCode。
- 安装、升级和卸载只处理 DeepCode；可信 Release 建立前 upgrade fail-closed，不执行上游下载或包管理器。
- DeepCode-only、OpenCode-only、双配置并存、目录树 SHA-256、RuntimeFlags、完整 config/permission 和 lifecycle 已在 Linux/Windows 通过。
- `opencode|OPENCODE` inventory 4,168 行全部分类，未分类用户边界为 0；launcher/build/publish 的 29 行由 S1-03 接管。
- 最终证据：[S1-02 README](./evidence/S1-02/README.md) 与 [S1-02-E boundary audit](./evidence/S1-02/test-results/S1-02-E-boundary-audit.md)。'''
replace_required(plan_path, old_evidence, new_evidence)

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
- S1-02-E：分支 `coexistence-boundary-audit`，PR #7
- S1-02-E 已验证代码 head：`2442d6b11b7eb7add9ff6685af04e81c3615c657`
- 已验证 CI：typecheck #116 / id `30354218370` SUCCESS；test #118 / id `30354218292` SUCCESS
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
6. PR #7：test(identity): close S1-02-E coexistence boundary gaps

二、重新核验远程实时状态
- develop、master 当前 HEAD
- PR #7 当前 head、状态、mergeability、changed files、reviews/comments
- PR #7 最新 typecheck/test workflow 和所有 job
- PR #7 是否已 squash 合入 develop
- coexistence-boundary-audit 是否仍存在

已知验证基线：
- S1-02-D 已合入 develop@c848bc537e8c5677c36a360dd00122745a2f5b2e
- S1-02-E 已验证代码 head：2442d6b11b7eb7add9ff6685af04e81c3615c657
- typecheck #116 / 30354218370：SUCCESS
- test #118 / 30354218292：SUCCESS
- Linux/Windows unit、lifecycle、完整 config/permission、E2E、generated client、HttpApi 全绿

三、执行逻辑
A. PR #7 仍开放且最终文档 head CI 全绿：
1. 核验 evidence、PLAN 与代码一致。
2. 核验没有未解决 review thread。
3. squash 合入 develop。
4. 从最新 develop 创建独立功能分支，领取 PLAN 的下一唯一代码任务 S1-03。

B. PR #7 有失败：
1. 获取失败 job 的完整日志和 artifact。
2. 分类 PRODUCT_DEFECT、TEST_DEFECT、ENV_BLOCKED 或 FLAKY。
3. 做最小根因修复并重跑完整 CI，不得放宽门禁。

C. PR #7 已合入：
1. 核验 develop 上 S1-02 evidence 完整。
2. 直接开始 S1-03，不重做 S1-02，不提前实施 S1-04/Release 后续门禁。

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
- 写入时 PR #7 尚未宣称已合并；是否合并必须以 GitHub 当前状态为准。
- 产品继续为 NO-GO，直到 Gate 1 全部通过。
''')

for path in [audit, root / readme_path, root / plan_path, handoff]:
    if not path.read_text().strip():
        raise SystemExit(f"empty finalized document: {path}")

print("finalized S1-02-E documentation")
