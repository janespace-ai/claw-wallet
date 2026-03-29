# 通过 OpenClaw Agent 验证 claw-wallet（Phase 2）

本文说明如何搭建完整的三组件环境（Agent + Desktop Wallet + Go Relay Server），并通过与 Agent 对话完成验证测试。

> **注意**：本文档适用于 Phase 2 架构。私钥存储在 Electron 桌面钱包中，Agent 端零秘密。

---

## 一、搭建三组件环境

### 1. 启动 Go 中继服务器

```bash
cd server
go run cmd/relay/main.go
# 默认监听 :8765
```

或使用 Docker：

```bash
cd server
docker compose up -d
```

验证中继服务器已启动：

```bash
curl http://localhost:8765/health
# 预期返回: {"status":"ok"}
```

### 2. 启动 Electron 桌面钱包

```bash
cd desktop
npm install
npm run dev
```

桌面钱包启动后会自动连接中继服务器。

### 3. 配置并启动 Agent

在 Agent 项目目录下：

```bash
cd agent
npm install
```

环境变量配置：

```bash
export RELAY_URL="ws://localhost:8765/ws"  # 中继服务器地址
```

---

## 二、首次配对

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 在桌面钱包中创建新钱包（设置密码，备份助记词） | 钱包创建成功，显示钱包地址 |
| 2 | 在桌面钱包「配对」标签页点击「生成配对码」 | 显示 8 位配对码（10 分钟有效） |
| 3 | 在 Agent 中调用 `wallet_pair({ shortCode: "ABCD1234" })` | 配对成功，E2EE 会话建立 |
| 4 | 验证：调用 `wallet_address` | 返回桌面钱包中的地址 |

配对完成后，通信密钥对会持久化保存。重启 Agent 和桌面钱包后会自动重连，无需再次配对。

---

## 三、通过「与 Agent 对话」做验证测试

以下用「你对 Agent 说的话」当作测试步骤。Agent 会通过 E2EE 通道与桌面钱包通信，调用对应的工具并回复结果。

### 阶段 1：基本查询

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 1 | 「我当前的钱包地址是什么？」 | Agent 调用 `wallet_address`，返回 0x 地址 |
| 2 | 「在 Base 链上查一下我的 ETH 余额。」 | Agent 调用 `wallet_balance`，返回余额 |
| 3 | 「在 Base 上查 USDC 余额。」 | 返回 USDC 余额 |

### 阶段 2：策略与审批

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 4 | 「目前的钱包安全策略是什么？」 | `wallet_policy_get`，返回 Agent 侧限额与模式；**可信任收款方由桌面「联系人」表的 `可信任` 标记维护，不在此工具中** |
| 5 | 「把策略改成 autonomous 模式，单笔限额 200 美元，每日 1000 美元。」 | `wallet_policy_set`，返回更新后的策略（**不能**通过该工具改可信任联系人） |
| 6 | 「现在有没有待审批的转账？」 | `wallet_approval_list`，应为空数组 |

### 阶段 3：联系人与历史

联系人读写经 **Relay → 桌面主进程** 写入 `wallet.db`（权威）：**每名一行、每条为单链单地址**；Agent 本地 `contacts.json` 仅作缓存/离线回退，并与该语义对齐（同名更新会替换所保存链，不再跨链回落解析）。

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 7 | 「把联系人 Bob 加进去，Base 地址是 0x742d35Cc6634C0532925a3b844Bc454e4438f44e。」 | `wallet_contacts_add`，桌面弹出三选一（一般 / 可信任 / 拒绝），确认后落库；本地缓存同步 |
| 8 | 「列出所有联系人。」 | `wallet_contacts_list`，与桌面一致（若已配对且在线）；`source` 字段可为 `desktop` 或 `local_cache` |
| 9 | 「查一下 Bob 在 Base 上的地址。」 | `wallet_contacts_resolve`，优先桌面解析；若 Bob 保存在其他链则返回 `CHAIN_MISMATCH`（勿误用其他链地址） |
| 10 | 「最近 10 笔交易历史。」 | `wallet_history`，新钱包可为空 |

