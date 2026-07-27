# S1-02-A 共存契约失败基线

> 日期：2026-07-27
> 环境：Linux x64；Bun 1.3.14；隔离 XDG 目录位于 `/tmp/deepcode-test-xdg`

## Core 基线

命令：

```bash
cd packages/core
bun test test/global.test.ts
```

修复前结果：

- 1 pass；
- 4 fail；
- `Global.Path.tmp` 实际为 `/tmp/opencode`；
- data/config/cache/state 实际 basename 为 `opencode`；
- 同时设置两个 HOME 覆盖时实际读取 `OPENCODE_TEST_HOME`；
- 测试 preload 把数据库固定为 `:memory:`，进一步证明旧测试入口仍使用 OpenCode 环境名。

## 配置共存基线

命令：

```bash
cd packages/opencode
bun test test/config/config.test.ts --test-name-pattern 'OpenCode-only|both products'
```

修复前结果：

- 0 pass；
- 2 fail；
- 仅存在 `opencode.json` 时，DeepCode 实际加载 `username=opencode-only`；
- `opencode.json` 与 `deepcode.json` 并存时，实际选择 `username=opencode-user`，忽略 DeepCode 配置。

## 结论

失败与 S1-02 假设一致，未发现相反证据。配置用例将在 S1-02-C 取消 `skip` 后作为完成门禁。
