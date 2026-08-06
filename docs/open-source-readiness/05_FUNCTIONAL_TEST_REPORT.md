# DeepCode 功能验证报告

> 创建日期：2026-07-27
> 测试基线：当前 `develop` 工作区；业务源码与 `master@ff79c93cc8c865349a74e6844d4881be99f5ce65` 一致，后续提交为文档整理
> 总体结论：**FAIL / PARTIAL RUNTIME EVIDENCE / NO-GO**
> 发行计划：[15_V0.1_RELEASE_AND_COEXISTENCE_PLAN.md](./15_V0.1_RELEASE_AND_COEXISTENCE_PLAN.md)

## 更新记录（Update Log）

| 时间 | 更新内容 | 来源 |
|---|---|---|
| 2026-07-27 | 补充 Package Typecheck/Test、官网/npm/Release、发行脚本和共存核验；更新 v0.1 Alpha 门禁 | 开源准备复核 |

## 1. 结论

当前代码不是“完全无法运行”，但没有形成属于本项目的可安装 Release，也没有通过真实 DeepSeek、安装、共存和官网 E2E，因此保持 NO-GO。

已确认：

- 三个核心 Package Typecheck 通过；
- Gateway 单元测试通过；
- oh-my-deepagent 和 opencode 大量测试通过，但当前环境存在端口绑定和 npm Registry 假设导致的失败；
- 官网公开安装命令指向第三方 npm 包；
- 发行脚本和运行时命名空间仍大量复用 OpenCode；
- `oh-my-deepagent` 和 Gateway 尚未证明存在生产入口。

## 2. 已完成验证

### 2.1 Typecheck

| Package | 命令 | 结果 |
|---|---|---|
| `packages/opencode` | `bun typecheck` | Pass |
| `packages/deepcode-gateway` | `bun typecheck` | Pass |
| `packages/oh-my-deepagent` | `bun typecheck` | Pass |

Typecheck 只证明当前类型边界可编译，不证明安装、集成或产品主张成立。

### 2.2 Tests

| 范围 | 结果 | 解释 |
|---|---|---|
| `packages/deepcode-gateway` | 57 pass / 0 fail | 主要覆盖 Parser、Crypto、接口和局部逻辑；未覆盖当前完整鉴权/Host E2E |
| `packages/oh-my-deepagent` | 196 pass / 12 fail | 12 项均在当前受限环境因端口绑定 `EADDRINUSE` 失败；需在正常主机复测 |
| `packages/opencode` installation/permission/provider | 532 pass / 7 fail | 4 项端口绑定失败；3 项因本机 npm Registry 与测试硬编码 npmjs 不一致 |

这些结果不支持“全绿”结论，也不能把所有失败直接归因于产品代码。正常主机和 CI 仍需复测。

### 2.3 静态和发行事实

- `reasoning_effort` 内部字段与协议读取字段不一致；
- Model Routing 在当前 Model resolve 之后决策；
- Permission deny 可进入 preapproved；
- Gateway 生命周期未把 Adapter Map 传入 Server 鉴权路径；
- Gateway 使用无界 Queue、首个 Adapter 回包和无效 Timeout 顺序；
- `deepcode` 构建、postinstall、publish 和 upstream Release 名称不一致；
- CI/Publish 仍以 `dev` 和 `anomalyco/opencode` 为主要目标；
- DeepCode 默认复用 OpenCode 配置、数据、数据库、环境变量和卸载路径；
- Desktop 仍使用 OpenCode App ID、协议、产品名和更新源。

### 2.4 线上安装链

| 项目 | 状态 |
|---|---|
| `https://deepcode.starseas.org` | 在线，但公开 `npm install -g deepcode` |
| npm `deepcode` | 第三方项目，不属于本仓库 |
| npm `deepcode-ai` | 已被其他项目占用 |
| `yuanchenglu/deepcode` Releases | 无本项目可安装 Release |
| 官网源码与部署链 | 当前仓库未找到，Not Traced |

因此当前不能执行有意义的官网安装 Smoke；在 Parallels 中运行现有命令只会验证第三方包。

## 3. Runtime 结论

静态核查确认 `packages/oh-my-deepagent` 包含 AgentRuntime、Message Loop、ToolRunner、MemoryStore、Provider、Transport 和 13 个 Role。

| 项目 | 状态 |
|---|---|
| 独立可运行实现存在 | Static Pass |
| 被 DeepCode CLI/安装产物调用 | Not Proven |
| 已形成第二套生产 Runtime | Not Proven |
| 与宿主发生状态冲突 | Not Tested |
| 应当删除 | Withdrawn / Audit Required |

源码中存在独立实现不能证明它已成为内置插件，也不能作为删除依据。

## 4. 已确认失败项

### v0.1 Alpha P0

- 官网安装源不属于本项目；
- OpenCode/Oh-my-OpenAgent 共存隔离失败；
- Build/Postinstall/Publish 名称不一致；
- Required CI 和当前默认分支/仓库不一致；
- Provider reasoning 和 Model Routing 未可靠 Applied；
- Permission deny 预批准；
- README 公开主张超过当前证据。

### 后续版本 P0

- Gateway 入站鉴权链不完整；
- Gateway 回包、Timeout、Queue、Session Key/TTL/容量不足；
- oh-my-deepagent 生产入口、来源和 Host-Plugin Contract 未证明；
- Desktop 与 OpenCode 身份冲突。

## 5. 未完成验证

- 可追踪到 Commit 的 Release Build；
- Provider Mock Wire Contract；
- 真实 DeepSeek API E2E；
- Host 本地任务 E2E；
- macOS/Linux 安装、升级、卸载；
- Parallels VM-001~004 共存矩阵；
- 官网安装 Smoke；
- Plugin Orchestration/Parent/Subagent/Multi-Agent E2E；
- Gateway Core/飞书真机 E2E；
- Desktop 共存、签名、公证和升级。

## 6. v0.1 Release Decision

当前：**NO-GO**。

Go 之前必须：

- 官网安装源属于本项目；
- 发行身份和共存 Contract 通过；
- Alpha 暴露面 P0=0；
- Provider Contract、本地任务 E2E 通过；
- Required CI 全绿；
- Parallels VM-001~004 和官网安装 Smoke 通过；
- README Claim Evidence Coverage=100%。

Gateway、全量 Agent 和 Desktop 不阻塞 v0.1 Alpha，但必须不进入默认制品或 Stable 主张。

## 附录 A：测试限制

- 当前执行环境对部分本地监听测试有限制，端口相关失败需在正常主机/CI 复测。
- 本机 npm Registry 配置暴露了测试对 npmjs 的硬编码假设。
- 未使用真实 DeepSeek API Key，Provider 线上行为仍未验证。

## 附录 B：Q&A 过程记录

#### Q#1：为什么有数百项测试通过仍然是 NO-GO？

> 2026-07-27 | 功能验证复核 | 发行链证据

**问题**：Package 局部测试证明了代码基础，但用户仍无法从本项目安装，并且默认会碰触 OpenCode 状态。

**答案**：通过数量不能替代安装来源、共存、安全和真实任务门禁；这些失败直接影响用户，优先级高于局部单元测试覆盖率。

> [→ 正文 §1、§4、§6 已体现此结论]
