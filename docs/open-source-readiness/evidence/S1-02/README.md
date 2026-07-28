# S1-02 DeepCode 用户边界与共存隔离

> 状态：DONE
> 启动日期：2026-07-27
> 基线分支：`develop`
> 完成分支：`coexistence-boundary-audit`
> 完成 PR：#7
> 前置证据：[S1-01A](../S1-01A/README.md)

## 假设

- 假设：内部 `@opencode-ai/*` 包名可在第一阶段保留，但用户可见、持久化、配置、环境变量、安装和卸载边界必须默认属于 DeepCode。
- 依据：当前源码仍把 `opencode` 用于部分内部包名、协议路径与安装生命周期；用户边界必须与这些内部兼容标识分开治理。
- 反证条件：若某个内部名字参与磁盘路径、网络目标、进程协议、配置发现或删除清单，则它属于用户边界，不能作为“内部命名”保留。
- 置信度：确定。

## 启动审计

| 边界 | 启动时证据 | 风险 |
| --- | --- | --- |
| Global Path | `packages/core/src/global.ts` 的应用名为 `opencode` | DeepCode 与 OpenCode 共享数据、配置、缓存和状态目录 |
| Test Home | 同文件读取 `OPENCODE_TEST_HOME` | 测试契约仍以 OpenCode 环境变量为入口 |
| Database | `packages/core/src/database/database.ts` 生成 `opencode.db` / `opencode-<channel>.db` | 会打开或创建 OpenCode 数据库 |
| Environment | `packages/core/src/flag/flag.ts` 读取 `OPENCODE_*` | DeepCode 会继承 OpenCode 用户配置 |
| Core config | `packages/core/src/config.ts` 发现 `opencode.json(c)` 和 `.opencode` | 默认加载 OpenCode 项目配置 |
| CLI config | `packages/opencode/src/config/config.ts` 再次发现 OpenCode 配置、schema 和 well-known | 两套配置路径都需要统一修复 |
| TUI config | `packages/opencode/src/config/tui.ts` 与 `config/paths.ts` 发现 `.opencode` | TUI 会绕过 CLI 配置隔离 |
| Managed config | `packages/opencode/src/config/managed.ts` 使用 OpenCode 系统目录和 plist domain | MDM 配置会与 OpenCode 冲突 |
| CLI identity | `packages/opencode/src/index.ts` 使用 `scriptName("opencode")`，CLI logo 仍为 OpenCode | help/error/process identity 错误 |
| Install/upgrade | `packages/opencode/src/installation/index.ts` 请求 opencode.ai、npm、brew、Scoop、Chocolatey 和 anomalyco Release | 可能下载或升级上游/第三方产品 |
| Uninstall | `packages/opencode/src/cli/cmd/uninstall.ts` 删除/清理 `.opencode` 并调用 OpenCode 包管理命令 | 可能破坏用户现有 OpenCode |
| Build overlap | `packages/opencode/package.json` 与 `script/build.ts` 仍输出 `bin/opencode` | 属于 S1-03 的构建/制品边界，S1-02 只定义并测试共存契约 |

## 强制子任务拆分

父任务同时修改 `packages/core` 与 `packages/opencode`，按 PLAN 必须拆分。执行顺序与文件所有权如下。

| 子任务 | 状态 | 目标 | 主要文件所有权 | 依赖 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| S1-02-A | `DONE` | 先建立失败的共存契约测试与 fixture | 两个 package 的新增/现有 test 文件；fixture 目录 | S1-01A | [失败基线](./test-results/S1-02-A-baseline.md) |
| S1-02-B | `DONE` | Core 路径、数据库和环境入口改为 DeepCode | `packages/core/src/global.ts`、`database/database.ts`、`flag/flag.ts` | A | [Core 验证](./test-results/S1-02-B-core.md) |
| S1-02-C | `DONE` | 统一身份、配置发现与 CLI 用户身份隔离 | `packages/core/src/product.ts`、Core 配置/路径/DB/Flag；CLI 配置、TUI、MDM、CLI identity、Server Auth 与测试 fixture | B | [配置与 CLI 验证](./test-results/S1-02-C-config-cli.md) |
| S1-02-D | `DONE` | 安装检测和卸载目标 fail-closed | `packages/opencode/src/installation/index.ts`、Upgrade/Uninstall CLI、CI lifecycle gate 与 installation tests | C | [安装与卸载验证](./test-results/S1-02-D-install-uninstall.md) |
| S1-02-E | `DONE` | 全链共存回归和字符串分类 | 配置/TUI/permission/lifecycle tests、CI boundary gate、分类证据与明确遗漏；构建输出留给 S1-03 | A-D | [边界审计](./test-results/S1-02-E-boundary-audit.md) |

