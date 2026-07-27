# S1-02 DeepCode 用户边界与共存隔离

> 状态：IN_PROGRESS
> 启动日期：2026-07-27
> 基线分支：`develop`
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
| S1-02-C | `IN_REVIEW` | 统一身份、配置发现与 CLI 用户身份隔离 | `packages/core/src/product.ts`、Core 配置/路径/DB/Flag；CLI `config/{config,paths,tui,managed}.ts`、`index.ts`、`cli/ui.ts`、`cli/cmd/deepcode-tui.ts`、相关测试 | B | [配置与 CLI 验证](./test-results/S1-02-C-config-cli.md) |
| S1-02-D | `NOT_STARTED` | 安装检测和卸载目标 fail-closed | `packages/opencode/src/installation/index.ts`、`src/cli/cmd/uninstall.ts` | C | 不访问上游下载源、不清理 `.opencode`；生命周期 fixture 通过 |
| S1-02-E | `NOT_STARTED` | 全链共存回归和字符串分类 | 只改测试、证据与明确遗漏；构建输出留给 S1-03 | A-D | 两个隔离 fixture + `rg` 分类 + package 级 typecheck/test |

S1-02-C 扩大文件所有权的原因：配置发现存在 Core、CLI、TUI 和 MDM 四个入口，只修改最初列出的三个文件会保留旁路；`global.ts`、数据库和 Flag 在 C 中仅改为消费统一 `Product` 常量，不改变 B 已验收的行为。

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
- 新增独立的活动共存测试文件；原始失败基线用例保留为历史证据，不作为完成门禁。
- `https://opencode.ai/config.json`、`/.well-known/opencode`、`@opencode-ai/*` 暂时分类为上游 schema/protocol/package 兼容标识；它们不参与本地配置发现、用户目录或 CLI 身份。后续必须在 S1-02-E 再次审计。

## 下一执行点

1. 等待 S1-02-C 的 package typecheck、配置测试和 CI 证据；失败则保持 `IN_REVIEW` 并修复。
2. S1-02-C 验证通过后领取 `S1-02-D`，使安装检测、升级和卸载目标 fail-closed。
3. S1-02-D 未完成前，S1-02 父任务保持 `IN_PROGRESS`，产品仍为 NO-GO。

## 当前结论

S1-02-A、S1-02-B 已完成；S1-02-C 代码和静态契约检查完成，状态为 `IN_REVIEW`。安装/卸载和最终全链共存回归尚未完成，因此不得进入 S1-03 或宣称 Alpha 可发布。
