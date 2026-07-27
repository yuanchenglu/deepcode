# S1-02-C 配置发现与 CLI 身份验证

> 日期：2026-07-28
> 分支：`develop`
> 状态：实现完成，package/CI 验证待回传

## 实施范围

- 单一产品身份：`packages/core/src/product.ts`。
- Core：配置发现、Global Path、数据库名、用户环境变量。
- CLI：主配置发现、共享配置路径、help/version、进程环境标记。
- TUI：`.deepcode` 目录与 TUI 配置发现。
- MDM：DeepCode 系统目录、测试目录和 managed plist domain。
- 测试：隔离 preload 与独立共存用例。

## 静态契约检查

执行：

```bash
rg -n 'targets: \["\.opencode"|files\("opencode"|\["opencode\.json"|dir\.endsWith\("\.opencode"' <changed-files>
rg -n 'process\.env\.(OPENCODE|\["OPENCODE)|process\.env\["OPENCODE' <changed-files>
tsc --noEmit --noResolve --skipLibCheck --target ES2023 --module ESNext --moduleResolution bundler <changed-ts-files>
```

结果：

- 配置发现中未发现 `.opencode`、`opencode.json(c)`；
- 改动文件中未发现用户侧 `process.env.OPENCODE_*` 直接读写；
- TypeScript 解析未产生 TS1xxx 语法错误；无依赖 checkout 下仅出现模块/类型解析类诊断，不能替代 package typecheck。

## 必须回传的 package 验证

```bash
cd packages/core && bun typecheck
cd packages/opencode && bun typecheck
cd packages/opencode && bun test test/config/deepcode-coexistence.test.ts
cd packages/opencode && bun test test/config
```

在 GitHub connector 执行环境中没有 Bun 工作区和依赖，以上命令不得伪造为已通过；以远端 CI 或具备完整 checkout 的执行结果为准。

## 保留的 OpenCode 字符串分类

| 类型 | 示例 | 处理 |
| --- | --- | --- |
| 内部 package/service tag | `@opencode-ai/*`、`@opencode/Config` | 第一阶段允许保留，不参与用户磁盘边界 |
| 上游 schema/protocol | `https://opencode.ai/config.json`、`/.well-known/opencode` | 在 DeepCode 自有 endpoint/协议迁移前显式保留，S1-02-E 复核 |
| 内部 Flag 属性名 | `Flag.OPENCODE_CONFIG` 等 | 仅为内部 API；实际读取 `DEEPCODE_*`，避免第一阶段扩散式重命名 |
| 构建/制品名 | `bin/opencode` 等 | 明确留给 S1-03，不作为 S1-02-C 完成声明 |

## 结论

实现满足 S1-02-C 的静态身份与发现契约，但在 package typecheck、配置测试和 CI 回传前保持 `IN_REVIEW`。
