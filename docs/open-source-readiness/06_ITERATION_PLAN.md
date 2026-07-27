# DeepCode 三阶段路线摘要（Roadmap Summary）

> 创建日期：2026-07-27
> 版本：4.0
> 状态：摘要有效；任务级执行以 [PLAN.md](./PLAN.md) 为唯一权威
> 目的：让管理者快速理解顺序，不替代任务卡、测试和证据要求

## 更新记录（Update Log）

| 时间       | 更新内容                                                                | 来源         |
| ---------- | ----------------------------------------------------------------------- | ------------ |
| 2026-07-27 | 按用户澄清重构为“官网可安装 → 完整能力 → 设计驱动 WebUI/Electron”三阶段 | 用户目标澄清 |
| 2026-07-27 | 安装、发行身份、共存和 CI 前移；Gateway/全量 Agent 不阻塞第一阶段       | 开源准备复核 |

## 1. 路线结论

```text
第一阶段：官网立即可安装和使用
→ 第二阶段：把核心能力按证据完整实现
→ 第三阶段：先完成设计，再改 WebUI 并发布 Electron
```

这里的阶段是用户结果，不等同于单一版本号。详细任务 ID、依赖、文件范围、验证命令、证据格式和 Go/No-Go 见 [PLAN.md](./PLAN.md)。

## 2. 第一阶段：官网立即可安装和使用

### 用户结果

- 从 `https://deepcode.starseas.org` 下载本项目控制的制品；
- 安装 `deepcode`，配置 DeepSeek，完成首个真实编码任务；
- 可以升级、回滚、卸载；
- 与 OpenCode、Oh-my-OpenAgent 同时存在且互不读写状态。

### 必做顺序

1. `S1-01` 核实官网源码、Release 仓库、默认分支并停止错误 npm 引导；
2. `S1-02` 用户边界和共存隔离；
3. `S1-03` 构建、安装、升级和卸载；
4. `S1-04` Provider/Permission 最小运行链 P0；
5. `S1-05` 开源治理与来源审计；
6. `S1-06` 可重建 CI/Release；
7. `S1-07` 官网安装器和首任务文档；
8. `S1-08` Parallels macOS 共存矩阵与公开 Alpha。

### Gate 1

官网命令必须在干净快照完成安装和真实任务；OpenCode/Oh-my-OpenAgent 状态不变；Required CI、checksum、SBOM、许可证和主张证据齐全。

## 3. 第二阶段：把核心产品能力完整实现

### 用户结果

- Provider、Routing、Reasoning、Harness 和 Evidence 真实生效；
- oh-my-deepagent 作为内置插件进入生产链；
- 角色、技能、规划、评审、委派、Subagent 和 Multi-Agent 可验证；
- Gateway Core 安全稳定，飞书达到 Stable；
- 其他 Adapter 按真实证据标记 Experimental/Beta/Stable。

### 必做顺序

1. `S2-01` 真实调用图、来源图、状态和安全契约；
2. `S2-02` Provider/Harness；
3. `S2-03` Host↔Plugin 安全桥；
4. `S2-04` 角色/技能/规划/评审；
5. `S2-05` Delegation/Subagent/Multi-Agent；
6. `S2-06` Gateway Core；
7. `S2-07` 飞书 Stable 与其他 Adapter 分级；
8. `S2-08` 可靠性、可观察性、性能和发布。

### Gate 2

目标能力进入生产调用链，P0/P1 安全问题为 0，失败/取消/恢复/过载有证据，官网主张与成熟度一致。

## 4. 第三阶段：设计驱动的 WebUI 与 Electron

### 用户结果

- 新界面由研究和任务验证产生，不是直接换皮；
- 产品 WebUI 在 `packages/app`，共享设计系统在 `packages/ui`；
- Electron 复用同一个 `AppInterface`，不复制 UI；
- DeepCode Desktop 与 OpenCode Desktop 可以同时安装、运行、升级和卸载。

### 设计门禁

1. `S3-01` UX 基线、用户研究、设计简报和组件清单；
2. `S3-02` 信息架构、用户流程、多个方向、线框和可测试原型；
3. `S3-03` 高保真方案、根 `DESIGN.md`、组件/动效/可访问性规格及用户批准。

`S3-03` 通过前禁止大规模修改 UI。当前已有 Legacy/New 两套 Layout，无设计决策继续编码会制造第三套界面。

### 实现与发行

1. `S3-04` 共享 Token、主题、组件与 Storybook；
2. `S3-05` 核心 WebUI 垂直切片；
3. `S3-06` 可访问性、响应式、性能和可用性回归；
4. `S3-07` Electron DeepCode 身份、共享 WebUI、sidecar 和更新边界；
5. `S3-08` 打包、签名、公证、更新、回滚和桌面共存验收。

### Gate 3

设计验收、WebUI 自动化与用户测试、macOS 签名公证、Desktop 更新回滚、DeepCode/OpenCode Desktop 共存全部通过。

## 5. 三个强制边界

1. 第一阶段可以少功能，但不能跳过可信来源、权限、隔离和卸载安全。
2. 第二阶段的“完整”以 [PLAN.md](./PLAN.md) 的能力树为边界，不以仓库代码数量为边界。
3. `packages/web` 是官网候选，`packages/app`/`packages/ui` 是产品 WebUI，`packages/desktop` 是 Electron 外壳；三者不得混为一套代码。

## 6. 当前外部阻塞项

- 官网真实源码和部署入口待 `S1-01` 证实；
- GitHub 唯一默认分支和 Release owner/repo 待管理员确认；
- npm scope 不阻塞第一阶段；
- Desktop App ID/签名主体在第三阶段前确认；
- UI 视觉方向必须由原型测试和用户批准产生。

## 附录：历史版本映射

| 旧路线               | 新路线                                  |
| -------------------- | --------------------------------------- |
| v0.1 CLI-first Alpha | 第一阶段                                |
| v0.2 Built-in Agent  | 第二阶段前半                            |
| v0.3 Gateway/飞书    | 第二阶段后半                            |
| Desktop              | 第三阶段；新增强制设计门禁和 WebUI 改造 |
