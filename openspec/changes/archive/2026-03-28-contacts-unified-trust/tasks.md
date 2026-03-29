# Tasks: 统一联系人 + 可信任标记

## 1. 数据库与领域模型

- [x] 1.1 SQLite v3：`desktop_contacts` 增加 `trusted`；**丢弃** `trusted_addresses`（不迁移历史行，降低复杂度）
- [x] 1.2 `WalletAuthorityStore`：合并查询/更新 trusted；联系人 API（`upsertContact` 含 `trusted`）
- [x] 1.3 `SigningEngine.checkBudget`：地址门控读联系人 `trusted + address + chain`

## 2. Relay 与 Agent 添加联系人

- [x] 2.1 `wallet_contacts_add` 桌面路径 pending + 超时；主进程三按钮弹窗
- [x] 2.2 错误码：`USER_REJECTED_CONTACT`、`APPROVAL_TIMEOUT`；见 `docs/RELAY_WALLET_RPC.md`
- [x] 2.3 Agent `wallet_contacts_list`/`resolve` 镜像 `trusted`；连接错误带 `walletErrorCode`

## 3. 桌面 UI

- [x] 3.1 合并 **Contacts** / **Trusted** 为单页：可信任标签与说明
- [x] 3.2 移除 Trusted Tab 与 `wallet:list-trusted` / `remove-trusted` IPC
- [x] 3.3 转账审批：陌生人可选可信任 + 必填名称；`approve` 传入 `trustRecipientName`

## 4. 链上成功后同步与 notify

- [x] 4.1 `wallet_notify_tx_result` 结果携带可选 `newContact`；**仅**在 relay 路径调用 `applyPostTxTrust`（移除 txSync 重复回调）
- [x] 4.2 Agent 收到 `newContact` 后 upsert `contacts.json` + `trustedOnChain`

## 5. 文档与验收

- [x] 5.1 `docs/AGENT_VERIFICATION.md`、`agent/skills/claw-wallet/SKILL.md`、`docs/RELAY_WALLET_RPC.md`
- [x] 5.2 回归：实现已完成；发版前建议手测三选一、拒绝、转出记名可信任、限额内静默签
