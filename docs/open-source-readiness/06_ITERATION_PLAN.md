# DeepCode 开源迭代计划

> 目标：少加功能，以能够真实开源为唯一目标
> 原则：先删承诺、再修主链路、再建门禁、最后发布

## 1. 总体策略

当前项目不缺功能清单，缺的是可信闭环。

未来迭代遵循：

```text
安全 > 协议正确 > 主链路有效 > 测试可复现 > 安装发布 > 新功能
```

在 v0.1 发布前冻结：

- 新增 Gateway 平台。
- 新增 Agent 角色。
- 新增 Harness 模块。
- 新增自动 Skill 进化能力。
- 新增 UI 产品面。
- 新增企业/云功能。

## 2. 版本定义

### v0.1.0-alpha.1：安全与事实基线

目的：仓库不再具有明显安全风险，文档不再误导。

### v0.1.0-alpha.2：DeepSeek 主链路闭环

目的：核心产品主张真实生效。

### v0.1.0-beta.1：可安装、可测试、可贡献

目的：独立用户可复现。

### v0.1.0：可信开源首发

目的：核心场景稳定，公开主张有证据。

---

## 3. Milestone 0：范围冻结与仓库治理

### 目标

建立唯一真相源，停止继续扩大维护面。

### 工作项

#### M0-01 develop 作为默认开发分支

- 所有后续工作在 `develop`。
- `master` 只接受 Release Merge。
- 配置分支保护。

验收：

- develop 存在。
- CONTRIBUTING 明确分支策略。
- CI 在 develop PR 上运行。

#### M0-02 文档权威性

- 采用本目录文档。
- 旧需求/架构加 Historical 标记。
- README 删除未经验证的绝对化主张。

验收：

- README Claim 全部进入 Traceability。
- 无“模块存在即已完成”的状态。

#### M0-03 功能冻结

- Gateway 只保留一个首发实验平台候选。
- 正式角色缩减为 Build/Plan/Review。
- 其他全部标记 Experimental。

#### M0-04 Issue 基线

将 Code Review P0/P1 转为 GitHub Issues：

- Security。
- Provider Contract。
- Routing。
- Permission。
- Gateway。
- Testing。
- Packaging。

### 退出条件

- Scope Freeze 被记录。
- README 和 PRD 一致。
- 所有 P0 有 Owner 和验收测试。

---

## 4. Milestone 1：安全封锁

> 版本目标：v0.1.0-alpha.1

### M1-01 凭据轮换与历史清理

工作：

1. 轮换飞书等已暴露凭据。
2. 检查访问日志。
3. 清理 Git 历史。
4. 增加 Gitleaks/Secret Scan。
5. 增加 SECURITY.md。

验收：

- Secret Scan 对全历史通过。
- 旧凭据失效。
- 安全事件有记录。

### M1-02 Gateway 默认关闭

工作：

- 未配置不启动。
- 默认 localhost。
- 外部绑定要求显式 `public=true`、鉴权和 allowlist。
- README 标记 Experimental。

验收：GW-001、GW-002、GW-003。

### M1-03 Webhook 鉴权

首发只实现一个候选平台的完整鉴权，建议飞书。

其他 Adapter：

- 不默认注册。
- 不宣称支持。
- 可保留 Parser/Test。

验收：

- 正确签名接受。
- 错签名、过期、重放拒绝。
- 拒绝请求不入队。

### M1-04 Permission deny 修复

- Workflow preapproved 仅接受 allow。
- 无规则默认 ask。
- Role/Skill/Gateway 共用 Permission。

验收：TOL-008~012。

### M1-05 Workspace 路径安全

- realpath + relative。
- Symlink 防逃逸。
- Workspace 外写 deny。
- Shell cwd 固定。

验收：TOL-013~019。

### M1-06 Gateway 资源边界

- 有界 Queue。
- Body/Output 限制。
- Timeout/Abort/Kill。
- Session Key 扩维。
- 按 sourceAdapter 回包。

验收：GW-014~026。

### 退出条件

- P0 安全缺陷为 0。
- Gateway 不会在默认配置下提供远程执行面。
- Security Test CI 通过。

---

## 5. Milestone 2：DeepSeek 核心能力闭环

> 版本目标：v0.1.0-alpha.2

### M2-01 Provider Contract Test

建立本地 Mock Server/Fixture：

- 捕获 Request Body。
- 返回 Text/Reasoning/Tool SSE。
- 返回 Usage/Cache。
- 模拟 4xx/Overflow/Abort。

验收：PRO-001~025。

### M2-02 reasoning effort 修复

- 内部统一 `reasoningEffort`。
- Protocol 层转换 `reasoning_effort`。
- Capability 决定允许值。
- max 不支持时明确降级/拒绝。

验收：PRO-003~007、HAR-011。

### M2-03 Model Routing 前置

重构顺序：

```text
Turn Context
→ Harness Decision
→ Concrete Model Resolve
→ Request
```

记录：

- model.decided
- model.applied
- fallback reason

验收：HAR-005~010、HAR-029~030。

### M2-04 Reasoning Lifecycle 接入投影

- History Projector 接收 ContextPolicy。
- Tool Turn 协议连续性优先。
- N+1/N+2 只在 Provider 允许时摘要/剥离。
- 跨模型清理 Metadata。

验收：HAR-018~021、PRO-013、PRO-025。

### M2-05 Hard Constraint 闭环

- 提取。
- 用户查看/删除。
- 来源追踪。
- 压缩后保留。
- 违反约束影响完成状态。

验收：HAR-012~015、HAR-023。

### M2-06 Harness 模块降级策略

重新分类：

