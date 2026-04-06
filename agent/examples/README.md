# Claw Wallet 使用示例

## 直接 SDK 集成

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
- ✅ 直接集成到你的代码
- ✅ 完全控制工具调用
- ✅ 适合 Node.js 应用、脚本、自动化

---

## API 文档

### ClawWallet 类

```typescript
class ClawWallet {
  constructor(options: {
    relayUrl?: string;           // Relay Server URL (默认: http://localhost:8080)
    dataDir?: string;            // 数据目录 (默认: ~/.openclaw/wallet)
    defaultChain?: string;       // 默认链 (默认: base)
    chains?: Record<string, { rpcUrl: string }>;  // 可选: 自定义 RPC 端点
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

---

## 完整示例

见 `direct-sdk-usage.ts` 文件。

---

## Web3 网络配置

### 生产环境配置

在 `config.json` 中配置生产 RPC 端点:

```json
{
  "relayUrl": "https://relay.your-domain.com",
  "defaultChain": "base",
  "chains": {
    "ethereum":  { "rpcUrl": "https://ethereum.publicnode.com" },
    "base":      { "rpcUrl": "https://mainnet.base.org" },
    "linea":     { "rpcUrl": "https://rpc.linea.build" },
    "arbitrum":  { "rpcUrl": "https://arb1.arbitrum.io/rpc" },
    "bsc":       { "rpcUrl": "https://bsc.publicnode.com" },
    "optimism":  { "rpcUrl": "https://optimism.publicnode.com" },
    "polygon":   { "rpcUrl": "https://polygon-bor-rpc.publicnode.com" },
    "sei":       { "rpcUrl": "https://evm-rpc.sei-apis.com" }
  }
}
```

### 本地开发配置

```json
{
  "relayUrl": "http://localhost:8080",
  "defaultChain": "ethereum",
  "chains": {
    "ethereum": { "rpcUrl": "http://localhost:8545" },
    "base":     { "rpcUrl": "http://localhost:8546" }
  }
}
```

如果不配置 `chains`，SDK 会使用 viem 的内置公共 RPC 端点。