### 阶段 4：Gas 估算

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 11 | 「估算在 Base 上转 0.01 ETH 到 0x742d35Cc...的 gas 费。」 | `wallet_estimate_gas`，返回预估 gas |

### 阶段 5：实际转账（可选，需有测试资金）

- 你：「在 Base 上转 0.001 ETH 到 0x742d35Cc...」
- 预期：
  - Agent 通过 E2EE 发送签名请求到桌面钱包
  - 桌面钱包检查策略 → 签名 → 广播
  - Agent 在广播后调用 `wallet_notify_tx_result`（携带签名时的 `requestId`）通知链上成败；若在审批弹窗勾选「可信任」并填写名称，**仅当回执成功**后桌面 upsert 可信任联系人，并在回包可选字段 `newContact` 中返回供 Agent 同步本地缓存
  - 返回交易 hash

### 阶段 6：自动重连验证

| 步骤 | 操作 | 预期 |
|------|------|------|
| 12 | 重启 Agent 进程 | Agent 加载持久化密钥对，自动重连中继服务器 |
| 13 | 调用 `wallet_address` | 正常返回地址（证明 E2EE 会话已恢复） |
| 14 | 重启桌面钱包 | 桌面加载并解密密钥对，自动重连 |
| 15 | 再次调用 `wallet_balance` | 正常返回余额 |

### 阶段 7：安全特性验证（可选）

| 步骤 | 操作 | 预期 |
|------|------|------|
| 16 | 手动修改 Agent 的 comm key pair 文件 | 桌面钱包检测到公钥不匹配，发出 `key_mismatch` 告警 |
| 17 | 调用 `wallet_repair` 重新配对 | 清除旧配对数据，Agent 提示需要新的配对码 |
| 18 | 重新配对后调用 `wallet_address` | 正常返回地址，确认重配对成功 |

---

## 四、验证清单（快速自检）

- [ ] 中继服务器启动正常，`/health` 返回 OK
- [ ] 桌面钱包启动正常，已连接中继服务器
- [ ] 首次配对成功，Agent 能获取钱包地址
- [ ] `wallet_balance` / `wallet_estimate_gas` 正常返回
- [ ] `wallet_policy_get` / `wallet_policy_set` 行为正确（信任地址在桌面 **Trusted** 标签 / 审批勾选 + 链上成功，而非 Agent 策略工具）
- [ ] 联系人增删查改经 Relay 与桌面一致，本地缓存可回退
- [ ] （可选）桌面 **Trusted** 列表展示与删除正常
- [ ] 重启 Agent 后自动重连成功
- [ ] 重启桌面钱包后自动重连成功
- [ ] （可选）小额 `wallet_send` 成功
- [ ] （可选）`wallet_repair` 重配对流程正常

---

## 五、常见问题

**Q: Agent 报 "Wallet app offline"？**
确保中继服务器和桌面钱包都在运行。检查 Agent 的 `RELAY_URL` 环境变量是否正确。

**Q: 配对码过期了？**
配对码有效期为 10 分钟。在桌面钱包中重新生成即可。

**Q: 重启后无法自动重连？**
检查 Agent 端的 comm key pair 文件是否存在且未损坏。如果文件丢失或损坏，使用 `wallet_repair` 重新配对。

**Q: 签名请求被拒绝，提示 "Session frozen"？**
桌面钱包检测到身份不匹配（公钥或设备指纹变更），已冻结该会话。需要在桌面钱包中点击「重新配对设备」，然后在 Agent 端调用 `wallet_repair` 重新配对。

**Q: 中继服务器返回 4003 或 4029 错误码？**
- 4003: IP 数量超限——同一个 pairId 同时连接的不同 IP 超过 2 个
- 4029: 连接速率超限——等待 1 分钟后重试

---

完成以上步骤后，即可视为「已通过三组件环境对 claw-wallet Phase 2 做过完整验证测试」。
