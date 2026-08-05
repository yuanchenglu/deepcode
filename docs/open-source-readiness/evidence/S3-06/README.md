# S3-06 可访问性、响应式、性能与可用性回归

> 日期：2026-08-05
> 基线：develop `8587d05`（S3-05 DONE 后）
> 状态：DONE（自动验证部分；人工走查/5 用户复测按 PLAN 标注待执行）

## 1. PLAN 步骤对照

| 步骤 | 状态 | 证据 |
|---|---|---|
| 1. WCAG 2.2 AA 自动验证 | ✅(自动) | **新增 axe-core 扫描**（e2e/a11y/axe-scan.spec.ts，2 用例）覆盖 home/new-session 核心页面；人工项（读屏/缩放 200%）标注待执行 |
| 2. 冻结 viewport 矩阵核心任务 | ⏳ 人工 | 需真实用户在 1024×700/1440×900/1728×1117 执行（PLAN 要求冻结最小尺寸） |
| 3. S3-01 基线性能对比（>10% 退化需批准） | ⏳ | 需真实试用负载；S2-08 已记录无外部 Provider 真实负载 |
| 4. ≥5 用户复测 | ⏳ | 同 S3-02 原型测试（0 用户方向性研究，不编造数据） |
| 5. 视觉回归审阅 | ⏳ | 需高保真原型基线（S3-03 待用户批准） |

## 2. 自动验证结果（本轮）

**新增设施**：axe-core 4.10.3（app devDependencies）+ `e2e/a11y/axe-scan.spec.ts`

**真实 a11y 发现与修复**：
- **WCAG 4.1.2（Name/Role/Value）**：home/new-session 搜索 input 使用 `aria-expanded`/`aria-controls`/`aria-activedescendant`/`aria-autocomplete`（combobox 模式属性）但**缺 `role="combobox"`** → axe 报 `aria-allowed-attr` critical
- **修复**：home.tsx 搜索 input 加 `role="combobox"`（结果容器已有 role="listbox"，两者配对为完整 combobox 模式）
- 修复后 axe 扫描 **2/2 通过**（home + new-session 无 critical/serious 违规）

**回归确认**：app unit 537 pass + e2e 10 pass（smoke 5 + review 5）+ typecheck ✅

## 3. 验证记录

- 浏览器：chromium headless（playwright-core 1.59.1 rev 1217）
- viewport：playwright 默认 1280×720
- axe 规则集：color-contrast、aria-allowed-attr、button-name、landmark-one-main

## 4. 技术债务

- 人工 a11y 走查（键盘顺序/焦点/读屏/缩放 200%/reduced motion）待真实用户
- viewport 矩阵冻结、性能基线对比、5 用户复测：均依赖真实试用（与 S3-02 原型测试同一批用户）
- 视觉回归基线待高保真原型批准（S3-03 DESIGN_ACCEPTANCE 未决项）
