# Proposal: 联系人与 Trusted 合并为单一通讯录 + 可信任标记

## Why

当前桌面端「联系人」与「Trusted」分表、分页，用户与 Agent 容易混淆；信任策略应附着在「认识的人」上，而不是维护两套数据。合并后：一个联系人列表即可管理地址与是否参与限额内自动转账，并在 Agent 发起添加时用桌面弹窗一次性确认粒度（一般 / 可信任 / 拒绝）。对于链上收款方不在通讯录中的场景，用户在审批转账时可选择是否将其记为可信任联系人并同步回 Agent。

## What Changes

- **BREAKING（数据模型）**：废弃独立的 `trusted_addresses` 表；联系人表增加 **`trusted`（或可信任）布尔/枚举列**，迁移历史信任地址与新 schema 对齐。
- **BREAKING（Relay / Agent）**：Agent 侧「添加联系人」不再同步即时落库为最终结果；改为 **Desktop 弹窗三选一**（一般联系人 / 可信任联系人 / 拒绝）后由桌面写入；拒绝则向 Agent 返回错误。
- **桌面 UI**：合并原 **Contacts** 与 **Trusted** 为单一 **Contacts** 页；列表项展示 **可信任** 标签；页内说明可信任联系人在限额内可自动转账（与现有 SigningEngine 策略一致）。
- **入账/转出链上陌生人**：在 **转账审批**弹窗增加选项：是否添加为可信任联系人；若勾选则需 **填写联系人名称**；签名/链上成功后写入联系人并标记可信任，并通过约定方式 **将联系人信息返回 Agent**（例如扩展现有 notify 或新增 RPC），使 Agent 本地 `contacts.json` 同步。
- 移除或停用仅针对 `trusted_addresses` 的独立 IPC/Tab（合并进联系人页后编辑信任状态）。

## Capabilities

### New Capabilities

- `unified-contacts-trust`: 统一联系人 schema（含 `trusted`）、桌面弹窗审批（Agent 添加）、陌生人转账勾选命名与回传 Agent、UI 标签与说明。

### Modified Capabilities

- `contacts`: Agent 工具行为变更（添加走待审批 / 错误码）；列表与解析需暴露 `trusted`；桌面权威返回结构扩展。
- `electron-wallet-app`: 单页联系人管理、信任标签、合并设置与说明文案；审批流 UI 扩展。

## Impact

- **Desktop**：SQLite 迁移、`WalletAuthorityStore` / `SigningEngine.checkBudget` 信任判定来源改为联系人表；`relay-bridge` 中 `wallet_contacts_add` 改为 pending + IPC 弹窗解析；预处理 `Trusted` Tab 下线。
- **Agent**：`wallet-contacts.ts`、`wallet-connection` 超时/错误处理；转账结果回传后合并本地联系人。
- **文档**：`AGENT_VERIFICATION.md`、`RELAY_WALLET_RPC.md`（或归档副本）、`claw-wallet` SKILL。
- **OpenSpec 归档**：与 `desktop-approval-trust` 分裂模型相关的 delta 需被本变更取代或补充说明。
