# Upstream Relationship

## 上游来源

DeepCode 基于 [OpenCode](https://github.com/anomalyco/opencode) (MIT License)
二次开发。

## 变更范围

DeepCode 在 OpenCode 基础上做了以下改造：

1. **产品身份隔离** - CLI/配置/数据库/环境变量全面切换为 DeepCode 命名空间
2. **DeepSeek V4 深度适配** - reasoning_effort、thinking 模式、DSML 格式
3. **14 个 Harness 控制模块** - 意图路由、模型路由、免疫审查等
4. **飞书/微信消息网关** - 纯 TypeScript 实现
5. **CLI 生命周期** - 独立安装器、Release 管理、升级回滚

## 保留的上游代码

以下代码保持上游原始实现，未做修改：

- `packages/tui/` - 终端 UI 组件（第三阶段计划重设计）
- `packages/app/` - 产品 WebUI（第三阶段计划重设计）
- `packages/ui/` - 共享 UI 系统（第三阶段计划重设计）
- `packages/desktop/` - Electron 外壳（第三阶段计划改造）
- `packages/client/` - SDK 客户端
- `packages/schema/` - 数据模型定义

## 许可证兼容性

DeepCode 和 OpenCode 均使用 MIT License，完全兼容。
