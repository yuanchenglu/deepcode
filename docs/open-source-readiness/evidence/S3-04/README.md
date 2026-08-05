# S3-04 共享 Token、主题和基础组件

> 日期：2026-08-05
> 基线：develop `61b5586`（S3-03 DONE 后）
> 状态：DONE（P1 修复 + Button 垂直切片；其余组件迁移经设计验收后扩展）

## 1. 真实缺口审计（基于 S3-01/S3-03 审计）

| 缺口 | 位置 | 确认 |
|---|---|---|
| `--color-primary` 悬空引用 | toast.css:202（progress-fill） | ✅ 包内无定义 |
| `icon-weak-base` 缺 `#` 前缀 | oc-2.json:28（light variant） | ✅ dark variant 有 # |
| 控件尺寸硬编码 magic number | button.css 24/28/32px、padding 6/8/12px | ✅ 无尺寸 token |

## 2. 交付内容

### 2.1 P1 Bug 修复

- **toast.css:202**：`var(--color-primary)` → `var(--button-primary-base)`（theme.css:195 有定义）
- **oc-2.json:28**：`"C7C7C7"` → `"#C7C7C7"`（补 `#` 前缀）
- 全量扫描 themes/*.json 无其他缺 `#` hex

### 2.2 控件尺寸 Token（DESIGN.md 映射）

`theme.css` 新增：
- `--control-height-small/normal/large`: 24/28/32px
- `--control-padding-x-small/normal/large`: 8/12/16px

### 2.3 Button 垂直切片（步骤 5）

`button.css` 三个尺寸变体（small/normal/large）迁移到控件 token：
- height、line-height、padding 全部 token 化
- 顺带清理 large 变体重复的 font-family 声明

## 3. 验证结果

```bash
cd packages/ui && bun typecheck       # ✅
cd packages/ui && bun run build       # ✅
cd packages/storybook && bun run build  # ✅ Storybook build completed successfully
```

## 4. PLAN 执行步骤对照

| 步骤 | 状态 | 说明 |
|---|---|---|
| 1. 从 DESIGN.md 映射 Token，不散落 magic | ✅ | 控件尺寸 token 化；DESIGN.md components 映射已冻结 |
| 2. Keep/Adapt/Replace 改组件 | ✅(切片) | Button 垂直切片完成；其余 86 组件按清单待扩展 |
| 3. Storybook 覆盖 | ✅(构建) | Storybook 构建通过（组件状态 stories 已有 46 个） |
| 4. 组件级键盘/ARIA/对比度/视觉回归测试 | ⏳ | 依赖垂直切片验收后随扩展补齐 |
| 5. 先迁移代表性垂直切片，验收后扩展 | ✅(切片) | Button 切片交付；**验收后**再扩展其余组件 |

## 5. 技术债务

- 其余 86 组件仍在 v1 token + 硬编码尺寸混合状态：按 PLAN 步骤 5 需先经设计验收（用户/设计侧确认 Button 切片），再批量扩展
- v1/v2 双 token 体系并存：收敛为 v2 是长期方向（DESIGN.md 已声明 v2 为唯一语义源），本次只修 P1 不重构
- 组件级 a11y 测试（axe）待扩展阶段加入
