## Why

OpenClaw 是一个拥有 100K+ GitHub Stars 的开源 AI Agent 框架，但目前缺少一个官方级别的 Web3 钱包集成。现有社区插件（openclast-wallet 等）功能有限，没有安全护栏、联系人管理和策略引擎。

随着 AI Agent 经济在 2026 年爆发（McKinsey 预测 agentic commerce 到 2030 年将达 $3-5T），Agent 需要自主管理资金、发起链上交易、以及与其他 Agent 进行 P2P 支付。claw-wallet 将为 OpenClaw 生态提供一个安全、易用、本地自托管的 Web3 钱包。

## What Changes

- **新增 OpenClaw 钱包插件**：作为 OpenClaw Plugin/Skill 安装，提供完整的链上交易能力
- **钱包核心库**：基于 viem 的链交互、Keystore V3 加密密钥管理、交易构建与签名
- **策略引擎**：应用层限额控制（每笔限额、日累计限额、地址白名单），超限交易进入审批队列
- **联系人系统**：P2P 地址交换与本地存储，Agent 间通过直接询问获取对方地址
- **双模式支持**：用户通过聊天指挥 Agent 执行交易（指挥模式）+ Agent 自主执行链上操作（自主模式）
- **交易监控**：在 Agent 进程内通过定时轮询/WebSocket 订阅监控收款与余额变化
- **多链 EVM 支持**：默认 Base L2（低 Gas），同时支持 Ethereum mainnet

## Capabilities

### New Capabilities

- `wallet-core`: 钱包核心功能——创建/导入钱包、密钥加密存储（Keystore V3 + AES-256-GCM）、交易签名、余额查询、Gas 估算
- `token-transfer`: 代币转账——ETH 原生转账、ERC-20 代币转账（USDC/USDT 及任意 ERC-20）、交易状态追踪
- `policy-engine`: 安全策略引擎——每笔交易限额、日累计限额、地址白名单、操作类型限制、超限交易审批队列
- `contacts`: Agent 联系人系统——P2P 地址交换、联系人 CRUD、按名称解析地址、支持多链多地址
- `balance-monitor`: 余额监控与通知——定时轮询余额变化、收款检测、通过 OpenClaw 消息通道通知用户
- `openclaw-plugin`: OpenClaw 插件集成——Tool 注册与定义、Plugin 生命周期管理、配置管理

### Modified Capabilities

（无现有 capability 需要修改）

## Impact

- **新增依赖**：viem（链交互）、scrypt/crypto（密钥加密）
- **数据存储**：`~/.openclaw/wallet/` 目录下存储 keystore、联系人、交易历史、策略配置（均为 JSON 文件）
- **网络**：需要访问 EVM RPC 节点（公共节点或用户自配 Alchemy/Infura 等）
- **OpenClaw 集成点**：Plugin/Skill 注册接口、消息通道（通知用户）、Memory 系统（可选，联系人作为 Agent 记忆）
- **安全边界**：私钥通过 Keystore V3 加密存储，Agent 进程通过 Tool 接口访问钱包功能，LLM 永远不接触密钥
