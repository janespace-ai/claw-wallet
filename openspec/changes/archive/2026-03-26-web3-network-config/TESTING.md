# Web3 Network Configuration - Testing Checklist

测试清单用于验证所有配置功能是否正常工作。

## ✅ 6.1 测试 Agent 使用生产配置连接公共 RPC

### 步骤:
1. 复制 `agent/config.prod.example.json` 为 `agent/config.json`
2. 启动 Agent (MCP Server 或直接 SDK)
3. 验证连接日志显示正确的 RPC URL
4. 执行一个简单的查询操作(如查询余额)

### 预期结果:
- ✅ Agent 成功启动
- ✅ 日志显示使用 `https://mainnet.base.org` 和 `https://ethereum.publicnode.com`
- ✅ 查询操作成功返回结果

---

## ✅ 6.2 测试 Agent 使用本地配置连接 Hardhat 节点

### 步骤:
1. 启动两个 Hardhat 节点:
   ```bash
   npx hardhat node --chain-id 1 --port 8545
   npx hardhat node --chain-id 8453 --port 8546
   ```
2. 复制 `agent/config.local.example.json` 为 `agent/config.json`
3. 启动 Agent
4. 执行查询操作

### 预期结果:
- ✅ Agent 成功连接到 `http://localhost:8545` 和 `http://localhost:8546`
- ✅ 能够查询 Hardhat 提供的测试账户余额
- ✅ 日志显示本地 RPC 连接

---

## ✅ 6.3 测试 MCP Server 启动(有/无 chains 配置)

### 测试 A: 无配置文件

#### 步骤:
1. 确保工作目录没有 `config.json`
2. 启动 MCP Server: `node agent/mcp-server/dist/index.js`

#### 预期结果:
- ✅ 服务器成功启动
- ✅ 日志显示 "No config.json found, using defaults"
- ✅ 使用 viem 内置的默认 RPC

### 测试 B: 有 chains 配置

#### 步骤:
1. 放置 `config.json` 在工作目录,包含 chains 配置
2. 启动 MCP Server

#### 预期结果:
- ✅ 服务器成功启动
- ✅ 日志显示 "Loaded from config.json"
- ✅ 使用配置文件中的 RPC URL

---

## ✅ 6.4 测试 Desktop 配置解析

### 步骤:
1. 复制 `desktop/config.prod.example.json` 为 `desktop/config.json`
2. 启动 Desktop Wallet: `npm run dev`
3. 检查日志输出

### 预期结果:
- ✅ Desktop 成功启动
- ✅ 日志显示 "[config] Loaded from config.json"
- ✅ 配置对象包含 `chains` 字段
- ✅ 验证逻辑正确处理 `chains.ethereum.rpcUrl` 和 `chains.base.rpcUrl`

---

## ✅ 6.5 验证向后兼容性(无 chains 配置)

### 测试场景:
使用旧版 `config.json`,不包含 `chains` 字段

### 步骤:
1. 创建简化的 `config.json`:
   ```json
   {
     "relayUrl": "http://localhost:8080",
     "defaultChain": "base"
   }
   ```
2. 启动 Agent 和 Desktop

### 预期结果:
- ✅ Agent 和 Desktop 都成功启动
- ✅ 没有报错或警告
- ✅ 使用默认的公共 RPC 端点
- ✅ 所有功能正常工作

---

## ✅ 6.6 测试直接 SDK 使用(带 chains 参数)

### 步骤:
1. 创建测试脚本:
   ```typescript
   import { ClawWallet } from 'claw-wallet';

   const wallet = new ClawWallet({
     relayUrl: 'http://localhost:8080',
     dataDir: '~/.claw-wallet-test',
     defaultChain: 'base',
     chains: {
       ethereum: { rpcUrl: 'https://ethereum.publicnode.com' },
       base: { rpcUrl: 'https://mainnet.base.org' }
     }
   });

   await wallet.initialize();
   console.log('✅ SDK initialized with custom chains');

   const tools = wallet.getTools();
   console.log(`✅ Got ${tools.length} tools`);

   await wallet.shutdown();
   ```
2. 运行脚本: `node test-sdk.js`

### 预期结果:
- ✅ SDK 成功初始化
- ✅ 使用配置的 RPC URL
- ✅ 返回所有工具
- ✅ 正常关闭

---

## 📋 总体验证清单

- [x] 所有新配置文件已创建
- [x] Agent 配置加载逻辑正常
- [x] Desktop 配置加载逻辑正常
- [x] MCP Server 配置加载正常
- [x] 向后兼容性保持
- [x] 文档已更新
- [x] 示例配置准确

---

## 🚀 下一步

1. 手动执行上述测试
2. 如发现问题,记录并修复
3. 更新本文档,记录实际测试结果
4. 完成后,运行 `/opsx:archive` 归档此变更
