## Context

Desktop Wallet 通过 WebSocket 连接到 Relay Server，Agent 通过 HTTP relay bridge (`POST /relay/:pairId`) 发送请求。Relay Server 使用内存中的 `pairs map[string][]*Client` 将 HTTP 请求路由到对应 pairId 的 WebSocket 客户端。

当前问题：Desktop 在首次配对场景下，`connect()` 使用 `pending-{timestamp}` 作为 pairId 连接 WebSocket（因为还没有已配对设备）。配对完成后（`completePairing` 保存了设备信息），Desktop 没有断开并用真实 pairId 重新连接，导致 Agent 的 HTTP relay 请求始终返回 404。

配对流程时序：
1. Desktop 调用 `POST /pair/create` 获取短码，同时调用 `connect()` → 使用 `pending-xxx` pairId 连接 WS
2. Agent 解析短码，计算 pairId，通过 `POST /relay/{pairId}` 发送 `pair_complete`
3. 此时 Desktop 的 WS 注册的是 `pending-xxx`，不是 Agent 计算的真实 pairId → 404
4. Agent 的 `pair_complete` 发送失败被静默忽略（catch 块为空），Agent 认为配对成功
5. 后续所有 relay 请求都返回 "no wallet connected for this pairId"

## Goals / Non-Goals

**Goals:**
- 配对完成后 Desktop 立即使用正确的 pairId 重新建立 WebSocket 连接
- 首次配对的 `pair_complete` 消息能可靠送达 Desktop
- Desktop 重启后能正确使用持久化数据自动重连
- 整个流程不依赖时序巧合，具备确定性

**Non-Goals:**
- 修改 Relay Server 的转发逻辑（server 端逻辑正确）
- 更改 E2EE 加密协议或密钥派生方式
- 实现 Agent 端 WebSocket 连接（Agent 继续使用 HTTP relay bridge）

## Decisions

### Decision 1: Desktop 首次配对使用 pending pairId + 配对完成后重连

**选择**：保留 `pending-` pairId 机制用于接收配对消息，但在 `completePairing` 后立即断开 WebSocket 并用真实 pairId 重新连接。

**替代方案 A**：让 Desktop 在 `generatePairCode` 时预计算 pairId → 不可行，因为此时不知道 Agent 的公钥。

**替代方案 B**：Agent 改用 WebSocket 而非 HTTP relay 发送 `pair_complete` → 增加 Agent 复杂度，且不解决根本的 pairId 不匹配问题。

**理由**：最小改动。问题出在 Desktop 配对完成后没有刷新 WS 连接，只需在 `completePairing` 末尾添加重连逻辑。

### Decision 2: pair_complete 消息通过 WebSocket 直接通道传递

**选择**：Agent 首次配对的 `pair_complete` 消息需要在 Desktop 使用 `pending-` pairId 的 WebSocket 连接上传递。Agent 应该先通过 WebSocket（使用 `pending-` pairId）连接发送，而不是通过 HTTP relay。

**实际方案**：由于 Agent 不使用 WebSocket，更好的方式是让 Desktop 在生成配对码后，也以基于配对码的临时标识来监听。但这会增加复杂度。

**最终选择**：保持现有 Agent 通过 HTTP relay 发送 `pair_complete` 的方式，但让 Desktop 在配对待确认阶段以 **双 pairId** 方式连接——当 `pendingPairCode` 存在时，Desktop 打开第二个 WS 连接或在收到 `pair_complete` 前就准备好以真实 pairId 连接。

**简化方案**：Agent 配对流程改为——解析短码后先不发 `pair_complete`，直接返回成功；`pair_complete` 改为在后续第一次 `sendToWallet` 调用时随正常请求一并发送（piggyback）。Desktop 在重连后处理该消息完成设备注册。

**最终决定**：最实际的方案是——Agent 在 `pair()` 中解析短码后，计算出真实 pairId，然后先等待短暂时间让 Desktop 有机会连接（因为 Desktop 的 `generatePairCode` 已经调用了 `connect()`）。关键修复在 Desktop 端：

1. `generatePairCode()` 调用 `connect()` 时，Desktop 还没有设备信息，使用 `pending-` pairId
2. 当 Desktop 收到 `pair_complete` 时无法通过 HTTP relay 收到（因为 pairId 不匹配）
3. **真正的修复**：Desktop 在 `generatePairCode()` 后应该监听所有进来的 WebSocket 消息中的 `pair_complete` 类型消息。但由于 Desktop 是通过 WS 的 pairId 路由的，消息根本到不了。

**根本修复方案**：在 Agent `pair()` 方法中，`pair_complete` 消息不走 HTTP relay，而是利用一个专门的 HTTP 端点完成配对确认。或者更简单地——Desktop 配对码生成后，以计算出的所有可能 pairId 连接（但这不可能，因为不知道 Agent 公钥）。

**最终确定方案**：
1. Agent 的 `pair_complete` 继续通过 HTTP relay 发送，失败时不影响配对状态（现有行为）
2. Desktop 在重启或重连时，如果有已配对设备但没有完成过 `pair_complete` 的确认，从持久化数据重建连接
3. 关键修复：Desktop `connect()` 方法在有已配对设备时必须使用正确的 pairId；在没有设备但有 `pendingPairCode` 时使用 pending pairId
4. `completePairing` 后调用 `reconnectWithNewPairId()` 断开旧 WS 并用真实 pairId 重连

### Decision 3: 添加 reconnectWithNewPairId 方法

**选择**：在 `RelayBridge` 中添加一个 `reconnectWithNewPairId()` 私有方法，功能为：关闭当前 WS → 将 `this.ws` 置为 null → 调用 `connect()`（此时 `connect()` 会从最新的 `pairings.devices[0]` 读取 agentPublicKey 并派生正确的 pairId）。

**理由**：复用现有 `connect()` 逻辑，避免重复代码。`connect()` 已经有 `if (this.destroyed || this.ws) return` 守卫，所以必须先将 `this.ws` 置空。

## Risks / Trade-offs

- **[短暂断连]** → 配对完成后会有一次 WS 重连，期间（几百毫秒）Desktop 不可达。可接受，因为 Agent 的 `pair_complete` 本身已经是容忍失败的。
- **[并发配对消息丢失]** → 如果 Desktop 在重连过程中收到消息会丢失 → 配对完成后的 reconnect 足够快（本地操作），且此时 Agent 不会同时发送其他请求。
- **[向后兼容]** → 此修复不改变任何协议或 API，只修改 Desktop 内部的连接管理逻辑，完全向后兼容。
