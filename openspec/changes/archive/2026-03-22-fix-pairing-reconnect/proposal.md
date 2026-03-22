## Why

Desktop 完成配对后，WebSocket 连接仍然使用旧的 `pending-xxx` pairId，而 Agent 通过 HTTP relay 使用正确计算的 pairId 发送请求，导致 relay server 无法找到匹配的 WebSocket 客户端，返回 `"no wallet connected for this pairId"` 错误。此外，自动重连流程中 Desktop 的 `connect()` 方法在 `pending-` fallback 分支存在时序问题，首次配对场景下无法建立有效的消息通道。

## What Changes

- Desktop `completePairing` 后断开当前 WebSocket 并使用正确的 pairId 重新连接
- 修复 `connect()` 方法中 `pending-` pairId 的 fallback 逻辑，确保配对完成后立即切换到真实 pairId
- Agent 配对完成后的 `pair_complete` 消息发送改为通过 WebSocket 通道而非 HTTP relay（因为此时 Desktop 尚未以正确 pairId 注册）
- 补充自动重连流程中的健壮性检查，确保 Desktop 重启后能正确使用持久化的 agentPublicKey 派生 pairId 进行 WebSocket 连接

## Capabilities

### New Capabilities
- `pairing-reconnect-fix`: 修复配对完成后的 WebSocket pairId 不一致问题和自动重连流程

### Modified Capabilities
- `wallet-pairing`: 配对完成后需要重新建立 WebSocket 连接使用正确的 pairId
- `auto-reconnect-pairing`: 自动重连逻辑需处理首次配对场景和 pairId 切换

## Impact

- `desktop/src/main/relay-bridge.ts` — `connect()`、`completePairing()`、`handleMessage()` 方法需要修改
- `agent/src/wallet-connection.ts` — `pair()` 方法中 `pair_complete` 消息发送方式可能需要调整
- `server/internal/hub/hub.go` — 无需修改，relay server 逻辑正确
- WebSocket 连接会在配对完成后短暂中断并重连，这是预期行为
