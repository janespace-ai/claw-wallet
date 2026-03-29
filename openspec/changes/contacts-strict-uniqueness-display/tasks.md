# Tasks: 联系人唯一约束 + 展示时解析标签

## 1. SQLite 与 WalletAuthorityStore

- [ ] 1.1 迁移 v4：冲突数据按 design D2 规则修复；`name` 与 `(address, chain)` 唯一约束落地
- [ ] 1.2 `upsertContact`：同名单行替换；重复 `(address, chain)` 返回明确错误码；`resolveContact` / `remove` 与单链语义一致
- [ ] 1.3 新增 `lookupContactByAddressChain(address, chain)`（或等价）供 Relay / UI 使用

## 2. 审批与 Relay

- [ ] 2.1 `TransactionRequestInfo` 增加 `counterpartyContact?: { name, trusted }`；`handleSignRequest` 回调内填充
- [ ] 2.2 `wallet_contacts_*` / Relay 错误码：`DUPLICATE_NAME`、`DUPLICATE_RECIPIENT`（或合并命名）与文档同步

## 3. Renderer 展示

- [ ] 3.1 交易审批弹窗：联系人名 + 可信任标签 + 地址（与 spec 一致）
- [ ] 3.2 Activity / Signing history：`list-contacts` 建查找表，渲染时匹配 `tx_to` + `tx_chain`；无匹配仅地址
- [ ] 3.3 Contacts 页帮助文案：每名一单链

## 4. Agent 与文档

- [ ] 4.1 `ContactsManager` / `wallet-contacts`：与「一名一条链地址」对齐；镜像与 resolve 行为更新
- [ ] 4.2 更新 `docs/RELAY_WALLET_RPC.md`、`docs/AGENT_VERIFICATION.md`（如需要）

## 5. 回归

- [ ] 5.1 手动：同名更新、重复地址拒绝、审批弹窗标签、历史列表标签、改名后历史展示随之变化
