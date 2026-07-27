# S1-02 DeepCode 用户边界与共存隔离

> 状态：IN_PROGRESS
> 启动日期：2026-07-27
> 基线分支：`develop`
> 前置证据：[S1-01A](../S1-01A/README.md)

## 假设

- 假设：内部 `@opencode-ai/*` 包名可在第一阶段保留，但用户可见、持久化、配置、环境变量、安装和卸载边界必须默认属于 DeepCode。
- 依据：当前源码仍把 `opencode` 用于 Global Path、数据库、配置发现、环境变量、CLI、升级和卸载。
- 反证条件：若某个内部名字参与磁盘路径、网络目标、进程协议、配置发现或删除清单，则它属于用户边界，不能作为“内部命名”保留。
- 置信度：确定。

## 启动审计

| 边界 | 当前证据 | 风险 |
| --- | --- | --- |
| Global Path | `packages/core/src/global.ts` 的 `app = "opencode"` | DeepCode 与 OpenCode 共享数据、配置、缓存和状态目录 |
| Test Home | 同文件读取 `OPENCODE_TEST_HOME` | 测试契约仍以 OpenCode 环境变量为入口 |
| Database | `packages/core/src/database/database.ts` 生成 `opencode.db` / `opencode-<channel>.db` | 会打开或创建 OpenCode 数据库 |
| Environment | `packages/core/src/flag/flag.ts` 读取 `OPENCODE_*` | DeepCode 会继承 OpenCode 用户配置 |
| Core config | `packages/core/src/config.ts` 发现 `opencode.json(c)` 和 `.opencode` | 默认加载 OpenCode 项目配置 |
| CLI config | `packages/opencode/src/config/config.ts` 再次发现 OpenCode 配置、schema 和 well-known | 两套配置路径都需要统一修复 |
| CLI identity | `packages/opencode/src/index.ts` 使用 `scriptName("opencode")` | help/error/process identity 错误 |
| Install/upgrade | `packages/opencode/src/installation/index.ts` 请求 opencode.ai、npm、brew、Scoop、Chocolatey 和 anomalyco Release | 可能下载或升级上游/第三方产品 |
| Uninstall | `packages/opencode/src/cli/cmd/uninstall.ts` 删除/清理 `.opencode` 并调用 OpenCode 包管理命令 | 可能破坏用户现有 OpenCode |
| Build overlap | `packages/opencode/package.json` 与 `script/build.ts` 仍输出 `bin/opencode` | 属于 S1-03 的构建/制品边界，S1-02 只定义并测试共存契约 |

## 强制子任务拆分

父任务同时修改 `packages/core` 与 `packages/opencode`，按 PLAN 必须拆分。执行顺序与文件所有权如下。

| 子任务 | 目标 | 主要文件所有权 | 依赖 | 验收证据 |
| --- | --- | --- | --- | --- |
| S1-02-A | 先建立失败的共存契约测试与 fixture | 两个 package 的新增/现有 test 文件；fixture 目录 | S1-01A | 测试能证明当前实现会读取/写入 OpenCode 边界 |
| S1-02-B | Core 路径、数据库和环境入口改为 DeepCode | `packages/core/src/global.ts`、`database/database.ts`、`flag/flag.ts` | A | Global/DB/env 单元测试通过；默认不读 `OPENCODE_*` |
| S1-02-C | 配置发现与 CLI 用户身份隔离 | `packages/core/src/config.ts`、`packages/opencode/src/config/config.ts`、`src/index.ts` | B | 只发现 `deepcode.json(c)`、`.deepcode`；help/version 无 OpenCode 身份 |
| S1-02-D | 安装检测和卸载目标 fail-closed | `packages/opencode/src/installation/index.ts`、`src/cli/cmd/uninstall.ts` | C | 不访问上游下载源、不清理 `.opencode`；生命周期 fixture 通过 |
| S1-02-E | 全链共存回归和字符串分类 | 只改测试、证据与明确遗漏；构建输出留给 S1-03 | A-D | 两个隔离 fixture + `rg` 分类 + package 级 typecheck/test |

同一文件只由表中一个子任务修改；后续发现必须跨所有权修改时，先更新本表再提交。

## 禁止范围

- 不在 S1-02 重命名内部 `@opencode-ai/*` package。
- 不提前改造跨平台归档名、二进制输出和 Release 产物；这些属于 S1-03。
- 不通过静默读取 OpenCode 配置实现“兼容”。
- 不运行会删除真实用户目录的测试；所有卸载验证必须在隔离 fixture/home 下执行。
- 未建立失败测试前，不直接批量替换字符串。

## 下一执行点

领取 `S1-02-A`：

1. 定位现有 Global、Config、Installation、Uninstall 测试目录；
2. 增加隔离 HOME/XDG fixture；
3. 写出“只有 OpenCode 配置时 DeepCode 不加载”和“双配置并存时各读各的”失败测试；
4. 从对应 package 目录运行测试并记录初始失败；
5. 完成后再进入 S1-02-B。

## 当前结论

S1-02 已完成源码入口审计和强制拆分，状态为 `IN_PROGRESS`。尚未修改产品 Runtime，也未将任何测试记为通过。
