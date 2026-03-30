# openclaw-managed-a2a（中文说明）

Language: [English](./README.md) | 简体中文

[![Validate](https://github.com/amourjun/openclaw-managed-a2a/actions/workflows/validate.yml/badge.svg)](https://github.com/amourjun/openclaw-managed-a2a/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![OpenClaw Compatibility](https://img.shields.io/badge/OpenClaw-%3E%3D2026.3.13%20%3C2026.4.0-1f6feb)](./docs/compatibility.md)
[![Support Guide](https://img.shields.io/badge/support-SUPPORT.md-24292f)](./SUPPORT.md)

`openclaw-managed-a2a` 是一个面向 OpenClaw 的 Managed A2A 插件。  
它在原生 A2A / session / subagent 能力之上，提供可治理、可审计、可兼容演进的协作层。

## 当前状态

- 当前属于 foundation 阶段，核心 v1 能力已可用
- 已发布最新预发布版本：`0.1.0-alpha.4`
- 当前支持 OpenClaw 范围：`>=2026.3.13 <2026.4.0`

v1 已具备：

- 规范化的 `managed_a2a_delegate` 核心入口
- `runtime_subagent` 首选路径 + `cli_fallback` 降级路径
- channel adapter SPI（核心保持 IM 无关）
- Feishu 参考适配器
- Telegram 参考 wrapper 骨架
- 审计记录与结构化诊断
- 单测与 smoke 验证链路

## 为什么需要它

原生 A2A 能解决“能不能互发消息”，但很多团队还需要：

- 稳定的协作入口（而不是靠 prompt 约定）
- 策略约束（路由、发布边界、时限）
- 可追踪的审计事件与失败归因
- 兼容性探测与明确的降级行为

这个仓库的目标是把这些治理能力放进插件代码，而不是放进脆弱的提示词约定。

## 快速开始

### 1) 安装依赖

```bash
npm ci
```

### 2) 本地校验

```bash
npm run ci
```

这会执行 typecheck / test / pack dry-run / OpenSpec validate。

### 3) 加载插件

推荐本地安装方式：

```bash
openclaw plugins install -l /absolute/path/to/openclaw-managed-a2a
```

也可以参考示例配置：

- [examples/openclaw.managed-a2a.jsonc](./examples/openclaw.managed-a2a.jsonc)

注意：

- `managed-a2a` 工具按 `optional: true` 注册  
- 调用侧 agent 需要在 `tools.allow` 显式允许插件 id 或工具名

### 4) 验证协作链路

参考文档：

- [docs/smoke-test.md](./docs/smoke-test.md)
- [docs/shadow-profile.md](./docs/shadow-profile.md)

常用命令：

```bash
npm run smoke:shadow:setup
npm run smoke:shadow
npm run smoke:shadow:negative
```

## Channel Adapter SPI（通道适配层）

核心约束是“IM 无关”：

- 核心入口：`managed_a2a_delegate`
- 通道适配器负责：请求方/目标解析、来源上下文归一化
- 适配器把请求统一映射到同一个核心协作契约

当前参考实现：

- Feishu 适配器（完整参考路径）
- Telegram wrapper（最小骨架，验证 SPI 可扩展性）

## 发布与维护

发布相关文档：

- [docs/release-checklist.md](./docs/release-checklist.md)
- [docs/publish-npm.md](./docs/publish-npm.md)
- [docs/release-rehearsal.md](./docs/release-rehearsal.md)

当前建议：

- 默认走手工 npm 发布路径（账号 2FA/security key 场景已验证）
- `alpha` 指向最新预发布，`latest` 按维护策略手动提升

仓库维护基线已包含：

- CI 校验工作流
- issue 模板（含兼容性回归模板）
- label 同步
- Dependabot（npm + GitHub Actions）

## 进一步阅读

- 兼容性模型：[docs/compatibility.md](./docs/compatibility.md)
- 协议说明：[docs/protocol.md](./docs/protocol.md)
- 多轮方向说明：[docs/multi-turn.md](./docs/multi-turn.md)
- 支持与反馈：[SUPPORT.md](./SUPPORT.md)
