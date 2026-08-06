# S1-02-C 配置发现与 CLI 身份验证

> 日期：2026-07-28
> 实施分支：`agent/s1-02-c-identity`
> 实现验证提交：`67c0fbbc8c22ddd4baf5086a1b669dcd452caad1`
> 状态：`DONE`

## 实施范围

- 单一产品身份：`packages/core/src/product.ts`。
- Core：配置发现、Global Path、数据库名、用户环境变量。
- CLI：主配置发现、共享配置路径、help/version、进程环境标记。
- TUI：`.deepcode` 目录与 TUI 配置发现。
- MDM：DeepCode 系统目录、测试目录和 managed plist domain。
- Server Auth：用户侧 Basic Auth 环境变量和默认用户名切换为 DeepCode。
- 测试基础设施：公共 `tmpdir({ config })`、HttpApi 隔离目录、配置 fixture 和共存用例统一写入 DeepCode 命名空间。

## 关键修复

1. `Product` 集中定义 `DeepCode`、`deepcode`、`.deepcode`、`deepcode.json(c)`、`DEEPCODE_*` 和 managed domain。
2. Core、CLI、TUI、MDM 不再发现 OpenCode 本地配置，也不添加兼容 fallback。
3. CLI 用户可见身份、运行进程标记和运行时选项环境变量切换为 DeepCode。
4. Server Auth 使用 `DEEPCODE_SERVER_PASSWORD` / `DEEPCODE_SERVER_USERNAME`，默认用户名为 `deepcode`。
5. 测试 fixture 不再把模拟模型配置写入 `opencode.json`；HttpApi 测试数据、配置和数据库全部进入 DeepCode 隔离目录。
6. CI 从不可用的 Blacksmith runner 迁移到 GitHub-hosted runner，required check 名称保持 `typecheck` / `test`。

## 静态契约检查

执行：

```bash
rg -n 'targets: \["\.opencode"|files\("opencode"|\["opencode\.json"|dir\.endsWith\("\.opencode"' <changed-files>
rg -n 'process\.env\.(OPENCODE|\["OPENCODE)|process\.env\["OPENCODE' <changed-files>
tsc --noEmit --noResolve --skipLibCheck --target ES2023 --module ESNext --moduleResolution bundler <changed-ts-files>
```

结果：

- 配置发现中未发现 `.opencode`、`opencode.json(c)`；
- 改动的用户边界中未发现用户侧 `process.env.OPENCODE_*` 直接读写；
- TypeScript 解析未产生 TS1xxx 语法错误；正式 package typecheck 结果见下节。

## CI 与 package 验证

### Typecheck

- Workflow run：`30297545744`
- Job：`typecheck`
- 结果：`SUCCESS`

执行范围：

```bash
bun --cwd packages/core typecheck
bun --cwd packages/opencode typecheck
```

两个 package 均通过。

### Test

- Workflow run：`30297546205`
- 实现验证提交：`67c0fbbc8c22ddd4baf5086a1b669dcd452caad1`

已通过：

- Linux 全量 unit test；
- generated client 一致性检查；
- Linux app E2E；
- HttpApi exerciser：`coverage`、`auth`、`effect` 三种模式全部通过；每种模式覆盖 208 个场景，`missing=0`、`extra=0`；
- HttpApi 日志 artifact：`httpapi-1`，artifact id `8665412702`，digest `sha256:ef8fc7a946a6f6ba1dd8bba8c4294d2ef09b704fed9ab142eb8e422cdc35aecd`。

Windows unit/E2E 属于超出 S1-02-C 最低验收范围的扩展矩阵，仍由最终 PR head 的 `test` required check 统一把关；未通过前不会自动合入 `develop`。

## 共存结论

- 仅存在 `opencode.json(c)` / `.opencode` 时，DeepCode 不加载该配置。
- DeepCode 与 OpenCode 配置并存时，DeepCode 只读取 `deepcode.json(c)` / `.deepcode`。
- 测试运行不写入 OpenCode 数据、配置、状态、缓存或数据库命名空间。
- 本任务未恢复任何 OpenCode 本地配置 fallback。

## 保留的 OpenCode 字符串分类

| 类型 | 示例 | 处理 |
| --- | --- | --- |
| 内部 package/service tag | `@opencode-ai/*`、`@opencode/Config` | 第一阶段允许保留，不参与用户磁盘边界 |
| 上游 schema/protocol | `https://opencode.ai/config.json`、`/.well-known/opencode` | 在 DeepCode 自有 endpoint/协议迁移前显式保留，S1-02-E 复核 |
| 内部 Flag 属性名 | `Flag.OPENCODE_CONFIG` 等 | 仅为内部 API；实际读取 `DEEPCODE_*`，避免第一阶段扩散式重命名 |
| 构建/制品名 | `bin/opencode` 等 | 明确留给 S1-03，不作为 S1-02-C 完成声明 |

## 结论

S1-02-C 的身份、配置发现、CLI、Server Auth、测试 fixture 与共存隔离契约已经实现并通过规定的 package typecheck、全量 Linux unit、HttpApi 三模式和 Linux E2E 验证，状态更新为 `DONE`。下一执行点为 S1-02-D；只有本 PR 经最终 required checks 自动 squash 合入 `develop` 后才可领取。
