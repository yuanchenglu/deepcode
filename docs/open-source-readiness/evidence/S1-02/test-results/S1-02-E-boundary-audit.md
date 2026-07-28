# S1-02-E 全链共存回归与字符串分类

> 状态：IN_PROGRESS
> 基线：`develop@c848bc537e8c5677c36a360dd00122745a2f5b2e`
> 分支：`coexistence-boundary-audit`

## 假设

- 内部 `@opencode-ai/*` package/service tag、上游 schema URL、well-known 协议和兼容 package 名可以保留。
- `.opencode`、`opencode.json(c)`、`OPENCODE_*`、OpenCode shell PATH、OpenCode 数据目录只要参与默认用户边界，就是遗漏，必须修复或以负向测试证明不会读取/修改。
- `packages/opencode` 目录名和 S1-03 所有的构建输出不在本子任务重命名。

## 文件所有权

- 配置共存：`packages/opencode/test/config/*`，必要时修改对应 `src/config/*` 明确遗漏。
- 生命周期隔离：`packages/opencode/test/installation/*`，必要时提取无副作用 helper。
- 环境与路径：`packages/core/test/*`、`packages/core/src/*`，只处理明确用户边界遗漏。
- CI：`.github/workflows/test.yml` 增加 package-scoped boundary gate 与审计 artifact，不关闭现有门禁。
- 证据：本文件和 `docs/open-source-readiness/evidence/S1-02/README.md`。

## 验收矩阵

| 场景 | 预期 |
| --- | --- |
| DeepCode-only | 加载 `deepcode.json(c)` / `.deepcode` |
| OpenCode-only | 不加载 `opencode.json(c)` / `.opencode` |
| 双配置并存 | 只加载 DeepCode 配置和插件 |
| OpenCode 环境变量 | `OPENCODE_*` 不改变 DeepCode 用户行为 |
| 生命周期 | OpenCode 目录树与 shell 配置哈希前后不变 |
| 字符串审计 | 每个保留的 `opencode` / `OPENCODE` 有明确分类理由 |
| 回归 | core/opencode typecheck；installation/config/permission；Linux/Windows unit、E2E、HttpApi、generated client 全绿 |

## 已发现基线问题

1. `packages/opencode/test/config/config.test.ts` 中 OpenCode-only、双配置并存关键用例仍被 `.skip`。
2. 配置测试仍使用 `OPENCODE_CONFIG_DIR`、`OPENCODE_DISABLE_PROJECT_CONFIG`、`OPENCODE_CONFIG_CONTENT` 等旧用户环境变量。
3. TUI 测试仍以 `.opencode/tui.json`、`OPENCODE_TUI_CONFIG` 作为默认入口。
4. 现有 root Turbo unit 不等价于 PLAN 要求的 `packages/opencode` installation/config/permission 回归，需要明确 package-scoped gate。
5. 生命周期测试已覆盖精确 shell PATH，但仍需隔离目录树哈希证据。

## 禁止项

- 不恢复任何 OpenCode fallback。
- 不修改 Release installer、制品名、checksum、rollback、`--purge` 或 GitHub Release 渠道。
- 不用 `continue-on-error`、删除测试或关闭检查换取通过。
