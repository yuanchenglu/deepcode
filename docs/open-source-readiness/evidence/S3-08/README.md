# S3-08 打包、签名、公证、更新并发布 Desktop

> 日期：2026-08-05
> 基线：develop `da81517`（S3-07 DONE 后）
> 状态：IN_PROGRESS（步骤 1 Preview smoke DONE；步骤 2-6 依赖签名证书/Parallels → ENV_BLOCKED）

## 1. PLAN 步骤对照

| 步骤 | 状态 | 证据 |
|---|---|---|
| 1. 未签名 Preview + 启动/sidecar/WebUI smoke | ✅ | `electron-vite preview` 启动：sidecar connection started → server ready；userData=ai.deepcode.desktop.dev；desktop 测试 57/57 + build 成功 |
| 2. macOS 签名/公证/hardened runtime/Gatekeeper | ⛔ ENV_BLOCKED | 需 macOS 签名证书 + 公证凭据（本地无） |
| 3. 独立更新仓库/channel/签名 manifest/回滚 | ⛔ ENV_BLOCKED | 需发布凭据 + 受控 Runner（不得用 OpenCode feed） |
| 4. Windows/Linux 签名/安装/卸载 | ⛔ ENV_BLOCKED | 需对应平台 Runner |
| 5. Parallels 共存/升级/回滚/卸载 | ⛔ ENV_BLOCKED | 需 Parallels/macOS 快照环境 |
| 6. 官网 Desktop 下载入口/文档 | ⛔ ENV_BLOCKED | 需官网发布权限 |

## 2. 步骤 1 验证记录（本机完成）

- **Electron 二进制**：经 npmmirror 镜像安装（github.com 阻断 → ELECTRON_MIRROR）
- **models.dev 阻断**：复用 `packages/opencode/test/tool/fixtures/models-api.json`（generate.ts 已有 MODELS_DEV_API_JSON 机制，零代码改动）
- **desktop 全量测试**：57 pass / 0 fail（含此前 Electron 缺失的 1 个失败）
- **desktop build**：`bun run build`（electron-vite）成功，11.49s
- **Preview 启动**：sidecar 启动 + loading task finished + server ready；**userData 路径 ai.deepcode.desktop.dev 验证 S3-07 身份生效**
- 退出 smoke：kill 后 sidecar/renderer 正常退出（exitCode 15 为 kill 信号，符合预期）

## 3. 结论

**本地可完成的步骤 1 已全绿**。步骤 2-6（签名/公证/更新/跨平台/Parallels/官网）需要外部凭据与受控环境，**标记 ENV_BLOCKED**——按 PLAN 明确要求"缺少外部条件时标记 ENV_BLOCKED，不能在本地生成未签名包后宣称 Stable"。

## 5. 用户决策（2026-08-05）

**"我不考虑花钱申请 macOS 签名"** → S3-08 步骤 2（macOS 签名/公证）正式**放弃**（用户决策），同时影响：
- 步骤 3（更新仓库签名 manifest）：依赖签名证书 → 一并放弃
- Gate 3 "macOS 签名/公证/Gatekeeper/升级/回滚全绿"：**永久不满足**（用户明确不投入）
- Desktop 发布：以**未签名 Preview/开发构建**交付；正式 Stable 发行需用户未来补证书（记录为长期债务）

**处理原则**：不伪造签名成功、不把 ENV_BLOCKED 写为 pass（R-10 强制失败分类）。未签名包仅用于内部验证，不宣称 Stable。

## 4. Gate 3 对照

| Go 条件 | 状态 |
|---|---|
| Design Acceptance 全绿 | ⏳ 待用户批准高保真原型（S3-03 未决项） |
| WebUI unit/E2E/visual/a11y/performance 全绿 | ✅ unit 537 + e2e 12 + axe 2/2（性能基线待真实负载） |
| macOS 签名/公证/Gatekeeper/升级/回滚全绿 | ⛔ ENV_BLOCKED |
| DeepCode/OpenCode 共存 | ⛔ ENV_BLOCKED（Parallels） |
| Desktop 仅访问 DeepCode 数据/更新源 | ✅ 身份迁移完成（S3-07） |
| 官网制品/checksum/签名/Commit 可追踪 | ⛔ ENV_BLOCKED |

**Gate 3 结论**：代码侧全部完成；发布侧 3 项依赖外部凭据（ENV_BLOCKED），2 项依赖用户批准设计（S3-03 未决）。
