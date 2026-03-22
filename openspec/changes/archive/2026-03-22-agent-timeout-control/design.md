## Context

当前 Agent↔Relay↔Desktop Wallet 请求链路中，超时控制存在三个层面的缺陷：

1. **Agent 端**：`WalletConnection.sendToWalletRaw()` 中的 `fetch()` 没有 `AbortController`，无超时上限
2. **Relay Server 端**：`POST /relay/:pairId` 硬编码 `SendAndWait(120s)`，所有操作类型一刀切
3. **Desktop Wallet 端**：`SigningEngine` 中超预算的 pending approval 是一个永远不会自动 resolve/reject 的 Promise

三层叠加的最坏情况：Agent 发起一笔转账 → Relay 等 120s → Desktop 等无限 → 用户看到的是 "一直在执行" 长达十几分钟。

## Goals / Non-Goals

**Goals:**

- 确定性操作（配对码验证、余额查询路由等）10s 内返回成功或失败
- 需要 Wallet 响应但无需用户操作的请求（pair_complete）15s 内返回
- 需要用户审批的签名请求最长等待 10 分钟，超时自动 reject
- 任何环节不允许出现无限等待
- 提供结构化错误信息，Agent 能区分 "钱包离线"、"审批超时"、"用户拒绝"

**Non-Goals:**

- 不改动 Desktop Wallet ↔ Relay 的 WebSocket 长连接机制
- 不改动 E2EE 加解密流程
- 不引入消息队列或异步回调机制（保持同步 HTTP 模型）

## Decisions

### Decision 1: Agent 端分级超时

**选择**：按操作语义分配超时值，通过 `AbortController` 实现 fetch 超时。

| 操作 | 超时 | 理由 |
|------|------|------|
| `pair()` HTTP GET `/pair/:code` | 10s | Relay 本地查表，纯同步 |
| `pair_complete` 发送 | 15s | 需要 Relay 转发到 WS peer |
| `sign_transaction` / `sign_message` | 配置化，默认 120s，上限 600s | 可能需要用户审批 |
| 通用 `sendToWallet()` 其他方法 | 30s | 合理默认 |

超时值存放在 `AgentConfig` 中，支持环境变量 / config.json 覆盖。

**备选方案**：统一使用一个超时值 → 不可行，操作类型差异太大。

### Decision 2: Relay Server 支持客户端传入 timeout

**选择**：`POST /relay/:pairId` 的 JSON body 新增可选字段 `timeout`（整数，单位秒）。

- 合法范围：5–600（超出范围 clamp 到边界值）
- 缺省值：30s（从 120s 降低，因为大部分操作不需要那么久）
- Agent 端根据操作类型传入不同的 timeout

**备选方案**：通过 HTTP header `X-Timeout` 传入 → 可行但不如 body 字段直观，且与现有 body 结构统一更好。

### Decision 3: Desktop Wallet pending 请求自动过期

**选择**：`SigningEngine` 中为每个 pending 请求设置 `setTimeout`，10 分钟后自动 `reject(new Error("Approval timeout"))`，同时从 `pendingRequests` map 中清除并通知 UI。

**备选方案**：由 Relay 超时来隐式控制 → 不够，因为 Relay 超时只断开 HTTP 侧，Desktop 端的 pending Promise 仍然泄漏。

### Decision 4: 快速前置检查

**选择**：`sendToWallet()` 在加密和发送前执行两项快速检查：

1. `this.pairing` 是否存在 → 不存在立即抛 Error（当前已有）
2. Relay 是否可达 → `fetch(relayUrl + "/health")` 带 5s 超时，失败则立即报错 "Relay Server 不可达"

不检查 Wallet 是否在线（因为这需要一次完整的 Relay roundtrip，不够 "快速"）。Wallet 不在线的情况由 Relay 返回 404 快速告知。

**备选方案**：在 Relay 增加 `GET /status/:pairId` → 可以做但不是必须的，404 from SendAndWait 已足够。

## Risks / Trade-offs

- **[风险] 超时值选择不当** → 缓解：所有超时可配置，不硬编码。观察生产数据后可调整。
- **[风险] Relay health check 增加延迟** → 缓解：仅 5s 超时且可选；如果 health check 成功会被缓存一段时间（例如 30s 内不重复检查）。
- **[风险] Desktop pending 自动过期导致用户来不及审批** → 缓解：10 分钟足够充裕；UI 上显示倒计时提示。
- **[trade-off] 降低 Relay 默认超时从 120s 到 30s** → 不影响需要长等待的签名请求（Agent 会显式传入更长的 timeout），但大幅改善其他操作的失败速度。
