# DeepCode S2/S3 交接提示词（canonical session prompt）

> 生成时间：2026-08-04
> 交接人：小路的数字分身
> 目标：新开 session **一次性推进 DeepCode 第二阶段 S2-01~S2-08 与第三阶段 S3-01~S3-04 的全部剩余任务**
> 计划总纲：`docs/open-source-readiness/PLAN.md`（Gate 1 定义 652-662 行；S2 范围 668-853 行；S3 范围 855-1080 行）
> 上一阶段交接：`docs/open-source-readiness/HANDOFF_2026-08-04.md`（第一阶段 Gate 1 冲刺）
> 本次进度证据：`docs/open-source-readiness/evidence/S1-08/README.md`（install.sh E2E + 真实首任务）

## 0. 现状一句话

**Gate 1 = GO，第一阶段 9/9 完成，产品发布判断 = GO。** develop 分支 HEAD = `7d25809`（已 push）。第二阶段 S2-01 可立即启动，S2-02~S2-08 依依赖串行解锁；第三阶段 S3-01 可做设计研究（Gate 2 解锁实现）。

## 1. 仓库与远程状态（必须复核，不要信任本文 SHA）

- 仓库：`~/Code/deepseek-src/deepcode`（= `/Volumes/Doc/Code/deepseek-src/deepcode`）
- 分支：`develop`（实施基线）；`master`（发布/默认分支）；`feat/35-integration`（4168 文件差异未合入）
- 远程：`github.com/yuanchenglu/deepcode`，`gh` 已登录 yuanchenglu
- **开工第一步**：`git pull origin develop` + `git log --oneline -3` 复核实时状态，不能只信交接文档

## 2. 第一阶段已验证事实（Gate 1 全部条件绿）

| 条件 | 结果 | 证据位置 |
|---|---|---|
| VM-001~004 install.sh E2E | ✅ 安装/SHA256/幂等/升级回滚/卸载隔离 | evidence/S1-08/README.md |
| 真实 DeepSeek 首任务 | ✅ 4 任务：对话/推理/工具调用/权限拒绝 | evidence/S1-08/README.md §8 |
| OpenCode/OMO 校验值不变 | ✅ deepcode 运行前后哈希不变 | evidence/S1-08/README.md §5 |
| Required CI 全绿 | ✅ test+typecheck success（HttpApi 超时是 flaky，重跑过） | gh run list --workflow=test.yml |
| Release v0.1.0-alpha.1 | ✅ 非 draft 非 prerelease，8 资产，SHA-256 与 API digest 一致 | gh release view v0.1.0-alpha.1 |
| 官网 Claim Coverage | ✅ install 命令正确；models.dev 自动注册 deepseek provider（env=DEEPSEEK_API_KEY） | ~/Code/www/deepcode/index.html |
| 已知限制公开 | ✅ 官网有 Alpha 限制段 | docs/install/index.html |

## 3. 关键环境事实（踩过的坑，别重踩）

### 网络约束与绕行
- **本机 github.com 大文件下载被阻断**（13~17KB/s）；api.github.com、api.deepseek.com、国内网络通
- **绕行**：ghfast.top / gh-proxy.com 代理下载 release 资产（42MB 仅 15s），SHA-256 一致后 scp 到 VM
- **VM（Parallels macOS15）**：`ssh bluth@192.168.64.6`，arm64，免密，`prlctl list` 查 UUID `{9a529706-94a4-41b4-8151-91b16e221346}`
- VM 已装 `~/.deepcode/bin/deepcode`（v0.1.0-alpha.1）；VM 上 ghfast.top 可用
- install.sh 下载段固定走 github.com，E2E 用包装脚本执行校验+安装段（67-160 行纯本地逻辑）

### 真实 DeepSeek 任务
- 配置：`export DEEPSEEK_API_KEY=sk-...`（models.dev 自动注册 deepseek provider，env=DEEPSEEK_API_KEY，api=https://api.deepseek.com，npm=@ai-sdk/openai-compatible）
- 验证过的模型名：`deepseek-v4-pro`（deepcode run 自动路由）
- 权限隔离已验证：工作目录外文件访问 auto-reject

### 类型检查（从包目录跑）
```bash
cd packages/core && bun typecheck      # tsgo --noEmit
cd packages/opencode && bun typecheck  # tsgo --noEmit
cd packages/oh-my-deepagent && bun typecheck  # tsc --noEmit
cd packages/deepcode-gateway && bun typecheck # tsgo --noEmit
```
当前 4 包全部通过。

## 4. 第二阶段 S2 现状与关键发现（重要！）

### S2 任务卡依赖链
```
S2-01（调用图/来源图/契约清单）← 唯一可立即启动，Gate 1 已解锁
S2-02（Provider/Routing/Harness 契约）← S2-01
S2-03（Built-in Agent Plugin 与宿主安全桥）← S2-01 + S2-02
S2-04（角色/技能/规划/评审）← S2-03
S2-05（Delegation/Subagent/Multi-Agent）← S2-04
S2-06（Gateway Core 安全与生命周期）← S2-01 + S2-03
S2-07（飞书 Stable + 其他 Adapter 分级）← S2-06
S2-08（可靠性/可观察性/性能/核心能力发布）← S2-02 + S2-05 + S2-07
```

