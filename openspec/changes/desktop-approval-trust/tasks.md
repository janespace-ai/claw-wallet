# Tasks（粗粒度，实现时拆解）

- [x] **Desktop**：签名请求入口用 `PriceService` + 链上字段计算 `estimatedUsdForPolicy`；无价 → 禁止 `autoApprove`。
- [x] **Desktop**：调整 `SigningEngine.checkBudget`（或等价）仅消费上述估值；移除或降级对 Agent `amountUsd`/误导字段的依赖。
- [ ] **Agent**：重命名/整理发往 Desktop 的签名载荷字段；移除或迁移 `policy.whitelist` 与 `wallet_policy` 白名单写路径。
- [ ] **协议**：定义联系人/信任申请的 Relay 加密 method 与应答/错误码。
- [ ] **Desktop**：SQLite 表或迁移——信任地址、权威联系人；与 `allowance.json` 白名单合并策略。
- [ ] **Desktop UI**：审批弹窗「加入信任」勾选；**成功的链上回执后**再写入信任库；新 Tab 信任列表（删除）。
- [ ] **Agent 联系人工具**：改为经 Relay 请求 Desktop；本地 `contacts.json` 策略与同步（非权威）。
- [ ] **文档**：`AGENT_VERIFICATION` 等验证路径更新。
