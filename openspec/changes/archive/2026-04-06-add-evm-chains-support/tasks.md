## 1. 验证 viem 版本支持

- [x] 1.1 检查 `agent/package.json` 中 viem 版本，确认是否包含 `sei` chain 导出
  - 方法：`grep '"viem"' agent/package.json`，然后查 viem changelog
  - 若 `sei` 不存在，在 `agent/src/chain.ts` 中手写 Sei chain 对象（id: 1329, nativeCurrency: SEI）

## 2. 更新 agent/src/types.ts

- [x] 2.1 扩展 `SupportedChain` 联合类型：
  ```typescript
  export type SupportedChain =
    | "base"
    | "ethereum"
    | "linea"
    | "arbitrum"
    | "bsc"
    | "optimism"
    | "polygon"
    | "sei";
  ```
- [x] 2.2 扩展 `KNOWN_TOKENS`，为 6 条新链各补充 USDC/USDT 合约地址（参考 design.md 中的地址表）
  - Sei 只加 USDC，暂不加 USDT

## 3. 更新 agent/src/chain.ts

- [x] 3.1 从 `viem/chains` 新增 import：`linea, arbitrum, bsc, optimism, polygon`（以及 `sei` 若版本支持）
- [x] 3.2 在 `DEFAULT_CHAINS` 中添加 6 条新链的映射

## 4. 检查 wallet-send.ts 中的原生 token 处理

- [x] 4.1 搜索 `wallet-send.ts` 中硬编码的 `"ETH"` 字符串
- [x] 4.2 若有，改为从 viem chain 对象的 `nativeCurrency.symbol` 动态获取，确保 BNB Chain 显示 `BNB`、Polygon 显示 `POL`

## 5. 更新 desktop/network-config.json

- [x] 5.1 添加 BNB Chain 条目（chainId: 56），按现有格式配置 3 个 RPC + explorer + icon
- [x] 5.2 添加 Sei EVM 条目（chainId: 1329），配置 3 个 RPC + explorer + icon

## 6. 更新 agent/config.example.json

- [x] 6.1 在 `chains` 字段中补充 6 条新链的 RPC 示例配置

## 7. 验证

- [x] 7.1 `npm run build` in `agent/` 通过（TypeScript 类型检查无错误）
- [x] 7.2 `npm test` in `agent/` 通过
- [x] 7.3 `npm run build` in `desktop/` 通过
- [x] 7.4 手动验证：用 agent 查询 Arbitrum 上的 ETH 余额（需要测试地址）
- [x] 7.5 手动验证：用 agent 查询 Polygon 上的 USDC 余额
