## Context

桌面通讯录 `desktop_contacts` 当前为 `UNIQUE(name COLLATE NOCASE, chain COLLATE NOCASE)`，允许同一展示名在多链上多行，也不禁止同一 `(address, chain)` 被多个名字引用。反查收款人、审批文案与历史列表展示需要**无歧义**的一对一关系。用户选择**展示时解析**：列表与弹窗用**当前**通讯录匹配地址+链，不在 `signing_history` 上增加快照列。

## Goals / Non-Goals

**Goals:**

- 数据不变量：**`name` 全局唯一（大小写不敏感）**，**`(normalized address, normalized chain)` 唯一**。
- SQLite 迁移：对已有冲突数据执行可重复的归并/重命名规则（见下），再创建唯一索引。
- `WalletAuthorityStore`：`upsertContact` / `resolveContact` / Relay 列表与 Agent 镜像语义与不变量一致。
- 审批 `TransactionRequestInfo` 携带可选 `counterpartyContact: { name, trusted }`（主进程解析）。
- Activity 与 Security 签名历史：渲染时根据 `tx_to` + `tx_chain`（及与签名时一致的规范化地址）匹配当前联系人并展示名称与可信任标签，再以地址为辅。

**Non-Goals:**

- 历史记录不随联系人改名而「冻结」旧名（展示时解析 → 改名后列表可能显示新名）。
- 不在本变更中重做 Relay 加密协议或 Agent 转账管线。

## Decisions

### D1: 唯一性语义

- **选择**：一行 = 一个「联系人展示名」= 恰好一个 `(address, chain)`。同一真实人若多链，需**多个不同名字**（如 `Alice-base` / `Alice-mainnet`）或多个联系人条目，由用户起名习惯决定。
- **理由**：与用户口述「一个联系人对应一个 address+chain」一致，消灭一对多反查。

### D2: 迁移冲突处理

- **选择**（建议默认，可在实现时日志化）：
  1. 对重复 `(address, chain)`：保留 `updated_at` 最新的一行，删除其余。
  2. 对重复 `name`（大小写不敏感）：除保留一行外，其余行将 `name` 改为 `"{原name} ({chain})"` 直至唯一。
- **理由**：自动可启动；极端情况可再加「导出后清空」手册。
- **备选**：迁移失败要求用户清空通讯录 — 对已有用户过痛，不作为首选项。

### D3: 展示时解析

- **选择**：Renderer 在打开审批弹窗时除 `req.counterpartyContact` 外不强制二次拉取；历史列表在 `loadSigningHistory` / `loadActivityRecords` 后 `invoke list-contacts` 一次，在内存中建 `Map` key=`chain:lowercaseAddress` → `{name, trusted}`。
- **理由**：简单、无新表；联系人数量小，O(n) 可接受。

### D4: Agent `contacts.json`

- **选择**：与桌面一致：**每名至多一条链上地址**；`addContact` 若已存在同名则覆盖该名的 `addresses` 对象中**仅保留本次涉及的链**或整体替换为单链 — 以实现为准，与桌面单行模型对齐。
- **理由**：避免 Agent 缓存再次出现「一名多链」与桌面权威矛盾。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 迁移改名不符合用户预期 | 发布说明 + 未来可导出备份 |
| ERC-20 合约 `to` 与 `recipient` 不一致 | 解析键与签名引擎一致，使用 `recipient` 优先 |
| 历史列表 contacts 拉取失败 | 回退为仅地址展示 |

## Migration Plan

1. 数据库 v4：`desktop_contacts` 应用 D2 数据修复；创建 `UNIQUE` 索引于 `lower(name)` 与 `(lower(address), lower(chain))`（SQLite 中可用表达式索引或应用层规范化 + 生成的唯一列，按实现选型）。
2. 发版顺序：桌面优先；旧 Agent 仍可多次 `wallet_contacts_add` 同名的不同链——桌面应返回明确错误 **DUPLICATE_NAME** / **DUPLICATE_ADDRESS**。

## Open Questions

- 是否在桌面通讯录 UI 明示「每名仅一条链记录」的帮助文案（建议加一句）。