### 本次审计关键发现（新 session 直接复用）
- **`packages/core/src/deepcode/` 18 个 Harness 模块，除 4 个外全部 0 生产消费者**：
  - 有消费者：`memory-granularity`、`scope-creep-guard`、`okr-plan`、`review-anti-drift`（各 1 个）
  - 0 消费者：`intent-router/classifier`、`reasoning/manager`、`router/model-router`、`hard-constraint/*`、`immune-system/reviewer`、`prompt-signal/tagger`、`context-layout/window-manager`、`meta-directives/handlers`、`prefix-context`、`skill-evolution`、`okr-plan` 等
  - **含义**：S2-01 的核心结论不是"从零写"，而是**把已存在但未接生产的模块分类为 Keep/Adapt/Bridge/Replace/Remove**，然后 S2-02 把 Keep/Adapt 模块接入生产入口
- `packages/oh-my-deepagent/`（@deepcode/oh-my-deepagent）：54 文件，有 role/skill/planning/memory/runtime/tool/transport/llm 目录
- `packages/deepcode-gateway/`（@deepcode/gateway）：55 文件，含 session-bridge.ts、plugin.ts、email/matrix adapter

### S2-01 建议执行路径
1. 从 CLI/Server 生产入口反向追踪（`packages/opencode/src/cli/cmd` → `packages/core/src/session/runner` → `packages/core/src/deepcode`）
2. 对 18 个模块逐个分类（Keep/Adapt/Bridge/Replace/Remove），记录源码调用者、状态所有者、副作用执行者、权限检查点、许可证来源
3. 更新 `docs/open-source-readiness/13_V0.1_MIGRATION_MANIFEST.md`
4. 冻结 Host↔Plugin、Host↔Gateway 契约

## 5. 第三阶段 S3 状态

- S3-01~S3-03 是**设计阶段**（UX 基线→线框原型→DESIGN.md），S3-01 依赖 Gate 2（即 S2-08 完成后才解锁**实现**，但 S3-01 的设计研究不依赖 Gate 2）
- 严格讲：S3-01 的"允许修改"是设计文档/研究材料/测试工具，不做视觉重构；S3-03 需要用户批准主方向后才能 S3-04
- **注意**：用户希望"一次性全部完成"，但 PLAN 8.1 有"设计先行硬门禁"：S3-03 完成并获得用户批准前禁止大规模改 packages/app、packages/ui。**新 session 可以并行做 S3-01 设计研究（UX 审计、用户访谈、组件清单），但 S3-04 起的实现必须等用户批准**

## 6. 一次性完成策略（用户明确要求）

用户授权修改 PLAN.md。建议策略：
1. **S2-01 立即启动**（本轮核心，解锁后续全部）
2. S2-01 完成后**串行推进 S2-02~S2-08**，每步验证（typecheck + 测试从包目录跑）
3. S3-01 设计研究可与 S2 并行（写设计文档不需要改代码）
4. S2 完成前不要宣称任何 S2 能力已交付；每个任务卡必须满足 PLAN 验收条件才标 DONE
5. 每完成一个任务卡：更新 PLAN.md 状态 + evidence + commit（conventional commit 双语，直推 develop 含 `## 问题原因` / `## 技术债务`）

## 7. 项目规范提醒（根 AGENTS.md）

- conventional commit `type(scope): summary`，正文双语（English: 段 + 简体中文: 段）
- 测试/typecheck 从包目录跑；避免 `any`/try-catch；用 Bun API；Effect 4；TS 注释简体中文
- 直推 develop 时 commit 含 `## 问题原因` 和 `## 技术债务`
- 远程操作用 `gh`
- 每个论断用工具验证，不宣称未验证能力；测试自己写自己跑

## 8. 技术债务（S2 中需处理）

1. **HttpApi exerciser auth 模式 flaky 超时**（15min 红线，208 route 逐个 probe）→ S2-08 优化并行度或提高 timeout
2. **升级回滚用同版本模拟** → S2 需多版本 Release E2E
3. **版本号来源**：`packages/script/src/index.ts:34-48` 仍从 npm 拉上游版本，建议改 DeepCode 独立基线（workflow version input 硬编码是临时方案）
4. **feat/35-integration 分支** 4168 文件差异未合入，S2-03 接通插件时需决定合并策略
5. **Electron/Windows 签名** 缺证书，S2 阶段 continue-on-error 跳过

## 9. 关键命令速查

```bash
cd ~/Code/deepseek-src/deepcode
git pull origin develop && git log --oneline -3
gh run list --workflow=test.yml --limit 3
gh run list --workflow=typecheck.yml --limit 3
gh release view v0.1.0-alpha.1 --json assets,isDraft
cd packages/core && bun typecheck
cd packages/opencode && bun typecheck
cd packages/oh-my-deepagent && bun typecheck
cd packages/deepcode-gateway && bun typecheck
# VM
ssh bluth@192.168.64.6
# 官网源码
~/Code/www/deepcode/  (deepcode.starseas.org, deploy.sh deepcode 部署)
```
