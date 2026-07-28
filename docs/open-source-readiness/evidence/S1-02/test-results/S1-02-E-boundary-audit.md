# S1-02-E 全链共存回归与字符串分类

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
