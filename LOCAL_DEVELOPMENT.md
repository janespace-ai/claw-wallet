# 本地开发指南 / Local Development Guide

## 🎯 概述 / Overview

本指南介绍如何使用本地区块链节点 (Hardhat/Anvil) 进行 Claw Wallet 开发和测试。

This guide explains how to set up Claw Wallet with local blockchain nodes (Hardhat/Anvil) for development and testing.

## 🔧 前置要求 / Prerequisites

- Node.js 22+
- Hardhat 或 Anvil (来自 Foundry)
- Claw Wallet Agent & Desktop

## 🚀 快速开始 / Quick Start

### 1. 启动本地区块链节点 / Start Local Blockchain Nodes

#### 使用 Hardhat

```bash
# 安装 Hardhat (如果尚未安装)
npm install --save-dev hardhat

# 启动 Ethereum 模拟节点 (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# 在另一个终端启动 Base 模拟节点 (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

#### 使用 Anvil (Foundry)

```bash
# 安装 Foundry (如果尚未安装)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 启动 Ethereum 模拟节点
anvil --chain-id 1 --port 8545

# 在另一个终端启动 Base 模拟节点
anvil --chain-id 8453 --port 8546
```

### 2. 配置 Agent

创建 `agent/config.json`:

```json
{
  "relayUrl": "http://localhost:8080",
  "dataDir": "~/.claw-wallet",
  "defaultChain": "ethereum",
  "chains": {
    "ethereum": {
      "rpcUrl": "http://localhost:8545"
    },
    "base": {
      "rpcUrl": "http://localhost:8546"
    }
  },
  "pairTimeoutMs": 10000,
  "relayTimeoutMs": 30000,
  "signTimeoutMs": 120000,
  "policy": {
    "perTxLimitUsd": 1000,
    "dailyLimitUsd": 10000,
    "mode": "supervised"
  }
}
```

### 3. 配置 Desktop

创建 `desktop/config.json`:

```json
{
  "relayUrl": "ws://localhost:8080",
  "ipChangePolicy": "allow",
  "lockMode": "convenience",
  "chains": {
    "ethereum": {
      "rpcUrl": "http://localhost:8545"
    },
    "base": {
      "rpcUrl": "http://localhost:8546"
    }
  },
  "relay": {
    "reconnectBaseMs": 500,
    "reconnectMaxMs": 5000
  },
  "signing": {
    "dailyLimitUsd": 10000,
    "perTxLimitUsd": 1000,
    "tokenWhitelist": ["ETH", "USDC", "USDT", "DAI"],
    "autoApproveWithinBudget": true
  }
}
```

### 4. 启动 Relay Server

```bash
cd server
docker compose up -d
```

验证运行状态:
```bash
curl http://localhost:8080/health
```

### 5. 启动 Desktop Wallet

```bash
cd desktop
npm install
npm run dev
```

### 6. 启动 Agent (MCP Server 或直接 SDK)

#### MCP Server 方式

```bash
cd agent/mcp-server
npm install
npm run build
node dist/index.js
```

#### 直接 SDK 方式

```typescript
import { ClawWallet } from 'claw-wallet';

const wallet = new ClawWallet({
  relayUrl: 'http://localhost:8080',
  dataDir: '~/.claw-wallet',
  defaultChain: 'ethereum',
  chains: {
    ethereum: { rpcUrl: 'http://localhost:8545' },
    base: { rpcUrl: 'http://localhost:8546' }
  }
});

await wallet.initialize();
```

## 🧪 测试交易 / Testing Transactions

### 获取测试账户 / Get Test Accounts

Hardhat/Anvil 会自动创建 20 个测试账户,每个账户有 10,000 ETH。

```bash
# Hardhat 会在启动时显示账户列表
# Anvil 同样会显示
```

### 发送测试交易 / Send Test Transactions

```typescript
// 使用 Agent 工具发送测试交易
await wallet.getTools().find(t => t.name === 'wallet_send').execute({
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat 账户 #1
  amount: '0.1',
  token: 'ETH'
});
```

## 🔍 调试 / Debugging

### 查看节点日志

Hardhat/Anvil 会实时显示每个交易和区块的详细信息。

### 重置区块链状态

```bash
# 停止节点 (Ctrl+C)
# 重新启动即可获得全新状态
```

### 使用 Hardhat Console

```bash
npx hardhat console --network localhost
```

```javascript
// 查询余额
const balance = await ethers.provider.getBalance('0xYourAddress');
console.log(ethers.utils.formatEther(balance));

// 发送交易
const [signer] = await ethers.getSigners();
await signer.sendTransaction({
  to: '0xRecipient',
  value: ethers.utils.parseEther('1.0')
});
```

## 📝 注意事项 / Notes

### Chain IDs

- **重要**: 确保使用正确的 Chain ID
  - Ethereum Mainnet: `1`
  - Base Mainnet: `8453`
- 本地节点必须使用与主网相同的 Chain ID 才能正确模拟

### 端口配置

- 8545: Ethereum 本地节点
- 8546: Base 本地节点
- 8080: Relay Server

确保这些端口未被占用。

### 数据持久化

- Hardhat/Anvil 默认不持久化数据
- 重启节点会清空所有交易历史和状态
- 如需持久化,可以使用 Anvil 的 `--state` 选项

### 性能优化

本地配置建议:
- `reconnectBaseMs`: 500 (更快重连)
- `dailyLimitUsd`: 10000 (更高限额用于测试)
- `autoApproveWithinBudget`: true (自动批准测试交易)

## 🆘 常见问题 / FAQ

### 连接失败: "Could not connect to RPC"

1. 确认本地节点正在运行
2. 验证端口配置正确
3. 检查 `config.json` 中的 `rpcUrl`

### Chain ID 不匹配

确保 Hardhat/Anvil 启动时指定了正确的 `--chain-id` 参数。

### 交易一直 Pending

本地节点默认自动挖矿。如果禁用了自动挖矿:

```bash
# Hardhat
npx hardhat node --no-mining

# 手动挖矿
await network.provider.send("evm_mine");
```

### 余额不足

使用 Hardhat/Anvil 提供的测试账户,每个都有 10,000 ETH。

## 🔗 相关资源 / Resources

- [Hardhat 文档](https://hardhat.org/docs)
- [Foundry Book (Anvil)](https://book.getfoundry.sh/anvil/)
- [Claw Wallet 文档](../README.md)
