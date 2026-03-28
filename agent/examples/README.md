# Claw Wallet 使用示例

## 📦 两种使用方式

### 方式 1: 直接 SDK (推荐用于自己的项目)

**安装:**
```bash
npm install claw-wallet
```

**使用:**
```typescript
import { ClawWallet } from 'claw-wallet';

const wallet = new ClawWallet({
  relayUrl: 'http://localhost:8080',
  dataDir: '~/.claw-wallet',
  defaultChain: 'base',
  // 可选: 自定义 RPC 端点
  chains: {
    ethereum: { rpcUrl: 'https://ethereum.publicnode.com' },
    base: { rpcUrl: 'https://mainnet.base.org' }
  }
});

await wallet.initialize();
const tools = wallet.getTools();

// 直接调用任何工具
const pairTool = tools.find(t => t.name === 'wallet_pair');
await pairTool.execute({ shortCode: 'ABC12345' });
```

**运行示例:**
```bash
cd agent/examples
npm install
node direct-sdk-usage.ts
```

**优点:**
- ✅ 无需 MCP Server
- ✅ 直接集成到你的代码
- ✅ 完全控制工具调用
- ✅ 适合 Node.js 应用、脚本、自动化

### 方式 2: MCP Server (推荐用于 Cursor/Claude Desktop)

**安装:**
```bash
npx -y @claw-wallet/mcp-server
```

**配置 `~/.openclaw/openclaw.json`:**
```json
{
  "mcpServers": {
    "claw-wallet": {
      "command": "npx",
      "args": ["-y", "@claw-wallet/mcp-server"],
      "transport": "stdio",
      "env": {
        "RELAY_URL": "http://localhost:8080"
      }
    }
  }
}
```

**使用:**
在 Cursor AI 中直接用自然语言:
- "配对钱包,配对码是 ABC12345"
- "查看我的 ETH 余额"
- "发送 0.1 ETH 给 Bob"

**优点:**
- ✅ 标准化 MCP 协议
- ✅ 无需写代码
- ✅ 自然语言交互
- ✅ 适合 AI 助手环境

## 🎯 选择建议

| 场景 | 推荐方式 |
|------|---------|
| 集成到你的 Node.js 项目 | **直接 SDK** |
| 编写自动化脚本 | **直接 SDK** |
| 在 Cursor/Claude Desktop 使用 | **MCP Server** |
| 想要自然语言交互 | **MCP Server** |
| 需要完全控制工具调用 | **直接 SDK** |

## 📚 API 文档

### ClawWallet 类

```typescript
class ClawWallet {
  constructor(options: {
    relayUrl?: string;           // Relay Server URL (默认: http://localhost:8080)
    dataDir?: string;            // 数据目录 (默认: ~/.openclaw/wallet)
    defaultChain?: 'base' | 'ethereum';  // 默认链 (默认: base)
    chains?: {                   // 可选: 自定义 RPC 端点
      ethereum?: { rpcUrl: string };
      base?: { rpcUrl: string };
    };
    pollIntervalMs?: number;     // 余额轮询间隔 (默认: 30000)
    onBalanceChange?: (event) => void;   // 余额变化回调
  });

  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;
  getTools(): ToolDefinition[];
}
```

### ToolDefinition 接口

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
```

## 🔧 完整示例

见 `direct-sdk-usage.ts` 文件。

## 🆘 常见问题

### 1. 直接 SDK 和 MCP Server 有什么区别?

**直接 SDK:**
- 你在代码中直接调用工具
- 需要手动处理参数和结果
- 适合编程集成

**MCP Server:**
- AI 助手通过 MCP 协议调用工具
- 自然语言交互
- 适合对话式使用

### 2. 可以同时使用两种方式吗?

可以!它们使用同一个数据目录,配对信息是共享的。

### 3. 如何从 MCP Server 迁移到直接 SDK?

只需要:
1. `npm install claw-wallet`
2. 导入 `ClawWallet`
3. 使用相同的配置 (relayUrl, dataDir)
4. 已有的配对信息会自动读取

### 4. 哪个性能更好?

直接 SDK 更快,因为:
- 没有 MCP 协议开销
- 没有进程间通信
- 直接内存调用

## 🌐 Web3 网络配置

### 生产环境配置

在 `config.json` 中配置生产 RPC 端点:

```json
{
  "relayUrl": "https://relay.your-domain.com",
  "defaultChain": "base",
  "chains": {
    "ethereum": {
      "rpcUrl": "https://ethereum.publicnode.com"
    },
    "base": {
      "rpcUrl": "https://mainnet.base.org"
    }
  }
}
```

### 本地开发配置

使用 Hardhat 或 Anvil 本地节点:

```json
{
  "relayUrl": "http://localhost:8080",
  "defaultChain": "ethereum",
  "chains": {
    "ethereum": {
      "rpcUrl": "http://localhost:8545"
    },
    "base": {
      "rpcUrl": "http://localhost:8546"
    }
  }
}
```

**启动本地节点:**

```bash
# Ethereum 模拟 (链 ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Base 模拟 (链 ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

### 默认行为

如果不配置 `chains`,SDK 会使用 viem 的内置公共 RPC 端点。
