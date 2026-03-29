## Why

联系人表当前允许同一 `name` 在多条链上各一行（`UNIQUE(name, chain)`），且未禁止同一 `(address, chain)` 被多个名字引用，导致反查「转给谁」时出现一对多歧义。审批弹窗与转账记录需要稳定展示「联系人 + 可信任标签 + 地址」，必须先收紧数据模型。展示层采用**展示时解析**（读取当下通讯录匹配），避免为历史记录做快照列与迁移复杂度。

## What Changes

- **BREAKING（权威通讯录）**：`desktop_contacts` 约束调整为：**`name` 全局唯一（大小写不敏感）** 且 **`(address, chain)` 唯一**（地址与链规范化后）。现有冲突数据在迁移中需定义策略（保留一行或拒绝启动并提示导出现有表）。
- **索引/约束**：用唯一索引落实上述不变量；`upsert` / Agent 添加 / 桌面删除等路径需与错误语义对齐（重复名、重复地址+链返回可读错误）。
- **审批弹窗**：主进程在推送 `wallet:tx-request` 前按收款地址+链反查联系人；命中则展示联系人名称、可信任标签，再展示地址。
- **转账/签名历史 UI**：Activity 与 Security 签名列表在渲染时解析联系人（可与一次性传入的通讯录列表或轻量 IPC 辅助），**不**新增历史表快照字段。
- **Agent / Relay**：若列表或 `wallet_contacts_add` 语义依赖「同名多链」，需改为每联系人单行或与产品一致的报错；`wallet_contacts_resolve` 行为随之简化。

## Capabilities

### New Capabilities

- （无单独新能力目录；规则与 UI 要求写入下列现有能力的 delta。）

### Modified Capabilities

- `contacts`: 通讯录不变量（name 唯一、address+chain 唯一）、工具与解析行为。
- `electron-wallet-app`: 交易审批展示；Activity/Signing 列表展示顺序（联系人、信任标签、地址）。
- `unified-contacts-trust`: 与唯一行模型对齐的可信任标记语义（每联系人至多一条权威行）。

## Impact

- **Desktop**：SQLite 迁移；`WalletAuthorityStore`（含 `upsertContact`、`resolveContact`、`listContacts`）；`relay-bridge` 中 `TransactionRequestInfo`；`renderer` 审批与历史列表。
- **Agent**：`wallet-contacts` 工具与 `ContactsManager` 若假设「一名多链」需调整；本地 `contacts.json` 结构可能需与桌面一致（每 name 单地址映射或按链拆名由 design 定）。
- **文档**：`RELAY_WALLET_RPC` / 验证说明中联系人语义更新。
