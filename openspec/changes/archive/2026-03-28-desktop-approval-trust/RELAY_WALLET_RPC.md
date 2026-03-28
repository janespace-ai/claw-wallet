# Relay 加密 RPC：`wallet_*` 方法与错误码

与签名请求相同载体：明文 JSON 经 E2EE 会话加密后，以 `type: "encrypted"`、`payload`（base64）在中继上传输。请求体至少包含：

- `requestId`：字符串，单次请求唯一。
- `method`：下表之一。
- `params`：对象（可为 `{}`）。

应答密文解密后为 JSON：

- 成功：`{ "requestId": "<同上>", "result": <method 专属> }`
- 失败：`{ "requestId": "<同上>", "error": "<人类可读说明>", "errorCode": "<机器码>" }`

## 方法列表

| method | 说明 | params | result |
|--------|------|--------|--------|
| `sign_transaction` | 签名交易（现有） | 链上字段 + 可选 `recipient`（实际收款人，ERC20 时与 `to` 合约区分） | `{ signedTx, address }` |
| `sign_message` | 签名消息（现有） | `message` 等 | `{ signature, address }` |
| `wallet_contacts_list` | 列出权威联系人 | `{}` | `{ contacts: { name, chain, address }[] }` |
| `wallet_contacts_add` | 添加/更新联系人 | `name`, `address`, `chain?` | `{ contact: { name, chain, address } }` |
| `wallet_contacts_remove` | 按名称删除（不区分大小写） | `name` | `{ removed: number }` |
| `wallet_contacts_resolve` | 按名称解析地址 | `name`, `chain?` | `{ address, chain, exactMatch }` 或出错 |
| `wallet_trusted_list` | 列出信任地址 | `{}` | `{ trusted: { address, label, source, createdAt }[] }` |
| `wallet_notify_tx_result` | 链上结果回执（写入 Activity `tx_hash`、拉收据、成功后履行「待信任」） | `requestId`（与 `sign_transaction` 一致）, `success`, `txHash?`, `chain?`（如 `base` / `ethereum`，用于桌面拉收据）, `revertReason?` | `{ ok: true }` |

说明：

- **不要求解锁**：`wallet_notify_tx_result`（不涉及密钥；桌面仍会更新 `signing_history` 与可选的待信任逻辑）。
- **要求钱包已解锁**：其余 `wallet_contacts_*`、`wallet_trusted_list`（与读写权威数据一致）。
- **不在 Relay 上提供**：`wallet_trusted_add`（信任仅经桌面 UI 勾选 + 成功回执等路径写入）；`wallet_trusted_remove` 仅桌面 IPC。

## 错误码（errorCode）

| errorCode | 含义 |
|-----------|------|
| `SESSION_FROZEN` | 会话被安全策略冻结 |
| `WALLET_LOCKED` | 需要解锁（除 `wallet_notify_tx_result` 外） |
| `INVALID_PARAMS` | 缺少或非法参数 |
| `NOT_FOUND` | 联系人不存在等 |
| `USER_REJECTED` / `APPROVAL_TIMEOUT` / `SIGN_ERROR` | 签名路径已有 |
| `INTERNAL_ERROR` | 未分类的服务器/本地错误 |

Agent 侧对 `wallet_contacts_*` 推荐使用与通用 RPC 相同的超时（如 `relayTimeoutMs`）；`sign_*` 使用 `signTimeoutMs`。
