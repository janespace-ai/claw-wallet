<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">簡體中文</a> | <b>繁體中文</b> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**讓你的 AI Agent 安全地擁有一個真正的錢包。**

[OpenClaw](https://getclaw.sh) AI Agent 框架的 Web3 錢包插件。一個本地自托管、非托管的加密錢包，讓 AI Agent 能夠管理資產、發送交易、與 EVM 區塊鏈交互——同時確保私鑰加密存儲，完全與 LLM 隔離。

> 私鑰絕不會接觸 AI 模型。Agent 通過 Tool API 操作，只會返回地址和交易哈希。

---

## 為什么選擇 claw-wallet？

當 AI Agent 需要在鏈上操作（交易、支付、DeFi 策略）時，面临一個根本矛盾：**模型需要執行操作，但绝不能看到私鑰**。claw-wallet 通過清晰的分層設计解决這個問题：

```
┌─────────────────────────────────────────────────────────────┐
│                     你的 AI Agent (LLM)                      │
│                                                             │
│  "在 Base 上發送 10 USDC 给 Alice"                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool APIs   │───▶│  策略引擎     │───▶│  密鑰庫       │    │
│  │ (16 個工具) │    │ (限額和審批) │    │ (AES-256-GCM │    │
│  │             │    │              │    │  + scrypt)   │    │
│  └─────────────┘    └──────────────┘    └──────┬───────┘    │
│                                                │            │
│                                           簽名并廣播         │
│                                                │            │
│                                         ┌──────▼───────┐    │
│                                         │  EVM 鏈      │    │
│                                         │  Base / ETH  │    │
│                                         └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**LLM 能看到的：** 錢包地址、余額、交易哈希、策略状态。
**LLM 看不到的：** 私鑰、助记词、解密后的密鑰材料。

---

## 功能特性

- **非托管 & 本地運行** — 密鑰加密存储在你的機器上，零云端依赖。
- **Keystore V3 加密** — AES-256-GCM + scrypt KDF，與以太坊客戶端使用相同標准。
- **策略引擎** — 單筆和每日消费限額、地址白名單、人工審批隊列。即使 Agent 被提示詞注入攻击，策略引擎也會阻止未授權的交易。
- **多鏈 EVM** — 支持 Base（默認，低 Gas）和以太坊主网。可扩展至任何 EVM 鏈。
- **双運行模式** — 監督模式（人工審批）或自主模式（在限額内自動執行）。
- **Agent 通訊錄** — P2P 地址簿。Agent 之間交换地址，按名称自動解析。
- **余額監控** — 后台轮詢检測入账轉账，實時通知。
- **交易歷史** — 本地緩存所有發送/接收的交易记錄。
- **16 個 OpenClaw 工具** — 即插即用的工具定义，無缝接入 AI Agent。

---

## 使用场景

### 场景一：人 → Agent → 合约 / 機構

你指揮 Agent 向商家付款、铸造 NFT 或與 DeFi 协议交互。

```
 你（對话）                    你的 Agent                       鏈上
─────────────────────────────────────────────────────────────────────────────
 "在以太坊上向               wallet_contacts_resolve            Uniswap
  Uniswap 国庫付             → 0x1a9C...                       国庫合约
  50 USDC"                                                       │
                               wallet_send                         │
                                 to: 0x1a9C...                     │
                                 amount: 50                        │
                                 token: USDC                       │
                                 chain: ethereum                   │
                                        │                          │
                               策略引擎检查：                       │
                                 ✓ $50 < $100 單筆限額             │
                                 ✓ 每日總額在 $500 内              │
                                 ✓ 0x1a9C 在白名單中               │
                                        │                          │
                               簽名 → 廣播 ────────────────────────▶│
                                        │                          │
                               返回: tx hash 0xab3f...        ✓ 已確認
```

**典型用途：** SaaS 订阅付款、鏈上服務购买、DeFi 协议交互、交易所充值。地址白名單確保 Agent 只能向預先批准的合约地址轉账。

### 场景二：人 → Agent → 另一個 Agent

你指揮你的 Agent 向另一個 AI Agent 付费獲取服務——Agent 之間通過通訊錄系統自動解析地址。

```
 你（對话）              你的 Agent                   Bob 的 Agent
──────────────────────────────────────────────────────────────────
 "在 Base 上發送       wallet_contacts_add
  10 USDC 给            name: "bob-agent"
  Bob 的 Agent"         base: 0x742d...
                                │
                         wallet_send
                           to: "bob-agent"     ◄── 從通訊錄解析
                           amount: 10
                           token: USDC
                           chain: base
                                │
                         策略 ✓ → 簽名 → 廣播 ──────────▶ 0x742d...
                                │                              │
                         tx: 0xef01...                    Bob 的監控器
                                                          检測到 +10 USDC
                                                          通知 Bob 的 Agent
```

**典型用途：** Agent 間的 API 調用付费、數據购买、协作任務奖励。通訊錄讓 Agent 間的周期性支付像使用名字一樣簡單——無需每次粘贴地址。

### 场景三：Agent 自主操作

Agent 獨立運行——在策略限額内自主執行交易、购买服務或調整投资组合。單筆交易無需人工介入。

```
 Agent（自主模式）                                        鏈上
──────────────────────────────────────────────────────────────────
 检測到: ETH 价格下跌 5%
 決策: 買入機會

 wallet_balance → 500 USDC 可用
 wallet_estimate_gas → 0.0001 ETH

 wallet_send
   to: 0xDEX_ROUTER         (已在白名單)
   amount: 200
   token: USDC
   chain: base
         │
 策略引擎:
   ✓ $200 > $100 單筆限額  ← 被阻止
   → 排入審批隊列 (id: a3f8...)

 ─── 方案 A: 提高限額 ───
 wallet_policy_set
   perTransactionLimitUsd: 300
   mode: "autonomous"

 重新發送 → 策略 ✓ → 簽名 → 廣播 → 已確認

 ─── 方案 B: 人工審批 ───
 wallet_approval_approve("a3f8...")
 → 簽名 → 廣播 → 已確認
```

**典型用途：** DeFi 挖矿、自動交易策略、定期订阅付费、投资组合再平衡。策略引擎作為**安全護栏**——即使完全自主的 Agent 也在可配置的消费边界内運行。

### 模式對比

| | 監督模式 | 自主模式 |
|---|---|---|
| **決策者** | 每筆非白名單交易需人工審批 | Agent 在限額内自主決策 |
| **白名單要求** | 是——非白名單地址被阻止 | 否——限額内任何地址均可 |
| **消费限額** | 單筆 + 每日限額强制執行 | 單筆 + 每日限額强制執行 |
| **适用场景** | 高价值錢包、初期建立信任 | 日常操作、交易機器人 |
| **超限处理** | 排入隊列 → 人工審批/拒絕 | 排入隊列 → 人工審批/拒絕 |

---

## 快速開始

### 安装

```bash
npm install claw-wallet
```

### 基本用法

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();

// 註冊全部 16 個工具到你的 OpenClaw Agent
const tools = wallet.getTools();

// ... Agent 運行，使用工具發送/接收/管理 ...

// 优雅關闭：保存歷史、通訊錄、策略到磁盘
await wallet.shutdown();
```

---

## 工作原理

### 交易流程

從 Agent 發起意图到鏈上確認的完整流程：

```
  Agent 說: "在 Base 上發送 0.5 ETH 给 Bob"
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. 输入驗證                        │  地址格式、金額范围、
  │     validateAddress / validateAmount │  鏈白名單、代币符号
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. 收款方解析                      │  "Bob" → 通訊錄查找
  │     聯系人名称或 0x 地址            │  → 0x742d...4a (Base 鏈)
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  3. 余額检查                        │  ETH 余額 ≥ 金額 + Gas？
  │     getBalance + estimateGas        │  ERC-20: 代币余額 + ETH Gas 费
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  4. 策略检查                        │  ✓ 單筆限額内 ($100)？
  │     PolicyEngine.checkTransaction   │  ✓ 每日限額内 ($500)？
  │                                     │  ✓ 地址在白名單中（監督模式）？
  │                                     │
  │     被阻止？→ 排入審批隊列          │  → 返回審批 ID
  │     通過？→ 继续 ↓                  │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  5. 簽名交易                        │  解密密鑰 (scrypt + AES-256-GCM)
  │     密鑰庫 → 解密 → 簽名            │  使用 viem 簽名
  │     → 立即清零密鑰緩衝區            │  在 finally{} 中清零
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  6. 廣播并確認                      │  發送原始交易到 RPC
  │     broadcastTransaction            │  等待回執
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  7. 记錄并返回                      │  保存到本地歷史
  │     TransactionHistory.addRecord    │  返回: { hash, status, gasUsed }
  └─────────────────────────────────────┘
```

### 審批流程（監督模式）

當交易超出限額或目標地址不在白名單中：

```
  Agent → wallet_send → 策略阻止 → 返回審批 ID
                                        │
              ┌─────────────────────────┘
              ▼
  人工審核:  wallet_approval_list  →  查看待審批交易详情
             wallet_approval_approve(id)  →  交易執行
             wallet_approval_reject(id)   →  交易取消
             （24 小時無操作自動過期）
```

---

## 可用工具

claw-wallet 提供 16 個 Agent 可調用的工具：

| 工具 | 描述 |
|------|------|
| **錢包管理** | |
| `wallet_create` | 创建新錢包，生成加密密鑰庫 |
| `wallet_import` | 通過私鑰導入已有錢包 |
| `wallet_address` | 獲取當前錢包地址（無需解密） |
| **余額 & Gas** | |
| `wallet_balance` | 查詢 ETH 或 ERC-20 代币余額 |
| `wallet_estimate_gas` | 估算交易 Gas 费用 |
| **交易** | |
| `wallet_send` | 發送 ETH 或 ERC-20 代币（支持聯系人名称） |
| `wallet_history` | 查詢分页交易歷史 |
| **通訊錄** | |
| `wallet_contacts_add` | 添加或更新聯系人（支持多鏈地址） |
| `wallet_contacts_list` | 列出所有聯系人 |
| `wallet_contacts_resolve` | 按名称查找聯系人地址 |
| `wallet_contacts_remove` | 刪除聯系人 |
| **策略 & 審批** | |
| `wallet_policy_get` | 查看當前安全策略 |
| `wallet_policy_set` | 更新消费限額、白名單或模式 |
| `wallet_approval_list` | 列出待審批交易 |
| `wallet_approval_approve` | 批准排隊中的交易 |
| `wallet_approval_reject` | 拒絕排隊中的交易 |

---

## 安全模型

claw-wallet 采用**纵深防御**策略——多個獨立的安全層確保没有單一故障点能導致密鑰泄露或未授權轉账。

### 1. 密鑰隔离 — 密鑰绝不接觸 LLM

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │   claw-wallet      │
│                    │ 地址、交易哈希     │                    │
│  無法访問:         │                   │  私鑰僅在           │
│  - 私鑰            │                   │  signTransaction() │
│  - 密鑰庫文件      │                   │  内部解密           │
│  - 密码            │                   │  之后立即清零       │
└────────────────────┘                   └────────────────────┘
```

Agent 僅通過 Tool API 交互。没有任何工具會返回密鑰材料。即使是 `wallet_create` 也只返回地址。

### 2. 静态加密 — Keystore V3

| 组件 | 详情 |
|------|------|
| **加密算法** | AES-256-GCM（認證加密） |
| **密鑰派生** | scrypt (N=131072, r=8, p=1) |
| **盐值** | 每次加密 32 字節随机生成 |
| **初始向量** | 每次加密 16 字節随机生成 |
| **認證標签** | GCM 標签防止密文篡改 |
| **文件權限** | 0600（僅所有者可讀寫） |

私鑰通過 scrypt 密鑰派生和 AES-256-GCM 加密。每次加密生成全新的随机盐值和 IV，因此相同的密鑰 + 密码每次產生不同的密文。

### 3. 内存安全

- 私鑰僅在 `signTransaction()` / `signMessage()` 執行期間解密。
- 密鑰緩衝區在 `finally` 塊中通過 `Buffer.fill(0)` 清零——即使簽名抛出异常。
- 解密后的密鑰材料在内存中僅存在毫秒级時間。

### 4. 策略引擎 — 獨立的消费控制

策略引擎在任何簽名操作**之前**運行，無法通過提示詞注入繞過：

| 控制项 | 默認值 | 描述 |
|--------|--------|------|
| 單筆限額 | $100 | 單筆交易最大金額 |
| 每日限額 | $500 | 滚动 24 小時累计消费上限 |
| 地址白名單 | 空 | 監督模式下必须 |
| 運行模式 | 監督模式 | `supervised`（需白名單）或 `autonomous`（僅限額） |
| 審批隊列 | 24 小時過期 | 被阻止的交易排隊等待人工審核 |

**防繞過措施：**
- 所有美元金額使用**整數分運算**（乘以 100，四舍五入），防止浮点精度攻击（如多筆 $0.51 交易利用舍入誤差）。
- 白名單匹配**不區分大小寫**，防止混合大小寫地址繞過。
- 審批 ID 使用**加密随机數**（8 字節十六進制）——非連續、不可猜測。

### 5. 输入驗證 — 每個边界都有守卫

| 输入项 | 驗證规則 |
|--------|---------|
| 地址 | 十六進制格式、长度=42、EIP-55 校驗和 |
| 金額 | 拒絕 NaN、Infinity、负數、零、空值 |
| 鏈 | 严格白名單 (`base`, `ethereum`) |
| 代币符号 | 最多 20 字元，拒絕 `<>"'\`/\` 注入字元 |
| 聯系人名称 | 最多 100 字元，拒絕路径遍歷 (`..`, `/`, `\`) |
| Keystore JSON | 完整 V3 结构 + KDF 參數边界 (n ≤ 2²⁰) |

### 6. 文件系統安全

- **原子寫入**：先寫临時文件 → 重命名（防止崩溃時數據损坏）。
- **0600 權限**：僅所有者可讀寫密鑰庫、通訊錄、歷史、策略文件。
- **路径遍歷防護**：`sanitizePath()` 解析并拒絕數據目錄外的路径。

### 7. RPC 安全

- **负余額钳位**：将 RPC 返回的负余額視為 0。
- **Gas 合理性检查**：拒絕 0 Gas 和 > 3000 万 Gas 的估算。
- **無密鑰泄露**：錯誤信息中绝不包含私鑰或密码。

---

## 配置

```typescript
const wallet = new ClawWallet({
  // 數據目錄（默認: ~/.openclaw/wallet）
  dataDir: "~/.openclaw/wallet",

  // 默認鏈（默認: "base"）
  defaultChain: "base",

  // 自定义 RPC 节点（可選）
  chains: {
    base: { rpcUrl: "https://your-base-rpc.com" },
    ethereum: { rpcUrl: "https://your-eth-rpc.com" },
  },

  // 主密码（或通過 wallet.setPassword() 設置）
  password: process.env.WALLET_PASSWORD,

  // 余額監控轮詢間隔（默認: 30 秒）
  pollIntervalMs: 30_000,

  // 入账轉账通知回調
  onBalanceChange: (event) => {
    console.log(`${event.direction}: ${event.difference} ${event.token} on ${event.chain}`);
  },
});
```

---

## 數據存储

所有數據存储在本地（绝不發送到云端）：

```
~/.openclaw/wallet/
├── keystore.json    # 加密的私鑰 (Keystore V3, chmod 0600)
├── contacts.json    # Agent 通訊錄
├── history.json     # 交易歷史緩存
└── policy.json      # 安全策略與審批隊列
```

---

## 支持的鏈和代币

| 鏈 | Chain ID | 默認 RPC | 内置代币 |
|----|----------|----------|----------|
| Base | 8453 | 公共 Base RPC | USDC, USDT |
| Ethereum | 1 | 公共 Ethereum RPC | USDC, USDT |

可以通過傳入合约地址使用任何 ERC-20 代币。鏈可扩展——通過配置添加任何 EVM 兼容鏈。

---

## 架構

```
src/
├── index.ts          ClawWallet 类 — 編排所有子系統
├── types.ts          共享 TypeScript 类型和接口
├── keystore.ts       密鑰生成、加解密 (AES-256-GCM + scrypt)、簽名
├── chain.ts          多鏈區塊鏈适配器 (viem PublicClient)
├── transfer.ts       交易构建: 驗證 → 策略 → 簽名 → 廣播
├── policy.ts         消费限額、白名單、審批隊列、整數分運算
├── contacts.ts       支持多鏈解析的命名地址簿
├── history.ts        本地交易歷史（支持 BigInt 序列化）
├── monitor.ts        后台余額轮詢和变动检測
├── validation.ts     输入清洗、安全文件 I/O、路径遍歷防護
└── tools/            16 個 OpenClaw 工具定义
    ├── wallet-create.ts
    ├── wallet-import.ts
    ├── wallet-balance.ts       (余額 + 地址 + Gas 估算)
    ├── wallet-send.ts
    ├── wallet-contacts.ts      (列表 + 添加 + 解析 + 刪除)
    ├── wallet-policy.ts        (查看 + 設置)
    ├── wallet-approval.ts      (列表 + 批准 + 拒絕)
    └── wallet-history.ts
```

**依赖理念：** 极簡。僅使用 [viem](https://viem.sh) 進行區塊鏈交互。所有加密功能使用 Node.js 内置的 `node:crypto`（scrypt、AES-256-GCM、randomBytes）——不引入第三方加密庫。

---

## 開發

```bash
# 安装依赖
npm install

# 運行測試
npm test

# 类型检查
npm run typecheck

# 构建 (输出 ESM + CJS + .d.ts)
npm run build

# 監听模式開發
npm run dev
```

### 測試套件

项目包含全面的功能和安全測試：

| 分类 | 測試内容 |
|------|---------|
| **密鑰庫** | 密鑰生成、加解密、錯誤密码、V3 结构、持久化 |
| **鏈** | 客戶端创建、緩存、Chain ID、ERC-20 calldata 編码 |
| **通訊錄** | CRUD 操作、多鏈解析、大小寫不敏感查找、持久化 |
| **歷史** | 记錄管理、分页、BigInt 序列化 |
| **策略** | 限額、白名單、模式、審批流程、持久化 |
| **端到端** | 從錢包创建到全部 16 個工具的完整生命周期 |
| **安全: 密鑰庫** | 密鑰熵、随机 IV/盐值、篡改检測、内存清零、KDF DoS 防護、暴力破解抗性 (≥100ms 解密) |
| **安全: 输入** | 地址/金額/代币/聯系人注入、恶意 Keystore Schema |
| **安全: 策略** | 浮点精度攻击、整數分精確度、審批 ID 唯一性、并發每日總額 |
| **安全: 文件** | 文件權限 (0600)、路径遍歷防護、原子寫入 |
| **安全: RPC** | 余額驗證、Gas 范围检查、錯誤中無密鑰泄露 |

---

## 环境要求

- Node.js ≥ 18
- OpenClaw 兼容的 AI Agent 框架（或任何支持 Tool 定义的框架）

---

## 许可證

MIT
