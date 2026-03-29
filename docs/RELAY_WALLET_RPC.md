# Relay Wallet RPC（桌面权威）

E2EE 透传到桌面主进程的方法与错误码约定（节选，随实现更新）。

## 方法

| 方法 | 说明 | 主要参数 | 成功结果 |
|------|------|----------|----------|
| `wallet_contacts_list` | 列出联系人 | `{}` | `{ contacts: { name, chain, address, trusted }[] }` |
| `wallet_contacts_add` | 提议添加联系人（**需桌面弹窗三选一**） | `name`, `address`, `chain?` | `{ contact: { name, chain, address, trusted } }` |
| `wallet_contacts_remove` | 按名称删除 | `name` | `{ removed: number }` |
| `wallet_contacts_resolve` | 按名称解析地址（须与该行保存的链一致） | `name`, `chain?` | `{ address, chain, exactMatch, trusted }` |
| `wallet_notify_tx_result` | 链上结果通知 | `requestId`, `success`, `txHash?`, `chain?` | `{ ok: true, newContact?: { name, address, chain, trusted } }` |

已移除：`wallet_trusted_list`（可信任态含在联系人字段 `trusted` 中）。

## 错误码（节选）

| `errorCode` | 含义 |
|-------------|------|
| `WALLET_LOCKED` | 需要解锁（`wallet_notify_tx_result` 除外） |
| `USER_REJECTED_CONTACT` | 用户在桌面拒绝添加联系人 |
| `APPROVAL_TIMEOUT` | 联系人添加或签名审批超时 |
| `INVALID_PARAMS` | 参数无效 |
| `NOT_FOUND` | 联系人未找到 |
| `CHAIN_MISMATCH` | 联系人存在，但请求链与保存的链不一致 |
| `DUPLICATE_RECIPIENT` | 该 `(address, chain)` 已被其他联系人名占用（例如用户确认添加时冲突） |
| `SESSION_FROZEN` | 会话被冻结 |
