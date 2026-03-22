## 1. Relay Server: 动态超时

- [x] 1.1 修改 `HandleRelay` 解析 body 中的 `timeout` 字段（整数秒），clamp 到 5-600 范围，默认 30s
- [x] 1.2 将解析后的 timeout 传入 `SendAndWait` 替代硬编码 120s
- [x] 1.3 添加测试：客户端传入 timeout=5 / timeout=900 / 不传 timeout 三种场景

## 2. Agent SDK: 分级超时和 AbortController

- [x] 2.1 在 `config.ts` 新增 `pairTimeoutMs`（默认 10000）和 `relayTimeoutMs`（默认 30000），保留 `signTimeoutMs`（默认 120000），支持环境变量覆盖
- [x] 2.2 创建通用 `fetchWithTimeout(url, options, timeoutMs)` 工具函数，内部使用 `AbortController`，超时后抛出 "Request timeout (Ns)" 错误
- [x] 2.3 修改 `pair()` 中的 GET `/pair/:code` 使用 `fetchWithTimeout`，超时 `pairTimeoutMs`
- [x] 2.4 修改 `sendToWalletRaw()` 中的 POST `/relay/:pairId` 使用 `fetchWithTimeout`，根据 method 选择超时（sign_transaction/sign_message 用 `signTimeoutMs`，其他用 `relayTimeoutMs`）
- [x] 2.5 在 POST body 中传入 `timeout` 字段（秒），值与 fetch 超时一致，让 Relay 端同步
- [x] 2.6 修改 `pair()` 中 `pair_complete` 发送使用 15s 超时

## 3. Agent SDK: 快速前置健康检查

- [x] 3.1 在 `WalletConnection` 中添加 `checkHealth()` 方法：GET `/health` 带 5s 超时，结果缓存 30s
- [x] 3.2 在 `sendToWallet()` 入口调用 `checkHealth()`，失败时立即抛 "Relay Server unreachable"
- [x] 3.3 添加测试：Relay 可达时直接通过、Relay 不可达时 5s 内返回错误、缓存 30s 内不重复请求

## 4. Desktop Wallet: Pending 审批自动过期

- [x] 4.1 修改 `SigningEngine.handleSignRequest`：创建 pending 请求时同时启动 `setTimeout(10min)`，过期后自动 `reject` 并从 `pendingRequests` 移除
- [x] 4.2 修改 `approve()` 和 `reject()`：操作时 `clearTimeout` 取消过期计时器
- [x] 4.3 添加过期回调通知机制，通过 `onApprovalExpired` 回调通知 relay-bridge 和 UI

## 5. Desktop Wallet: 结构化错误码

- [x] 5.1 在 `relay-bridge.ts` 的 `handleSignRequest` 错误回传中添加 `errorCode` 字段，映射 WALLET_LOCKED / SESSION_FROZEN / USER_REJECTED / APPROVAL_TIMEOUT / SIGN_ERROR
- [x] 5.2 更新 `sendEncrypted` 的错误响应格式，统一包含 `requestId` + `error` + `errorCode`

## 6. 更新配置和文档

- [x] 6.1 更新 `agent/config.example.json` 添加新的超时配置项及注释
- [x] 6.2 更新 `agent/skills/claw-wallet/SKILL.md` 错误处理部分，列出新的结构化错误码

## 7. 验证

- [x] 7.1 `go test ./...` in server/ — 全部通过
- [x] 7.2 `npm run build` in agent/ — 构建成功
- [x] 7.3 `npm test` in agent/ — 全部通过
- [x] 7.4 `npm run build` in agent/mcp-server/ — 构建成功
- [x] 7.5 `npm run build` in desktop/ — 构建成功
