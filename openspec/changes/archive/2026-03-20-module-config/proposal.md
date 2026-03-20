## Why

三个模块（Agent / Desktop / Server）中大量运行参数以魔法数字硬编码在源码里——Server 的限流阈值、超时、CORS；Desktop 的签名预算、锁屏时间、加密参数；Agent 的轮询间隔、重连策略等。要调整任何一个值都必须改代码重新编译。Desktop 刚加了 `config.json` 机制，但只覆盖了 3 个字段；Server 仅端口可通过环境变量配置；Agent 完全没有文件/环境变量级别的配置能力。需要统一为每个模块提供配置文件支持，把运维可调参数外部化。

## What Changes

- **Server（Go）**：引入 `config.json` 配置文件（或环境变量），覆盖端口、CORS 白名单、WebSocket 参数（读取限制、超时、ping 间隔）、限流参数（消息速率、连接速率、IP 限制）、配对码参数（长度、TTL、IP 限流）、优雅关闭超时
- **Desktop（Electron）**：扩展现有 `config.ts`，新增可配签名引擎预算（每笔/每日限额、白名单 token）、锁屏策略（strict 模式空闲超时）、安全监控（最大事件数）、重连参数（基础延迟、最大延迟）
- **Agent（TypeScript 库）**：新增 `config.ts` 模块，支持从 `config.json` + 环境变量加载配置，覆盖签名超时、重连参数、默认策略限额

## Capabilities

### New Capabilities

（无新 capability——配置化是内部实现改进，不改变系统对外行为或功能需求）

### Modified Capabilities

（无——所有现有 spec 的需求不变，只是参数值从硬编码变为可配置）

## Impact

- **Server 代码**：`cmd/relay/main.go`、`internal/hub/hub.go`、`internal/pairing/pairing.go`、`internal/middleware/cors.go` 需要读取配置结构体
- **Desktop 代码**：`src/main/config.ts` 扩展接口；`relay-bridge.ts`、`signing-engine.ts`、`lock-manager.ts`、`security-monitor.ts` 从 config 读取参数
- **Agent 代码**：新增 `config.ts`；`signer/relay-client.ts`、`e2ee/transport.ts`、`policy.ts` 从 config 读取参数
- **配置文件**：每个模块新增或更新 `config.json` + `config.example.json`
- **依赖**：无新增外部依赖
