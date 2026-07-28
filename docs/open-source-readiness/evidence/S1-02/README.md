# S1-02 DeepCode 用户边界与共存隔离

> 状态：IN_PROGRESS
> 启动日期：2026-07-27
> 基线分支：`develop`
> 当前实施分支：`coexistence-boundary-audit`
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
| S1-02-E | `IN_PROGRESS` | 全链共存回归和字符串分类 | 配置/TUI/permission/lifecycle tests、CI boundary gate、分类证据与明确遗漏；构建输出留给 S1-03 | A-D | [边界审计](./test-results/S1-02-E-boundary-audit.md) |

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