- Stable Candidate：Model Routing、Hard Constraints。
- Beta Candidate：Reasoning Lifecycle、Context/Cache。
- Experimental：Immune、AntiDrift、Skill Evolution、Meta-directives。

不满足主链路+测试的模块不进入 README 核心卖点。

### 退出条件

- 真实模型请求字段正确。
- Model Routing Applied Rate=100%。
- 至少 2 项 Harness 能力 E2E 通过。
- README 核心主张有 Contract/E2E 证据。

---

## 6. Milestone 3：单一 Runtime 与工具控制

### M3-01 SessionRunner 瘦身

把 DeepCode Hook 拆为：

- TurnPolicyService。
- HistoryProjector。
- ToolPolicyService。
- ReviewService。

SessionRunner 只编排。

### M3-02 统一 Tool Executor

整合：

- Tool Lookup。
- Schema Validation。
- Role Tools。
- Permission。
- Scope。
- Sandbox。
- Settlement。

删除各入口自己的权限特例。

### M3-03 Scope 初始化

- Plan 输出 expected files。
- 用户确认 Scope。
- 无 Plan 任务使用 workspace policy。
- Bash 通过 Sandbox，而非 filePath 猜测。

### M3-04 oh-my-deepagent 定位收敛

选择：

A. 作为 Experimental Harness Sandbox 保留；或
B. 只迁移 Roles/Skills 到 OpenCode，然后移除独立 Runtime 发布。

首发建议 A，但不作为主产品入口。

### 退出条件

- 所有 Tool 入口共用安全链。
- Role.tools/skills 实际生效。
- OpenCode Runtime 是唯一生产 Session 真相源。

---

## 7. Milestone 4：测试与 CI

### M4-01 统一根命令

实现：

```bash
bun run check
```

根 `test` 不再主动失败。

### M4-02 CI Jobs

- static
- core-test
- provider-contract
- gateway-security
- build-install

### M4-03 Required Checks

保护 `develop`、`master`：

- PR 必须通过。
- 禁止直接 Push master。
- P0 测试不得跳过。

### M4-04 Test Artifacts

每次 CI 保存：

- JUnit。
- Coverage。
- Contract Request/Response（脱敏）。
- Install Log。
- Build Artifact。

### M4-05 性能基线

只测关键风险：

- CLI 启动。
- 100 Turn Session。
- 大文件保护。
- Gateway Queue/Timeout。

### 退出条件

- 最新 develop Commit 有完整绿色 CI。
- 所有 P0 用例自动化。
- Test Report 可从 Artifact 自动生成。

---

## 8. Milestone 5：安装、文档和贡献体验

> 版本目标：v0.1.0-beta.1

### M5-01 发布方式

只选择一种主要方式：

- npm/bun Package，或
- Release Binary。

优先选择维护成本最低且上游已成熟的路径。

### M5-02 Package 修复

- private 配置与发布策略一致。
- repository 指向 DeepCode。
- bin 正确。
- 发布包排除内部资料/Secret/大型无关文件。

### M5-03 安装 Smoke Matrix

- Ubuntu x64。
- macOS arm64。
- 可选 Windows。

### M5-04 README 重写

结构：

1. DeepCode 是什么。
2. 当前成熟度。
3. 3 分钟开始。
4. 已验证的 DeepSeek 差异化。
5. 安全说明。
6. 架构和贡献。
7. Experimental 功能。

### M5-05 开源文件

- CONTRIBUTING.md。
- SECURITY.md。
- CODE_OF_CONDUCT.md。
- CHANGELOG.md。
- SUPPORT.md。
- UPSTREAM.md。

### M5-06 示例仓库与 Demo

提供一个最小、可重复 Demo：

- 读取 Bug。
- 修改。
- 运行测试。
- 输出证据。

不使用不可复现的截图替代。

### 退出条件

- 独立用户按 README 安装成功。
- 全新贡献者可运行 check。
- 所有公开链接和示例有效。

---

## 9. Milestone 6：Release Candidate

> 版本目标：v0.1.0-rc.1

### 必做

- 全量 P0/P1 回归。
- 真实 DeepSeek E2E。
- 安装 Matrix。
- Secret/Dependency/License Scan。
- 24 小时长运行稳定性。
- README Claim 审计。
- Release Notes。

### Go/No-Go

Go：

- P0=0。
- P1 无阻断。
- CI 全绿。
- 安装通过。
- Claim Coverage=100%。
- 至少 3 位外部试用者完成真实任务。

否则 No-Go。

---

## 10. v0.1 后再评估的功能

只有 v0.1 稳定后才讨论：

1. 第二个 Gateway 平台。
2. 更多正式角色。
3. 自动 Skill Evolution。
4. 多 Agent 协作。
5. Desktop 专属 DeepCode UX。
6. 云端服务。

评估条件：

- 有明确用户请求。
- 有维护 Owner。
- 不破坏核心质量门。
- 有端到端测试。

## 11. 推荐人员分工

| 方向 | 核心责任 |
|---|---|
| Runtime/Protocol | Provider Contract、Session、Reasoning |
| Harness | Router、Constraint、History Projector |
| Security/Tool | Permission、Scope、Sandbox、Gateway Auth |
| Release Engineering | CI、Package、Install、Security Scan |
| Product/Docs | PRD、README、Claim Matrix、用户试用 |

小团队可以一人多岗，但每项必须有明确 Owner。

## 12. 执行顺序

严格顺序：

```text
M0 范围冻结
→ M1 安全
→ M2 核心卖点
→ M3 单一主链路
→ M4 测试门禁
→ M5 开源体验
→ M6 RC
```

禁止为了“看起来有进展”跳过安全和 Contract Test，继续新增角色、平台或模块。