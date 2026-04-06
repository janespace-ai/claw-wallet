## Why

当前 agent 和 desktop 的转账、签名、余额查询只支持 Ethereum 和 Base 两条链。用户在截图中指定的热门 EVM 链（Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei）均无法使用，限制了钱包的实用范围。Desktop 的 `network-config.json` 已经收录了部分链（Optimism、Arbitrum、Polygon、Linea），但 agent 的类型系统将 `SupportedChain` 硬编码为 `"base" | "ethereum"`，导致 desktop 已有的多链能力无法透传给用户。

## What Changes

- **Agent**：将 `SupportedChain` 类型扩展至 6 条新链；在 `DEFAULT_CHAINS` 中添加对应的 viem chain 对象；在 `KNOWN_TOKENS` 中补齐各链的 USDC / USDT 合约地址
- **Desktop**：在 `network-config.json` 中补充 BNB Chain（chainId: 56）和 Sei EVM（chainId: 1329）；Optimism、Arbitrum、Polygon、Linea 已存在，无需改动
- **Agent config.example.json**：补充新链的 RPC 示例

## Capabilities

### New Capabilities

- 在 Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei 上查询 ETH/BNB/POL 原生余额
- 在以上链上查询 USDC、USDT 余额
- 在以上链上发起 ETH/BNB/POL 原生转账
- 在以上链上发起 USDC/USDT ERC-20 转账
- 在以上链上进行 gas 估算

### Modified Capabilities

- `SupportedChain` 类型由 `"base" | "ethereum"` 扩展为包含所有 8 条链的联合类型
- agent 默认链仍为用户配置的 `defaultChain`，无行为变化

## Non-Goals

- 不支持 Bitcoin、Solana、Tron 等非 EVM 链
- 不支持跨链 swap 或桥接
- 不修改签名协议或 agent-desktop 通信格式
- 不动态发现链（链列表在编译时固定）

## Impact

- **agent/src/types.ts**：`SupportedChain` 类型、`KNOWN_TOKENS` 更新
- **agent/src/chain.ts**：`DEFAULT_CHAINS` 添加 6 条新链
- **agent/config.example.json**：新增新链 RPC 配置示例
- **desktop/network-config.json**：新增 BNB Chain、Sei EVM 两条网络
- **无破坏性变更**：现有 `"base"` 和 `"ethereum"` 行为完全不变
