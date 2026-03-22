## 1. Desktop RelayBridge — 配对完成后重连

- [x] 1.1 在 `RelayBridge` 中添加 `reconnectWithNewPairId()` 私有方法：关闭当前 WS 连接、清除 `this.ws`、重置 reconnect 计数器、调用 `connect()`
- [x] 1.2 在 `completePairing()` 末尾调用 `reconnectWithNewPairId()`，确保保存 pairings 后立即触发重连
- [x] 1.3 确保 `reconnectWithNewPairId()` 不清除 `this.sessions` Map，保留已建立的 E2EE 会话

## 2. Desktop RelayBridge — connect() 逻辑修复

- [x] 2.1 修复 `connect()` 中 pairId 派生逻辑：当 `pairings.devices` 有设备且存在 `agentPublicKey` 时，始终使用 `derivePairId()` 计算真实 pairId
- [x] 2.2 仅在无设备且 `pendingPairCode` 存在时使用 `pending-` pairId fallback
- [x] 2.3 在 `connect()` 中添加日志记录实际使用的 pairId（截断为 8 字符），便于调试

## 3. Agent 配对流程健壮性

- [x] 3.1 在 `pair()` 方法中，`pair_complete` 发送失败时添加 console.warn 日志，而非完全静默
- [x] 3.2 确认 `pair()` 返回的 pairId 与 Desktop 后续使用的 pairId 一致（验证 `derivePairId` 输入参数一致性）

## 4. 测试验证

- [x] 4.1 验证首次配对流程：生成码 → 解析码 → pair_complete → Desktop 重连 → Agent relay 请求成功
- [x] 4.2 验证 Desktop 重启后自动重连：持久化数据正确加载 → 使用真实 pairId 连接 WS → Agent relay 请求成功
- [x] 4.3 验证多次配对场景：已有设备时重新配对，新设备的 pairId 正确替换旧连接
- [x] 4.4 重新部署 relay server Docker 容器并进行端到端验证
