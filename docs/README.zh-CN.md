<p align="center">
  <a href="../README.md">English</a> | <b>简体中文</b> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**让你的 AI Agent 安全地拥有一个真正的钱包。**

[OpenClaw](https://getclaw.sh) AI Agent 框架的 Web3 钱包插件。一个本地自托管、非托管的加密钱包，让 AI Agent 能够管理资产、发送交易、与 EVM 区块链交互——同时确保私钥加密存储，完全与 LLM 隔离。

> 私钥绝不会接触 AI 模型。Agent 通过 Tool API 操作，只会返回地址和交易哈希。

---

## 为什么选择 claw-wallet？

当 AI Agent 需要在链上操作（交易、支付、DeFi 策略）时，面临一个根本矛盾：**模型需要执行操作，但绝不能看到私钥**。claw-wallet 通过清晰的分层设计解决这个问题：

```
┌─────────────────────────────────────────────────────────────┐
│                     你的 AI Agent (LLM)                      │
│                                                             │
│  "在 Base 上发送 10 USDC 给 Alice"                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool APIs   │───▶│  策略引擎     │───▶│  密钥库       │    │
│  │ (16 个工具) │    │ (限额和审批) │    │ (AES-256-GCM │    │
│  │             │    │              │    │  + scrypt)   │    │
│  └─────────────┘    └──────────────┘    └──────┬───────┘    │
│                                                │            │
│                                           签名并广播         │
│                                                │            │
│                                         ┌──────▼───────┐    │
│                                         │  EVM 链      │    │
│                                         │  Base / ETH  │    │
│                                         └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**LLM 能看到的：** 钱包地址、余额、交易哈希、策略状态。
**LLM 看不到的：** 私钥、助记词、解密后的密钥材料。

---

## 功能特性

- **非托管 & 本地运行** — 密钥加密存储在你的机器上，零云端依赖。
- **Keystore V3 加密** — AES-256-GCM + scrypt KDF，与以太坊客户端使用相同标准。
- **策略引擎** — 单笔和每日消费限额、地址白名单、人工审批队列。即使 Agent 被提示词注入攻击，策略引擎也会阻止未授权的交易。
- **多链 EVM** — 支持 Base（默认，低 Gas）和以太坊主网。可扩展至任何 EVM 链。
- **双运行模式** — 监督模式（人工审批）或自主模式（在限额内自动执行）。
- **Agent 通讯录** — P2P 地址簿。Agent 之间交换地址，按名称自动解析。
- **余额监控** — 后台轮询检测入账转账，实时通知。
- **交易历史** — 本地缓存所有发送/接收的交易记录。
- **16 个 OpenClaw 工具** — 即插即用的工具定义，无缝接入 AI Agent。

---

## 使用场景

### 场景一：人 → Agent → 合约 / 机构

你指挥 Agent 向商家付款、铸造 NFT 或与 DeFi 协议交互。

```
 你（对话）                    你的 Agent                       链上
─────────────────────────────────────────────────────────────────────────────
 "在以太坊上向               wallet_contacts_resolve            Uniswap
  Uniswap 国库付             → 0x1a9C...                       国库合约
  50 USDC"                                                       │
                               wallet_send                         │
                                 to: 0x1a9C...                     │
                                 amount: 50                        │
                                 token: USDC                       │
                                 chain: ethereum                   │
                                        │                          │
                               策略引擎检查：                       │
                                 ✓ $50 < $100 单笔限额             │
                                 ✓ 每日总额在 $500 内              │
                                 ✓ 0x1a9C 在白名单中               │
                                        │                          │
                               签名 → 广播 ────────────────────────▶│
                                        │                          │
                               返回: tx hash 0xab3f...        ✓ 已确认
```

**典型用途：** SaaS 订阅付款、链上服务购买、DeFi 协议交互、交易所充值。地址白名单确保 Agent 只能向预先批准的合约地址转账。

### 场景二：人 → Agent → 另一个 Agent

你指挥你的 Agent 向另一个 AI Agent 付费获取服务——Agent 之间通过通讯录系统自动解析地址。

```
 你（对话）              你的 Agent                   Bob 的 Agent
──────────────────────────────────────────────────────────────────
 "在 Base 上发送       wallet_contacts_add
  10 USDC 给            name: "bob-agent"
  Bob 的 Agent"         base: 0x742d...
                                │
                         wallet_send
                           to: "bob-agent"     ◄── 从通讯录解析
                           amount: 10
                           token: USDC
                           chain: base
                                │
                         策略 ✓ → 签名 → 广播 ──────────▶ 0x742d...
                                │                              │
                         tx: 0xef01...                    Bob 的监控器
                                                          检测到 +10 USDC
                                                          通知 Bob 的 Agent
```

**典型用途：** Agent 间的 API 调用付费、数据购买、协作任务奖励。通讯录让 Agent 间的周期性支付像使用名字一样简单——无需每次粘贴地址。

### 场景三：Agent 自主操作

Agent 独立运行——在策略限额内自主执行交易、购买服务或调整投资组合。单笔交易无需人工介入。

```
 Agent（自主模式）                                        链上
──────────────────────────────────────────────────────────────────
 检测到: ETH 价格下跌 5%
 决策: 买入机会

 wallet_balance → 500 USDC 可用
 wallet_estimate_gas → 0.0001 ETH

 wallet_send
   to: 0xDEX_ROUTER         (已在白名单)
   amount: 200
   token: USDC
   chain: base
         │
 策略引擎:
   ✓ $200 > $100 单笔限额  ← 被阻止
   → 排入审批队列 (id: a3f8...)

 ─── 方案 A: 提高限额 ───
 wallet_policy_set
   perTransactionLimitUsd: 300
   mode: "autonomous"

 重新发送 → 策略 ✓ → 签名 → 广播 → 已确认

 ─── 方案 B: 人工审批 ───
 wallet_approval_approve("a3f8...")
 → 签名 → 广播 → 已确认
```

**典型用途：** DeFi 挖矿、自动交易策略、定期订阅付费、投资组合再平衡。策略引擎作为**安全护栏**——即使完全自主的 Agent 也在可配置的消费边界内运行。

### 模式对比

| | 监督模式 | 自主模式 |
|---|---|---|
| **决策者** | 每笔非白名单交易需人工审批 | Agent 在限额内自主决策 |
| **白名单要求** | 是——非白名单地址被阻止 | 否——限额内任何地址均可 |
| **消费限额** | 单笔 + 每日限额强制执行 | 单笔 + 每日限额强制执行 |
| **适用场景** | 高价值钱包、初期建立信任 | 日常操作、交易机器人 |
| **超限处理** | 排入队列 → 人工审批/拒绝 | 排入队列 → 人工审批/拒绝 |

---

## 快速开始

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

// 注册全部 16 个工具到你的 OpenClaw Agent
const tools = wallet.getTools();

// ... Agent 运行，使用工具发送/接收/管理 ...

// 优雅关闭：保存历史、通讯录、策略到磁盘
await wallet.shutdown();
```

---

## 工作原理

### 交易流程

从 Agent 发起意图到链上确认的完整流程：

```
  Agent 说: "在 Base 上发送 0.5 ETH 给 Bob"
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. 输入验证                        │  地址格式、金额范围、
  │     validateAddress / validateAmount │  链白名单、代币符号
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. 收款方解析                      │  "Bob" → 通讯录查找
  │     联系人名称或 0x 地址            │  → 0x742d...4a (Base 链)
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  3. 余额检查                        │  ETH 余额 ≥ 金额 + Gas？
  │     getBalance + estimateGas        │  ERC-20: 代币余额 + ETH Gas 费
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  4. 策略检查                        │  ✓ 单笔限额内 ($100)？
  │     PolicyEngine.checkTransaction   │  ✓ 每日限额内 ($500)？
  │                                     │  ✓ 地址在白名单中（监督模式）？
  │                                     │
  │     被阻止？→ 排入审批队列          │  → 返回审批 ID
  │     通过？→ 继续 ↓                  │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  5. 签名交易                        │  解密密钥 (scrypt + AES-256-GCM)
  │     密钥库 → 解密 → 签名            │  使用 viem 签名
  │     → 立即清零密钥缓冲区            │  在 finally{} 中清零
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  6. 广播并确认                      │  发送原始交易到 RPC
  │     broadcastTransaction            │  等待回执
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  7. 记录并返回                      │  保存到本地历史
  │     TransactionHistory.addRecord    │  返回: { hash, status, gasUsed }
  └─────────────────────────────────────┘
```

### 审批流程（监督模式）

当交易超出限额或目标地址不在白名单中：

```
  Agent → wallet_send → 策略阻止 → 返回审批 ID
                                        │
              ┌─────────────────────────┘
              ▼
  人工审核:  wallet_approval_list  →  查看待审批交易详情
             wallet_approval_approve(id)  →  交易执行
             wallet_approval_reject(id)   →  交易取消
             （24 小时无操作自动过期）
```

---

## 可用工具

claw-wallet 提供 16 个 Agent 可调用的工具：

| 工具 | 描述 |
|------|------|
| **钱包管理** | |
| `wallet_create` | 创建新钱包，生成加密密钥库 |
| `wallet_import` | 通过私钥导入已有钱包 |
| `wallet_address` | 获取当前钱包地址（无需解密） |
| **余额 & Gas** | |
| `wallet_balance` | 查询 ETH 或 ERC-20 代币余额 |
| `wallet_estimate_gas` | 估算交易 Gas 费用 |
| **交易** | |
| `wallet_send` | 发送 ETH 或 ERC-20 代币（支持联系人名称） |
| `wallet_history` | 查询分页交易历史 |
| **通讯录** | |
| `wallet_contacts_add` | 添加或更新联系人（支持多链地址） |
| `wallet_contacts_list` | 列出所有联系人 |
| `wallet_contacts_resolve` | 按名称查找联系人地址 |
| `wallet_contacts_remove` | 删除联系人 |
| **策略 & 审批** | |
| `wallet_policy_get` | 查看当前安全策略 |
| `wallet_policy_set` | 更新消费限额、白名单或模式 |
| `wallet_approval_list` | 列出待审批交易 |
| `wallet_approval_approve` | 批准排队中的交易 |
| `wallet_approval_reject` | 拒绝排队中的交易 |

---

## 安全模型

claw-wallet 采用**纵深防御**策略——多个独立的安全层确保没有单一故障点能导致密钥泄露或未授权转账。

### 1. 密钥隔离 — 密钥绝不接触 LLM

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │   claw-wallet      │
│                    │ 地址、交易哈希     │                    │
│  无法访问:         │                   │  私钥仅在           │
│  - 私钥            │                   │  signTransaction() │
│  - 密钥库文件      │                   │  内部解密           │
│  - 密码            │                   │  之后立即清零       │
└────────────────────┘                   └────────────────────┘
```

Agent 仅通过 Tool API 交互。没有任何工具会返回密钥材料。即使是 `wallet_create` 也只返回地址。

### 2. 静态加密 — Keystore V3

| 组件 | 详情 |
|------|------|
| **加密算法** | AES-256-GCM（认证加密） |
| **密钥派生** | scrypt (N=131072, r=8, p=1) |
| **盐值** | 每次加密 32 字节随机生成 |
| **初始向量** | 每次加密 16 字节随机生成 |
| **认证标签** | GCM 标签防止密文篡改 |
| **文件权限** | 0600（仅所有者可读写） |

私钥通过 scrypt 密钥派生和 AES-256-GCM 加密。每次加密生成全新的随机盐值和 IV，因此相同的密钥 + 密码每次产生不同的密文。

### 3. 内存安全

- 私钥仅在 `signTransaction()` / `signMessage()` 执行期间解密。
- 密钥缓冲区在 `finally` 块中通过 `Buffer.fill(0)` 清零——即使签名抛出异常。
- 解密后的密钥材料在内存中仅存在毫秒级时间。

### 4. 策略引擎 — 独立的消费控制

策略引擎在任何签名操作**之前**运行，无法通过提示词注入绕过：

| 控制项 | 默认值 | 描述 |
|--------|--------|------|
| 单笔限额 | $100 | 单笔交易最大金额 |
| 每日限额 | $500 | 滚动 24 小时累计消费上限 |
| 地址白名单 | 空 | 监督模式下必须 |
| 运行模式 | 监督模式 | `supervised`（需白名单）或 `autonomous`（仅限额） |
| 审批队列 | 24 小时过期 | 被阻止的交易排队等待人工审核 |

**防绕过措施：**
- 所有美元金额使用**整数分运算**（乘以 100，四舍五入），防止浮点精度攻击（如多笔 $0.51 交易利用舍入误差）。
- 白名单匹配**不区分大小写**，防止混合大小写地址绕过。
- 审批 ID 使用**加密随机数**（8 字节十六进制）——非连续、不可猜测。

### 5. 输入验证 — 每个边界都有守卫

| 输入项 | 验证规则 |
|--------|---------|
| 地址 | 十六进制格式、长度=42、EIP-55 校验和 |
| 金额 | 拒绝 NaN、Infinity、负数、零、空值 |
| 链 | 严格白名单 (`base`, `ethereum`) |
| 代币符号 | 最多 20 字符，拒绝 `<>"'\`/\` 注入字符 |
| 联系人名称 | 最多 100 字符，拒绝路径遍历 (`..`, `/`, `\`) |
| Keystore JSON | 完整 V3 结构 + KDF 参数边界 (n ≤ 2²⁰) |

### 6. 文件系统安全

- **原子写入**：先写临时文件 → 重命名（防止崩溃时数据损坏）。
- **0600 权限**：仅所有者可读写密钥库、通讯录、历史、策略文件。
- **路径遍历防护**：`sanitizePath()` 解析并拒绝数据目录外的路径。

### 7. RPC 安全

- **负余额钳位**：将 RPC 返回的负余额视为 0。
- **Gas 合理性检查**：拒绝 0 Gas 和 > 3000 万 Gas 的估算。
- **无密钥泄露**：错误信息中绝不包含私钥或密码。

---

## 配置

```typescript
const wallet = new ClawWallet({
  // 数据目录（默认: ~/.openclaw/wallet）
  dataDir: "~/.openclaw/wallet",

  // 默认链（默认: "base"）
  defaultChain: "base",

  // 自定义 RPC 节点（可选）
  chains: {
    base: { rpcUrl: "https://your-base-rpc.com" },
    ethereum: { rpcUrl: "https://your-eth-rpc.com" },
  },

  // 主密码（或通过 wallet.setPassword() 设置）
  password: process.env.WALLET_PASSWORD,

  // 余额监控轮询间隔（默认: 30 秒）
  pollIntervalMs: 30_000,

  // 入账转账通知回调
  onBalanceChange: (event) => {
    console.log(`${event.direction}: ${event.difference} ${event.token} on ${event.chain}`);
  },
});
```

---

## 数据存储

所有数据存储在本地（绝不发送到云端）：

```
~/.openclaw/wallet/
├── keystore.json    # 加密的私钥 (Keystore V3, chmod 0600)
├── contacts.json    # Agent 通讯录
├── history.json     # 交易历史缓存
└── policy.json      # 安全策略与审批队列
```

---

## 支持的链和代币

| 链 | Chain ID | 默认 RPC | 内置代币 |
|----|----------|----------|----------|
| Base | 8453 | 公共 Base RPC | USDC, USDT |
| Ethereum | 1 | 公共 Ethereum RPC | USDC, USDT |

可以通过传入合约地址使用任何 ERC-20 代币。链可扩展——通过配置添加任何 EVM 兼容链。

---

## 架构

```
src/
├── index.ts          ClawWallet 类 — 编排所有子系统
├── types.ts          共享 TypeScript 类型和接口
├── keystore.ts       密钥生成、加解密 (AES-256-GCM + scrypt)、签名
├── chain.ts          多链区块链适配器 (viem PublicClient)
├── transfer.ts       交易构建: 验证 → 策略 → 签名 → 广播
├── policy.ts         消费限额、白名单、审批队列、整数分运算
├── contacts.ts       支持多链解析的命名地址簿
├── history.ts        本地交易历史（支持 BigInt 序列化）
├── monitor.ts        后台余额轮询和变动检测
├── validation.ts     输入清洗、安全文件 I/O、路径遍历防护
└── tools/            16 个 OpenClaw 工具定义
    ├── wallet-create.ts
    ├── wallet-import.ts
    ├── wallet-balance.ts       (余额 + 地址 + Gas 估算)
    ├── wallet-send.ts
    ├── wallet-contacts.ts      (列表 + 添加 + 解析 + 删除)
    ├── wallet-policy.ts        (查看 + 设置)
    ├── wallet-approval.ts      (列表 + 批准 + 拒绝)
    └── wallet-history.ts
```

**依赖理念：** 极简。仅使用 [viem](https://viem.sh) 进行区块链交互。所有加密功能使用 Node.js 内置的 `node:crypto`（scrypt、AES-256-GCM、randomBytes）——不引入第三方加密库。

---

## 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 类型检查
npm run typecheck

# 构建 (输出 ESM + CJS + .d.ts)
npm run build

# 监听模式开发
npm run dev
```

### 测试套件

项目包含全面的功能和安全测试：

| 分类 | 测试内容 |
|------|---------|
| **密钥库** | 密钥生成、加解密、错误密码、V3 结构、持久化 |
| **链** | 客户端创建、缓存、Chain ID、ERC-20 calldata 编码 |
| **通讯录** | CRUD 操作、多链解析、大小写不敏感查找、持久化 |
| **历史** | 记录管理、分页、BigInt 序列化 |
| **策略** | 限额、白名单、模式、审批流程、持久化 |
| **端到端** | 从钱包创建到全部 16 个工具的完整生命周期 |
| **安全: 密钥库** | 密钥熵、随机 IV/盐值、篡改检测、内存清零、KDF DoS 防护、暴力破解抗性 (≥100ms 解密) |
| **安全: 输入** | 地址/金额/代币/联系人注入、恶意 Keystore Schema |
| **安全: 策略** | 浮点精度攻击、整数分精确度、审批 ID 唯一性、并发每日总额 |
| **安全: 文件** | 文件权限 (0600)、路径遍历防护、原子写入 |
| **安全: RPC** | 余额验证、Gas 范围检查、错误中无密钥泄露 |

---

## 环境要求

- Node.js ≥ 18
- OpenClaw 兼容的 AI Agent 框架（或任何支持 Tool 定义的框架）

---

## 许可证

MIT
