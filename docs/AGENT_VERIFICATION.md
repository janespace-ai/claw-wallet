# 通过 OpenClaw Agent 验证 claw-wallet

本文说明如何在你的 OpenClaw Agent 项目中接入 claw-wallet，并通过与 Agent 对话完成验证测试。

---

## 一、在 Agent 项目中接入 claw-wallet

### 1. 安装依赖

在 **OpenClaw Agent 所在项目** 目录下：

```bash
npm install claw-wallet
# 若本地开发，可改用: npm link /path/to/claw-wallet
```

### 2. 初始化并注册工具

在 Agent 启动流程中（例如主入口或 plugin 加载处）加入：

```typescript
import { ClawWallet } from "claw-wallet";

// 建议：验证时使用独立 dataDir，避免影响正式钱包
const wallet = new ClawWallet({
  dataDir: process.env.WALLET_DATA_DIR || "~/.openclaw/wallet",
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
  pollIntervalMs: 30_000,
});

await wallet.initialize();

// 取得 16 个工具并注册到 OpenClaw
const tools = wallet.getTools();
// 依你的 OpenClaw 版本，把 tools 注册到 agent，例如：
// agent.registerTools(tools);
// 或传入 OpenClaw 的 tool 配置格式
```

环境变量建议：

- `WALLET_PASSWORD`：钱包主密码（创建/解锁用）。
- `WALLET_DATA_DIR`（可选）：验证时可设成例如 `./test-wallet-data`，与正式数据分开。

### 3. 关闭时清理

Agent 关闭时调用：

```typescript
await wallet.shutdown();
```

---

## 二、通过「与 Agent 对话」做验证测试

以下用「你对 Agent 说的话」当作测试步骤，Agent 会调用对应的 claw-wallet 工具并回复结果。

### 阶段 1：创建钱包与查询

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 1 | 「用密码 `MyTestPassword123` 创建一个新钱包。」 | Agent 调用 `wallet_create`，返回新地址（0x...）。 |
| 2 | 「我当前的钱包地址是什么？」 | Agent 调用 `wallet_address`，返回同一个 0x 地址。 |
| 3 | 「在 Base 链上查一下我的 ETH 余额。」 | Agent 调用 `wallet_balance`，返回余额（新钱包应为 0）。 |
| 4 | 「在 Base 上查 USDC 余额。」 | 返回 USDC 余额（新钱包通常为 0）。 |

### 阶段 2：策略与审批

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 5 | 「目前的钱包安全策略是什么？」 | `wallet_policy_get`，返回单笔/每日限额、模式、白名单等。 |
| 6 | 「把策略改成 autonomous 模式，单笔限额 200 美元，每日 1000 美元。」 | `wallet_policy_set`，返回更新后的策略。 |
| 7 | 「现在有没有待审批的转账？」 | `wallet_approval_list`，新钱包应为空数组。 |

### 阶段 3：联系人与历史

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 8 | 「把联系人 Bob 加进去，Base 地址是 0x742d35Cc6634C0532925a3b844Bc454e4438f44e。」 | `wallet_contacts_add`，成功新增。 |
| 9 | 「列出所有联系人。」 | `wallet_contacts_list`，看到 Bob。 |
| 10 | 「查一下 Bob 在 Base 上的地址。」 | `wallet_contacts_resolve`，返回上述 0x 地址。 |
| 11 | 「最近 10 笔交易历史。」 | `wallet_history`，新钱包可为空或仅有说明。 |

### 阶段 4：Gas 估算（不发送）

| 步骤 | 你对 Agent 说（示例） | 预期 |
|------|------------------------|------|
| 12 | 「估算在 Base 上转 0.01 ETH 到 0x742d35Cc6634C0532925a3b844Bc454e4438f44e 的 gas 费。」 | `wallet_estimate_gas`，返回预估 gas 与约略成本。 |

### 阶段 5：实际转账（可选，需有测试资金）

若在 **Base 或 Ethereum 主网** 上有少量测试用 ETH，可做一次小额转账验证：

- 你：「在 Base 上转 0.001 ETH 到 0x742d35Cc6634C0532925a3b844Bc454e4438f44e。」
- 预期：若余额与策略允许，Agent 调用 `wallet_send`，返回交易 hash；否则返回余额不足或策略拒绝原因。

**注意：** 目前 claw-wallet 仅支持 Base 与 Ethereum 主网，不包含测试网。若要用主网验证，请只用极小金额。

---

## 三、验证清单（快速自检）

- [ ] Agent 启动时无报错，且已注册 claw-wallet 的 16 个工具。
- [ ] 能通过对话创建钱包并拿到地址。
- [ ] `wallet_address` / `wallet_balance` 与预期一致。
- [ ] `wallet_policy_get` / `wallet_policy_set` 行为正确。
- [ ] 联系人新增 / 列表 / 解析正常。
- [ ] `wallet_estimate_gas` 有合理返回。
- [ ] （可选）小额 `wallet_send` 成功并能在区块链浏览器查到。

---

## 四、常见问题

**Q: Agent 说「Wallet already exists」？**  
已存在钱包时无法再执行「创建」。可改用 `wallet_import`（提供私钥与密码）覆盖，或换一个 `dataDir`（例如 `./test-wallet-data`）从头测试。

**Q: 如何用独立目录做验证、不影响正式钱包？**  
启动 Agent 前设置环境变量，例如：

```bash
export WALLET_DATA_DIR="$PWD/test-wallet-data"
export WALLET_PASSWORD="YourTestPassword"
```

并在程序里用 `process.env.WALLET_DATA_DIR` 当作 `dataDir`。

**Q: 工具注册的具体 API？**  
OpenClaw 的 tool 注册方式可能因版本而异，请对照你使用的 OpenClaw 文档，把 `wallet.getTools()` 返回的数组（`name`、`description`、`parameters`、`execute`）注册到 agent 即可。

---

完成以上步骤后，即可视为「已通过 OpenClaw Agent 对 claw-wallet 做过验证测试」。
