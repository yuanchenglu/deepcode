# S1-02-B Core 隔离验证

> 日期：2026-07-27
> 环境：Linux x64；Bun 1.3.14；隔离 XDG 目录位于 `/tmp/deepcode-test-xdg`

## 定向测试

```bash
cd packages/core
bun test test/global.test.ts
```

结果：6 pass，0 fail，10 assertions。

覆盖：

- Global data/cache/config/state/tmp 为 DeepCode 命名空间；
- `DEEPCODE_TEST_HOME` 生效且 `OPENCODE_TEST_HOME` 不生效；
- `DEEPCODE_CONFIG_DIR` 优先且不读取 `OPENCODE_CONFIG_DIR`；
- 默认数据库文件名为 `deepcode.db` 或带 channel 的 DeepCode 文件名。

## Typecheck

```bash
cd packages/core
tsgo --noEmit
```

结果：通过，0 error。

## Core 全量回归

```bash
cd packages/core
bun test --only-failures
```

结果：1073 pass，2 fail，2948 assertions，140 files。

两个失败均为容器以 root 运行时 `chmod 0500` 仍可写造成的权限模拟限制：

- `test/util/effect-flock.test.ts`：`fails on unwritable lock roots`；
- `test/util/flock.test.ts`：`fails clearly on unwritable lock roots`。

本任务未修改 Flock 实现或这两个测试；失败与路径、数据库和环境变量改动无调用关系。其余 1073 项通过，数据库碰撞和 SessionRunner 连锁失败在把 test preload 切换到 `DEEPCODE_DB=:memory:` 后消失。

## 结论

S1-02-B 验收通过。置信度：确定。
