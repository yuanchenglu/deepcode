# S3-07 DeepCode Electron 身份（步骤 1-3 完成）

> 日期：2026-08-05
> 基线：develop `2e97434`（S3-06 DONE 后）
> 状态：IN_PROGRESS（步骤 1 身份冻结 + 步骤 2 持久化/深链/日志迁移 DONE；步骤 4-6 待扩展）

## 1. 身份冻结（步骤 1）

| 身份 | 旧（OpenCode） | 新（DeepCode） | 位置 |
|---|---|---|---|
| appId | ai.opencode.desktop* | ai.deepcode.desktop.{dev,beta,prod} | electron-builder.config.ts + main/index.ts |
| productName | OpenCode* | DeepCode* | electron-builder.config.ts + main/index.ts |
| scheme | opencode | deepcode | electron-builder.config.ts + main/index.ts |
| publish owner/repo | anomalyco/opencode* | yuanchenglu/deepcode* | electron-builder.config.ts |
| artifact | opencode-desktop-* | deepcode-desktop-* | electron-builder.config.ts |
| package name | @opencode-ai/desktop | @deepcode/desktop | package.json |

## 2. 持久化键/深链/日志迁移（步骤 2）

| 项 | 旧 | 新 |
|---|---|---|
| settings store | opencode.settings | deepcode.settings（store-keys.ts） |
| updater store | opencode.updater | deepcode.updater（updater.ts） |
| window store | opencode.window.*.dat | deepcode.window.*.dat（windows.ts + persist.ts） |
| global store | opencode.global.dat | deepcode.global.dat（persist.ts + renderer + language + entry） |
| workspace/draft | opencode.workspace/draft.* | deepcode.workspace/draft.*（persist.ts + store-cleanup 实现根因） |
| deep-link scheme | opencode:// | deepcode://（index.ts + deep-links.ts + helpers.test） |
| deep-link event | opencode:deep-link | deepcode:deep-link（deep-links.ts + renderer） |
| 日志目录 | opencode/log | deepcode/log（logging.ts） |
| Tauri 迁移 | ai.opencode.desktop | ai.deepcode.desktop（migrate.ts 源定位） |

**迁移源保留**：migrate.ts 读取旧 Tauri `opencode.settings.dat` 文件（显式迁移路径，PLAN 步骤 4），目标写入 deepcode.settings。

## 3. 保留（业务语义，不迁移）

- server 认证 `username: "opencode"`（sidecar.ts、server.ts）——server 内部认证，非品牌
- provider ID `opencode`（settings-providers.tsx、dialog-select-model.tsx）——业务标识
- 配置文件 `opencode.json`/`opencode.config.ts`——DeepCode 兼容读取现有配置
- `virtual:opencode-server`——vite 虚拟模块名
- **WSL CLI 路径 `~/.opencode/bin/opencode` + 安装脚本 opencode.ai**——外部 CLI 依赖，DeepCode CLI 无独立 WSL 安装源，列为债务

## 4. 验证结果

```bash
cd packages/desktop && bun typecheck   # 0 错误（自身）
cd packages/desktop && bun test src/main/store-cleanup.test.ts src/main/index.test.ts  # 6 pass
cd packages/app && bun test src/utils/persist.test.ts src/context/language.test.ts    # 14 pass
```

## 5. 技术债务

- **WSL CLI 路径/安装源**：依赖 DeepCode CLI 发布 WSL 安装源后迁移（PLAN 步骤 5）
- **desktop `bun test src` 1 个既有失败**：Electron 二进制未安装（node_modules/electron 缺可执行），环境问题非代码回归（PLAN §11.1）
- 步骤 6（多窗口/深链/更新/崩溃恢复测试）依赖 Electron 运行环境，待二进制可用后补
- `bun run build`（electron-vite）需 Electron 二进制，当前环境不可验证
