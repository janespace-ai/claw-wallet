## Why

当前架构中，Agent 通过 Tool 参数传递密码和私钥（`wallet_create({password})`, `wallet_import({private_key, password})`），导致 Agent 在上下文中持有这些敏感材料。攻击者可通过 prompt injection 诱导 Agent 输出密码或私钥，从根本上无法防御。需要从架构层面将密钥管理隔离到独立的 Signer 进程中，使 Agent 和 Tool 在任何情况下都无法接触密码和私钥。

## What Changes

- **新增独立 Signer 守护进程** (`claw-signer`)：通过 Unix Domain Socket IPC 提供签名服务，是系统中唯一持有 keystore 和解密能力的组件
- **Tool API 移除所有敏感参数**：`wallet_create`、`wallet_import`、`wallet_send` 等工具不再接受 `password` 和 `private_key` 参数
- **三级授权模型**：Level 0 预授权自动签名（小额免确认）、Level 1 快速生物识别/PIN 确认、Level 2 完整审批（大额/异常）
- **PasswordProvider 适配层**：支持桌面 GUI 对话框、CLI TUI prompt、服务器推送通知三种用户交互形态
- **预授权策略（Allowance）**：默认日限 500U 可配置，在 Signer 进程内管理，Agent 无法修改预授权配置
- **BREAKING**: `wallet_create`、`wallet_import` Tool 参数签名变更，移除 `password` 和 `private_key` 字段
- **BREAKING**: `ClawWallet` 构造不再接受 `password` 选项，改为连接 Signer 进程

## Capabilities

### New Capabilities
- `signer-daemon`: 独立 Signer 守护进程，通过 Unix Socket IPC 提供密钥管理和签名服务，支持 session 管理和预授权策略
- `signer-auth`: 三级授权模型（自动签名 / 快速确认 / 完整审批）和多形态用户交互（GUI / TUI / 推送通知）
- `signer-allowance`: 预授权策略管理，默认日限 500U 可配置，控制 Agent 自主操作的上限

### Modified Capabilities
- `wallet-core`: 签名和密钥操作从 Tool 进程移至 Signer 进程，Tool 通过 IPC 委托签名
- `openclaw-plugin`: Tool 定义移除 `password`/`private_key` 参数，创建/导入/签名操作改为 IPC 委托
- `token-transfer`: `TransferService` 不再持有 password，改为通过 Signer IPC 请求签名
- `policy-engine`: 预授权策略（Allowance）迁移到 Signer 进程内，Policy Engine 保留应用层限额但签名授权由 Signer 控制

## Impact

- **src/keystore.ts**: `signTransaction`/`signMessage`/`decryptKey` 不再由 Tool 进程直接调用，改为 Signer 内部使用
- **src/transfer.ts**: `TransferService` 构造函数去掉 `password` 参数，签名改为 IPC 调用
- **src/tools/wallet-create.ts, wallet-import.ts, wallet-send.ts**: 移除敏感参数，增加 IPC 客户端调用
- **src/index.ts**: `ClawWallet` 增加 Signer 连接管理，去掉 `password` 字段
- **新增**: `src/signer/` 目录 — daemon 进程、IPC 协议、session 管理、allowance 策略、用户交互适配器
- **新增依赖**: 可能需要 IPC 库（或直接使用 Node.js `net` 模块的 Unix Socket）
- **测试**: 现有 55 + 48 安全测试需要适配新的 IPC 签名流程，增加 Signer 隔离测试
