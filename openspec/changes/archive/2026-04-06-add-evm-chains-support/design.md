## Context

当前多链支持在 agent 和 desktop 两侧存在不对称：

```
desktop/network-config.json     agent/src/types.ts
───────────────────────────     ──────────────────
Ethereum      ✅                "ethereum"  ✅
Base          ✅                "base"      ✅
Optimism      ✅                ✗
Arbitrum      ✅                ✗
Polygon       ✅                ✗
Linea         ✅                ✗
zkSync Era    ✅                ✗  (本次不加，截图中无)
Scroll        ✅                ✗  (本次不加，截图中无)
BNB Chain     ✗                ✗
Sei EVM       ✗                ✗
```

本次目标：将 agent 侧补齐至与截图一致的 8 链（ETH、Base、Linea、Arbitrum、BNB、OP、Polygon、Sei），desktop 侧补充 BNB Chain 和 Sei EVM。

## Goals / Non-Goals

**Goals:**
- 最小改动范围：只改类型定义、链注册表、代币注册表、网络配置
- 不改动签名协议、通信格式、policy 引擎逻辑
- 新链与现有链行为完全一致

**Non-Goals:**
- 不支持非 EVM 链
- 不添加 zkSync Era、Scroll（截图中未出现）
- 不引入链的动态注册机制

## Decisions

### 1. 用 viem 内置链定义，不自定义

viem 对以下链均有官方内置定义，直接 import 即可，无需手写 chain 对象：

| 链 | viem import | chainId |
|---|---|---|
| Linea | `linea` | 59144 |
| Arbitrum | `arbitrum` | 42161 |
| BNB Chain | `bsc` | 56 |
| Optimism | `optimism` | 10 |
| Polygon | `polygon` | 137 |
| Sei EVM | `sei` | 1329 |

> **风险**：viem 版本过旧可能缺少 `sei`。需验证，若无则手写 chain 对象作为兜底。

### 2. SupportedChain 字符串与 viem 链名保持一致

保持现有命名风格（小写英文），避免歧义：

```typescript
export type SupportedChain =
  | "base"
  | "ethereum"
  | "linea"
  | "arbitrum"
  | "bsc"       // BNB Smart Chain，与 viem 保持一致
  | "optimism"
  | "polygon"
  | "sei";
```

> 用 `"bsc"` 而非 `"bnb"` 或 `"bnb-chain"`，因为 viem 的 chain 对象 id 为 `bsc`，避免混淆。

### 3. KNOWN_TOKENS 只收录主网上实际流通的 USDC/USDT

各链的官方/主流 USDC、USDT 合约地址：

| 链 | USDC | USDT |
|---|---|---|
| Linea | `0x176211869cA2b568f2A7D4EE941E073a821EE1ff` | `0xA219439258ca9da29E9Cc4cE5596924745e12B93` |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| BNB Chain | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | `0x55d398326f99059fF775485246999027B3197955` |
| Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` |
| Polygon | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| Sei | `0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1` | — (Sei 上 USDT 流通有限，暂不收录) |

### 4. Desktop network-config.json 补充 BNB Chain 和 Sei

BNB Chain（chainId: 56）和 Sei EVM（chainId: 1329）在 desktop 侧还不存在。按现有格式补充，各配置 3 个 RPC provider，优先使用公共免费节点。

BNB Chain RPC：
- `https://bsc-dataseed1.binance.org` (priority 1)
- `https://bsc.llamarpc.com` (priority 2)
- `https://bsc.publicnode.com` (priority 3)

Sei EVM RPC：
- `https://evm-rpc.sei-apis.com` (priority 1)
- `https://sei-evm.drpc.org` (priority 2)
- `https://sei.drpc.org` (priority 3)

### 5. Agent config.example.json 补充新链 RPC 示例

让用户知道可以自定义 RPC，格式与现有 ethereum/base 保持一致。

## Risks / Trade-offs

**[Risk] viem 版本不含 `sei` chain** → 检查 `agent/package.json` 中的 viem 版本；若无，手写 chain 对象（只需 id、name、nativeCurrency、rpcUrls）。

**[Risk] Sei 上 USDC 合约地址变动** → Sei 生态较新，地址以 Sei 官方文档为准；实现时需二次确认。

**[Risk] BNB Chain 原生代币是 BNB 不是 ETH** → viem 的 `bsc` chain 对象已正确定义 `nativeCurrency: { symbol: "BNB" }`。agent 的 balance 工具通过 viem chain 对象获取 native symbol，无需额外处理。但 `wallet-send.ts` 中如有硬编码 `"ETH"` 字符串需要检查。

**[Trade-off] zkSync Era / Scroll 在 network-config.json 中已有但本次不加到 agent** → 保持与用户截图严格对应，后续可独立 PR 扩展。
