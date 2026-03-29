# Desktop 审批、信任地址与联系人——变更提案

## Why

当前审批与「白名单 / 限额」存在语义与安全上的问题，主要包括：

1. **美元估值错误**：Agent 侧字段命名易误导（如将代币数量标为 `amountUsd`），Desktop 若用其做 `checkBudget`，会出现大额转账仍被判定「在限额内」、从而**静默签名**的情况。
2. **信任来源不唯一**：Agent `policy.whitelist` 可由工具直接修改，与 Desktop `addressWhitelist` 可能不一致，无法保证「以钱包为准」。
3. **缺少产品化能力**：用户希望在签名审批时可选「将地址加入信任」、在 Desktop 单独管理信任列表与联系人，并把持久化统一纳入 **SQLite**。

本变更在 **Explore 中已定方向**：**价格与签名闸门以 Desktop 为准**；**跨端仅走现有 Relay 转发链**，通过 **新增通信请求 / 协议字段** 扩展能力，**不新建并行通信渠道**；**Agent ↔ Desktop 之间不采用 IPC**；Desktop 侧信任与联系人数据入 **SQLite**，界面层与主进程协作沿用既有模式。

## Capabilities

- `desktop-signing-usd-policy` — Desktop-computed USD for allowance; no silent sign without price
- `trusted-addresses-desktop` — SQLite trust list; add via confirmed flows; checkbox persists after successful tx
- `relay-contact-requests` — Agent contact/trust mutations over Relay only; desktop authoritative

## What Changes（能力层面）

- **桌面主导 USD 估值**：签名前由 Desktop 使用 `PriceService` + 链上 `value`/decimals 计算用于限额比较的美元估值；**不依赖** Agent 传递的价格结论。
- **无价必审**：若 Desktop **无法获得可信价格**，则**禁止自动签名**，必须人工审批（并在 UI 标明原因）。
- **字段清理**：Agent 侧重命名/调整载荷，避免「非美元却名为 USD」的字段；Desktop 不以 Agent 传的「美元」作为限额真值。
- **信任地址（白名单）**：仅 Desktop 持久化（SQLite）；**添加信任地址须经人工确认**；删除信任可不经 Agent 侧二次确认（由 Desktop 执行）。
- **审批 UI**：签署确认时可勾选「将收款地址加入信任」；**在交易签名成功且广播成功回执之后** 再写入 Desktop 信任列表（方案 B）；失败则不写入。
- **联系人**：允许 **Agent 与 Desktop 双边存储**；Agent 的增删通过 **Relay → Desktop** 处理；**以 Desktop 为权威**（冲突解析、解析收款方时的优先级）。
- **存储**：信任地址与 Desktop 权威联系人数据落入 **现有/扩展 Desktop SQLite**（与 `signing_history` 同库策略一致）。

## Agent 侧调整（概要）

- 移除或弃用 **Agent 本地 `policy.whitelist`** 及通过 `wallet_policy` **直接写入白名单**的能力（细则见 `design.md`）。
- 联系人工具改为 **向 Desktop 发请求**（或由 Desktop 回调结果），而非仅改本地 `contacts.json`（本地可作为非权威缓存，与 Explore 结论一致）。

## Impact

| 区域 | 影响 |
|------|------|
| Desktop 主进程 | `SigningEngine` / `relay-bridge`：估值逻辑、自动签条件、新消息类型处理；SQLite 迁移或新表 |
| Desktop 渲染进程 | 审批弹窗（信任勾选）、新 Tab（信任列表 + 删除；联系人展示可与现有结构整合） |
| Agent | 载荷字段、`PolicyEngine`/工具、与 Desktop 的协议对齐 |
| Relay / E2EE | 可能新增加密 method（联系人/信任申请），需与现有 `sign_transaction` 流一致 |

## Risks

- **协议与版本**：旧 Agent + 新 Desktop 需协议兼容或明确最低版本。
- **离线 Desktop**：Agent 排队、超时与幂等策略需在实现阶段定义。
- **延后写入信任**：须落实「成功回执」判定与失败路径，避免重复写入或丢单；可选在 UI 提示「成功上链后将加入信任」。

## 结论沉淀位置

已落实的**讨论结论**与架构边界见同目录 **`design.md`**。
