# Design: 统一联系人 + 可信任标记

## Context

当前实现中 Desktop 使用 `desktop_contacts`（通讯录）与 `trusted_addresses`（签名策略白名单）两张表；Agent 经 `wallet_contacts_add` 在钱包解锁时直接写入通讯录。用户希望合并为**单一联系人模型**：每个 (name, chain) 或每行联系人有「是否可信任」标记，限额内自动签名的地址门控改读该标记；Agent 添加联系人需**桌面人工三选一**；对外转账审批中可对「陌生人」勾选记为可信任并命名，成功后回传 Agent 同步本地。

## Goals / Non-Goals

**Goals:**

- 单表（或单逻辑集合）承载地址与 **`trusted` 标志**；**SigningEngine** 的地址白名单逻辑仅引用「联系人对该链地址且 trusted=true」。
- **单页 UI**：列表展示可信任标签；页内短文案说明可信任 = 在限额与代币白名单内可静默签。
- **Agent `wallet_contacts_add`**：Relay 到桌面后进入 **pending**，弹出 **一般 / 可信任 / 拒绝**；超时与现有审批超时策略对齐。
- ** sign_transaction 审批**：若收款地址不在通讯录或存在但未 trusted，可提供 **「添加为可信任联系人」** 路径：勾选后必填 **显示名称**，批准并链上成功后 upsert 联系人 + `trusted=true`，并通过 **扩展 `wallet_notify_tx_result`（或紧随其后的一次 RPC）** 把 `{ name, address, chain, trusted }` 交给 Agent 写入本地缓存。

**Non-Goals:**

- 链上「陌生人转入」交易由钱包**主动监听并入账流水**（仍无扫链 indexer）；本设计仅覆盖 **用户主动发起签名**（转出）场景下的「陌生人」收款方。
- 多账户 / 多钱包配置。
- 改变 Relay 服务端实现形态（仍为密文透传）。

## Decisions

### D1: 数据表合并策略

- **选择**：在 SQLite 的 `desktop_contacts` 上增加 **`trusted INTEGER NOT NULL DEFAULT 0`**（或 BOOLEAN），**删除** `trusted_addresses` 表（迁移脚本将旧信任地址按 `(address, chain)` 与现有联系人合并或插入仅地址+trusted 的行；无名称时用占位名如 `Trusted (0x..8)` 或单独 `label` 列）。
- **理由**：单事实源；查询「是否可信任」与列表展示同源。
- **备选**：保留两表视图合并 — 拒绝，重复用户心智。

### D2: Agent 添加联系人协议

- **选择**：`wallet_contacts_add` 不再在主进程同步 `upsert`。改为：
  1. Relay 收到后创建 **pendingContactRequest**（内存 Map：`pendingId` / `requestId` ↔ payload），主窗口 **Modal 三按钮**。
  2. 用户选择后写库并 **加密应答** `{ result: { contact, trusted } }` 或 `{ error, errorCode: USER_REJECTED_CONTACT }`。
- **超时**：与签名审批类似超时清理 pending，Agent 收到 `APPROVAL_TIMEOUT` 类错误。
- **备选**：独立 method `wallet_contacts_propose` — 可保留 `wallet_contacts_add` 语义为 propose，减少 Agent 工具重命名；若不改 method 名，仅改桌面行为。

### D3: 单笔转账中「陌生人 → 可信任+命名」

- **选择**：在现有 **Transaction approval modal** 增加 checkbox + name input（条件显示：当 counterparty 地址不在 trusted 联系人集合时）。
- 批准后现有签名流程不变；**成功后** `wallet_notify_tx_result` **扩展 params**：`newContact?: { name, address, chain, trusted: true }`（或与现有 `requestId/success/txHash` 并列）。Agent 收到后 **upsert `contacts.json`** 并 `save()`。
- **理由**：一次往返完成链上确认 + 双方缓存一致。
- **备选**：桌面再发单独 RPC「推联系人」 — 增加时序复杂度，优先合并进 notify。

### D4: SigningEngine.checkBudget 地址门控

- **选择**：`trusted.size > 0` 时，允许静默签的 counterparty 必须满足：**存在** `desktop_contacts` 行其 `address` 与 **(name,chain)** 对应 counterparty **且 `trusted=1`**。若表为空 trusted 集合则保持「不限制地址」或与产品定「必须无 trusted 才不限制」— **与现行为对齐**：仅当存在至少一个 trusted 联系人行覆盖该地址时启用门控，或简化为「全局：仅 trusted 地址可静默」需产品拍板；设计建议 **与现 trusted 非空则限制一致**：存在任意 `trusted=1` 行则 counterparty 必须在 trusted 联系人行中。

### D5: `wallet_trusted_list` / 独立 Tab

- **选择**：**移除** 独立 Trusted IPC 与 Tab；列表信任态在 Contacts 页 **Toggle 或 Remove**（实现阶段二选一：仅展示标签+Agent 改 trust vs 桌面编辑 trust — 最小实现可先 **仅标签 + 转账/添加流程写 trust**，编辑 trust 后续 task）。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 迁移丢数据 | 迁移前 `trusted_addresses` 全量导入 `desktop_contacts` 并 `trusted=1` |
| Agent 长阻塞等待弹窗 | 明确超时与错误码；文档说明需桌面在前台 |
| notify 载荷变大 | 仅成功且勾选时附带 `newContact`，字段小 |
| ERC-20 `to` 为合约 | counterparty 仍用 `recipient` 字段做联系人键 |

## Migration Plan

1. DB v3：`ALTER TABLE desktop_contacts ADD COLUMN trusted ...`；从 `trusted_addresses` 插入或更新匹配行；`DROP` 旧表。
2. Desktop 发版优先于 Agent 可选；Agent 需处理 add 拒绝/超时与 notify 扩展字段（向后兼容：`newContact` 可选）。

## Open Questions

- 是否在联系人页允许 **手动切换 trusted** 开关（无转账）？建议 **Phase 2**。
- 「仅联系人 trusted」与「旧 allowance addressWhitelist 已清空」后行为已一致；若用户无任何 trusted 联系人，**是否**禁止静默签 — **维持现状**：无 trusted 行则不做地址拦截。
