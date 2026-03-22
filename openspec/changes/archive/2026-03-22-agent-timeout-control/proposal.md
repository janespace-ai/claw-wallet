## Why

Agent 执行钱包操作（转账、配对等）时，用户体验极差：所有请求共享同一个 120s 超时，且 Agent 端的 HTTP fetch 没有任何超时控制，Desktop Wallet 的 pending approval 也没有超时。导致的结果是——一笔转账失败需要等十几分钟才能得到反馈，确定性接口（如配对码验证）也被迫等待不必要的时间。

需要按操作类型分级超时，让确定性操作秒级返回，只有需要用户审批的操作才允许长等待。

## What Changes

- Agent SDK (`WalletConnection`): 为 `fetch` 添加 `AbortController` 超时控制，按操作类型使用不同超时值
- Agent SDK (`WalletConnection`): `sendToWallet` 调用前增加快速前置检查（pairing 存在性、Relay 可达性）
- Relay Server (`POST /relay/:pairId`): 支持客户端传入 `timeout` 参数，替代硬编码 120s
- Desktop Wallet (`SigningEngine`): pending approval 加 10 分钟自动过期，超时自动 reject
- Desktop Wallet (`relay-bridge`): 向 Agent 返回结构化错误，区分"钱包离线"、"审批超时"、"用户拒绝"

## Capabilities

### New Capabilities

（无新增 capability）

### Modified Capabilities

- `http-relay-bridge`: POST /relay/:pairId 支持客户端指定 timeout 参数，限制范围 5-600s
- `signer-daemon`: WalletConnection 增加分级超时策略和快速前置检查
- `signer-allowance`: SigningEngine pending 请求增加 10 分钟自动过期

## Impact

- **agent/src/wallet-connection.ts**: 主要改动文件，添加 AbortController、分级超时、前置检查
- **agent/src/config.ts**: 新增超时配置项（pairTimeoutMs, relayTimeoutMs, signTimeoutMs）
- **server/internal/hub/hub.go**: HandleRelay 解析客户端 timeout 字段，SendAndWait 使用动态超时
- **desktop/src/main/signing-engine.ts**: pending 请求增加 TTL 自动清理
- **desktop/src/main/relay-bridge.ts**: 返回更具结构化的错误类型