S1-02-C 扩大文件所有权的原因：配置发现存在 Core、CLI、TUI、MDM、Server Auth 和测试公共 fixture 等入口，只修改最初列出的三个文件会保留旁路；`global.ts`、数据库和 Flag 在 C 中仅改为消费统一 `Product` 常量，不改变 B 已验收的行为。

## 禁止范围

- 不在 S1-02 重命名内部 `@opencode-ai/*` package。
- 不提前改造跨平台归档名、二进制输出和 Release 产物；这些属于 S1-03。
- 不通过静默读取 OpenCode 配置实现“兼容”。
- 不运行会删除真实用户目录的测试；所有卸载验证必须在隔离 fixture/home 下执行。
- 未建立失败测试前，不直接批量替换字符串。

## 已实施结果

### S1-02-A：失败基线

- `packages/core/test/global.test.ts` 覆盖 Global Path、HOME 环境覆盖和数据库命名空间。
- `packages/opencode/test/config/config.test.ts` 覆盖“仅 OpenCode 配置”和“双配置并存”。
- 修复前 Core 结果为 1 通过、4 失败；配置隔离结果为 0 通过、2 失败。

### S1-02-B：Core 隔离

- Global data/cache/config/state/tmp 默认命名空间已切换为 `deepcode`。
- HOME 测试覆盖只读取 `DEEPCODE_TEST_HOME`，不读取 `OPENCODE_TEST_HOME`。
- 数据库默认文件名已切换为 `deepcode.db` / `deepcode-<channel>.db`。
- `Flag` 保留内部属性名以控制第一阶段改动面，但用户环境变量只从对应 `DEEPCODE_*` 读取。

### S1-02-C：统一身份、配置与 CLI 隔离

- 新增 `Product` 单一身份定义，集中管理产品名、CLI 名、路径 slug、配置文件、配置目录、环境变量前缀和 MDM domain。
- Core、CLI、TUI、MDM 均只发现 `deepcode.json`、`deepcode.jsonc` 与 `.deepcode`；不添加 OpenCode fallback。
- CLI `scriptName`、help logo、进程标记和运行时选项环境变量切换为 DeepCode。
- Server Auth 用户环境变量和默认 Basic Auth 用户名切换为 DeepCode。
- 公共测试 fixture、HttpApi config/data/database 隔离目录与模拟模型配置统一使用 DeepCode 命名空间。
- 共存用例验证仅有 OpenCode 配置时不加载，双配置并存时只读取 DeepCode。
- package typecheck、Linux/Windows unit、generated client、HttpApi `coverage/auth/effect` 三模式与 Linux/Windows E2E 已通过并合入 `develop@babc308`。
- `https://opencode.ai/config.json`、`/.well-known/opencode`、`@opencode-ai/*` 暂时分类为上游 schema/protocol/package 兼容标识；它们不参与本地配置发现、用户目录或 CLI 身份。S1-02-E 必须再次审计。

### S1-02-D：安装、升级与卸载 fail-closed

- 只识别直接位于 `.deepcode/bin` 的原生 DeepCode 二进制；嵌套目录、相似目录、OpenCode、`.local/bin` 和错误文件名均返回 `unknown`。
- Unix/Windows 使用原生路径大小写和 `.exe` 语义。
- 在 S1-03 建立 DeepCode Release 渠道前，latest 返回当前版本，upgrade 对全部 method 返回类型化错误；不执行外部 HTTP、安装脚本或包管理器命令。
- Upgrade CLI 删除“仍然安装”回退，只保留 curl 入口；未知安装位置立即停止。
- Uninstall CLI 只使用 DeepCode Global Path 和精确 DeepCode shell marker/PATH；删除 OpenCode 包管理器卸载分支。
- 精确 PATH 分量回归证明 `.opencode/bin`、`# opencode`、`.deepcode/bin-backup`、`.deepcode/bin-old` 和无关文本保持不变。
- Linux/Windows lifecycle suite 均为 17 pass / 0 fail / 93 assertions；typecheck、Linux/Windows unit、generated client、HttpApi 和 Linux/Windows E2E 全部通过。
- PR #6 已 squash 合入 `develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`；最终 PR head `d1af3992eef75c714ca419e4517079ea7c0a7740`，typecheck #70、test #72 全绿。

### S1-02-E：全链共存回归和字符串分类

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
