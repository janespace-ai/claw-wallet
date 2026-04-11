<p align="center">
  <a href="../README.md">English</a> | <b>简体中文</b> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Release"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Last Commit"></a>
</p>

<h1 align="center">Claw-Wallet</h1>

<p align="center">
  <b>让你的 AI Agent 安全地持有一个真正的钱包。</b><br>
  <i>专为 AI Agent 设计的非托管加密钱包，实现完全的密钥隔离</i>
</p>

> **不是开发者？** 请访问 **[janespace-ai.github.io](https://janespace-ai.github.io)** 查看用户指南 -- 安装、配对、几分钟内即可上手。

**Claw-Wallet** 是一款安全的非托管加密钱包，专为 OpenClaw、Claude Code、Cursor 等 AI Agent 设计。私钥存储在独立的 **Electron 桌面钱包** 中，与 AI 模型完全隔离。Agent 与桌面端通过 **Go 中继服务器** 建立 **E2EE（端到端加密）** 通道通信 -- 中继服务器只转发密文，无法读取或篡改任何消息。

> **核心安全承诺**：私钥绝不接触 AI 模型。不在同一台机器上，不在同一个进程中，不在内存中。Agent 只能看到钱包地址和交易哈希。

## 核心特性

| 特性 | 描述 |
|------|------|
| **完全密钥隔离** | 密钥仅存于桌面钱包；Agent 只能看到地址和哈希 |
| **多链支持** | Ethereum、Base、Arbitrum、Optimism、Polygon、Linea、BSC、Sei |
| **AI Agent 原生支持** | 内置 OpenClaw、Claude Code、Cursor、Codex 等工具 |
| **E2EE 通信** | X25519 + AES-256-GCM 加密；中继服务器只能看到密文 |
| **自动重连** | 配对一次，重启后自动重连 |
| **策略引擎** | 单笔和每日限额、地址白名单、审批队列 |
| **桌面端 + CLI** | Electron 桌面应用管理密钥 + CLI 工具供 Agent 使用 |
| **开源** | MIT 许可证 -- 可审查、修改和贡献 |

## 四步快速上手

**第 1 步 -- 安装桌面钱包**

下载最新版本并启动应用。创建钱包、设置密码并备份助记词。

| 平台 | 下载 |
|------|------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> 所有版本：[github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="Welcome screen" />

**第 2 步 -- 连接你的 Agent**

**使用 OpenClaw？** 在聊天中直接告诉 OpenClaw：

```
openclaw plugins install @janespace-ai/claw-wallet
```

**使用 Claude Code、Cline、Cursor 或其他 Agent？** 将以下内容粘贴到你的 Agent 聊天中：

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

或通过 CLI 安装：

```bash
npx skills add janespace-ai/claw-wallet
```

**第 3 步 -- 生成配对码**

在桌面应用中，点击 **"Generate Pairing Code"** 并复制 8 位配对码。

<img src="screenshots/pair-code-dark.png" width="320" alt="Pairing code screen" />

**第 4 步 -- 开始使用**

将配对码粘贴到你的 Agent 中（只需一次）。之后 Agent 和桌面端会自动重连，无需任何用户操作。

<img src="screenshots/tx-approval-dark.png" width="320" alt="Transaction approval screen" />

```
你：    "在 Base 上发送 10 USDC 给 Bob"
Agent： → 解析联系人 → 构建交易 → E2EE → 桌面端签名 → 广播
        "已发送 10 USDC 给 Bob。tx: 0xab3f..."
```

---

## 架构

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go 中继     │◄────────────────────────────►│  桌面钱包        │
│  (TypeScript)│   X25519 + AES-256-GCM       │  服务器      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ 零密钥       │                               │ 无状态       │                               │ 持有所有密钥     │
│ Tool APIs    │                               │ WS 转发器    │                               │ 本地签名         │
│ JSON-RPC IPC │                               │ IP 绑定      │                               │ 安全监控         │
│ 17 个工具    │                               │ 速率限制     │                               │ 锁定管理器       │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent 无法访问：                                                      桌面端持有：          │
       │  - 私钥                                                               - BIP-39 助记词        │
       │  - 助记词                                                             - Keystore V3 文件     │
       │  - 密钥材料                                                           - 签名引擎             │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**三组件设计**：每个组件只承担单一职责。即使 Agent 所在主机被完全攻破，攻击者也无法获得任何密钥材料。

---

## 用户交互流程

### 首次设置：配对

仅需进行一次。初始配对完成后，重连完全自动。

```
 你                              桌面钱包                       中继服务器                AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. 创建钱包
    （设置密码，               生成 BIP-39 助记词
     备份助记词）              使用 AES-256-GCM
                               + scrypt KDF 加密
                                    │
 2. 点击"生成配对码"           生成 8 位配对码
                               （有效期 10 分钟）
                                    │
 3. 将配对码复制给 Agent              │                                              Agent 调用
    （或通过安全通道发送）            │                                              wallet_pair
                                     │                                              { shortCode }
                                     │                         ◄──── Agent 注册 ────┘
                                     │                               使用配对码
                               桌面端连接 ────────────────►    中继匹配配对
                               X25519 密钥交换 ◄──────────►   E2EE 会话建立
                                     │
                               保存持久通信                    Agent 保存持久
                               密钥对（加密）                  通信密钥对（0600）
                                     │
                               派生确定性                      派生相同 pairId
                               pairId = SHA256(addr +          = SHA256(addr +
                               agentPubKey)[:16]               agentPubKey)[:16]
                                     │
 配对完成！                    准备签名                        准备交易
```

### 日常使用：自动重连

初始配对后，Agent 和桌面端在重启时自动重连，无需用户操作。

```
 Agent 重启                    桌面端重启
       │                             │
 从磁盘加载持久                从磁盘加载持久
 通信密钥对                    通信密钥对（使用钱包
                               密码解密）
       │                             │
 重新计算 pairId               重新计算相同的 pairId
       │                             │
 连接到中继 ──────────────────► 中继按 pairId 路由 ────────► 桌面端接收
       │                                                             │
 发送扩展握手：                                               三级验证：
 - publicKey                                                  Level 1: 公钥匹配存储的密钥
 - machineId                                                  Level 2: machineId 匹配存储的 ID
 - reconnect: true                                            Level 3: IP 变更策略（可配置）
       │                                                             │
 E2EE 会话恢复 ◄──────────────────────────────────────────── 会话激活
       │                                                             │
 准备交易                                                     准备签名
```

### 交易流程

```
 你（与 Agent 聊天）                 AI Agent                        桌面钱包
──────────────────────────────────────────────────────────────────────────────────────
 "在 Base 上发送 0.5 ETH      wallet_send
  给 Bob"                        to: "bob"  （联系人）
                                 amount: 0.5
                                 chain: base
                                        │
                                 解析联系人 ──────► Bob = 0x742d...
                                 构建交易请求
                                        │
                                 E2EE 加密 ──────────────────────► 解密请求
                                                                       │
                                                                 策略检查：
                                                                   单笔限额内
                                                                   每日限额内
                                                                   设备未冻结
                                                                       │
                                                                 解密私钥
                                                                 签署交易
                                                                 从内存中清零密钥
                                                                 广播到链上
                                                                       │
                                 接收结果 ◄──────────────────────── 交易哈希 + 回执
                                        │
                                 返回给你：
                                 "已发送 0.5 ETH 给 Bob
                                  tx: 0xab3f..."
```

---

## 安全架构

Claw-Wallet 采用 **纵深防御** 策略，包含两个独立的安全域：**通信安全**（组件间如何通信）和 **密钥安全**（密钥如何存储和使用）。

### 第 A 部分：通信安全

#### 1. 端到端加密（E2EE）

Agent 与桌面端之间的所有消息均进行端到端加密。中继服务器只能看到密文。

| 组件 | 详情 |
|------|------|
| **密钥交换** | X25519 ECDH (Curve25519) |
| **密钥派生** | HKDF-SHA256 |
| **加密算法** | AES-256-GCM（认证加密） |
| **防重放** | 每条消息递增 nonce |
| **前向保密** | 每次会话使用新的临时密钥 |

#### 2. 自动配对与重连

手动配对只需进行一次。系统使用 **持久通信密钥对** 和 **确定性配对 ID** 实现自动重连：

- **持久密钥对**：X25519 密钥对保存到磁盘 -- 桌面端使用钱包密码加密（scrypt + AES-256-GCM），Agent 端使用文件权限保护（0600）
- **确定性 PairId**：`SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` -- 双方独立计算相同的 ID，无需协调
- **零交互重连**：重启时，双方加载存储的密钥，重新计算 pairId，通过中继自动重连

#### 3. 三级重连验证

当 Agent 重连时，桌面端在允许任何签名操作前执行三项身份检查：

| 级别 | 检查内容 | 失败处理 |
|------|----------|----------|
| **Level 1**（硬性） | 公钥匹配存储的密钥 | 拒绝 + 强制重新配对 |
| **Level 2**（硬性） | machineId 匹配存储的 ID | 冻结会话 + 强制重新配对 |
| **Level 3**（可配置） | IP 地址变更策略 | `block` / `warn`（默认）/ `allow` |

- **machineId**：SHA256(hostname + MAC address) -- 检测 Agent 是否移动到了不同的机器
- **会话冻结**：当检测到身份不匹配时，所有签名请求将被阻止，直到用户手动重新配对
- **IP 策略**：可按部署配置 -- `block` 立即拒绝，`warn` 警告用户但允许（同子网容忍），`allow` 跳过检查

#### 4. 中继端保护

Go 中继服务器实施额外的安全措施，即使它无法读取消息内容：

| 保护措施 | 详情 |
|----------|------|
| **按 pairId 绑定 IP** | 每个配对同时最多 2 个不同的源 IP |
| **连接速率限制** | 每个 pairId 每分钟最多 10 个新的 WebSocket 连接 |
| **连接淘汰** | 如果第三个客户端连接到一个配对，最旧的将被淘汰 |
| **元数据日志** | 连接事件以截断的 pairId 记录以供审计 |

#### 5. 手动重新配对回退

当自动重连失败时（设备更换、密钥损坏等）：

- **Agent 端**：`wallet_repair` RPC 方法清除存储的配对数据并重置状态
- **桌面端**：安全面板中的"Re-pair Device"UI 操作
- 双方生成新的密钥对，需要进行新的配对码交换

### 第 B 部分：密钥安全

#### 6. 密钥隔离 -- 密钥绝不接触 AI 模型

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  桌面钱包          │
│                    │  地址、哈希        │                    │
│  无法访问：         │                   │  私钥仅在          │
│  - 私钥            │                   │  signTransaction() │
│  - keystore 文件   │                   │  内部解密          │
│  - 密码            │                   │  然后清零          │
└────────────────────┘                   └────────────────────┘
```

Agent 仅通过 Tool API 进行交互。没有任何工具会返回密钥材料。

#### 7. 静态加密 -- Keystore V3

| 组件 | 详情 |
|------|------|
| **加密算法** | AES-256-GCM（认证加密） |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **盐值** | 每次加密 32 字节随机值 |
| **IV** | 每次加密 16 字节随机值 |
| **认证标签** | GCM 标签防止密文篡改 |
| **文件权限** | 0600（仅所有者可读写） |

#### 8. 内存安全

- 私钥仅在 `signTransaction()` / `signMessage()` 执行期间解密
- 密钥缓冲区在 `finally` 块中使用 `Buffer.fill(0)` 清零 -- 即使签名抛出异常
- 解密的密钥材料在内存中仅存在毫秒级别，而非秒级别

#### 9. 策略引擎 -- 独立的支出控制

策略引擎在任何签名 **之前** 运行，无法通过提示注入绕过：

| 控制项 | 默认值 | 描述 |
|--------|--------|------|
| 单笔交易限额 | $100 | 单笔交易最大金额 |
| 每日限额 | $500 | 滚动 24 小时累计支出上限 |
| 地址白名单 | 空 | 监督模式下为必填项 |
| 运行模式 | 监督模式 | `supervised`（需要白名单）或 `autonomous`（仅限额） |
| 审批队列 | 24 小时过期 | 被阻止的交易排队等待人工审核 |

**防绕过措施：**
- 整数分运算，防止浮点精度攻击
- 白名单匹配不区分大小写
- 加密随机审批 ID（非顺序、不可猜测）

#### 10. 输入验证

| 输入 | 验证规则 |
|------|----------|
| 地址 | 十六进制格式，长度=42，通过 viem 进行 EIP-55 校验和验证 |
| 金额 | 拒绝 NaN、Infinity、负数、零、空值 |
| 链 | 严格白名单（`ethereum`、`base`、`linea`、`arbitrum`、`bsc`、`optimism`、`polygon`、`sei`） |
| 代币符号 | 最多 20 个字符，拒绝注入字符 |
| 联系人名称 | 最多 100 个字符，拒绝路径遍历 |

#### 11. 文件系统与 RPC 安全

- **原子写入**：先写入临时文件，再重命名（防止崩溃时损坏）
- **0600 权限**：仅所有者可读写敏感文件
- **路径遍历防护**：`sanitizePath()` 拒绝数据目录外的路径
- **Gas 合理性检查**：拒绝 0 gas 和 > 30M gas 的估算
- **无密钥泄露**：错误消息绝不包含私钥或密码

---

## 功能列表

- **非托管与气隙隔离** -- 密钥在桌面端，Agent 持有零密钥
- **端到端加密** -- X25519 + AES-256-GCM，中继只能看到密文
- **自动配对** -- 一次性设置，重启后自动重连
- **三级验证** -- 每次重连时进行公钥 + 设备指纹 + IP 策略验证
- **Keystore V3 加密** -- AES-256-GCM + scrypt KDF 保护静态密钥
- **策略引擎** -- 单笔和每日支出限额、地址白名单、审批队列
- **8 条 EVM 链** -- Ethereum、Base、Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei；可扩展至任何 EVM 链
- **子账户恢复** -- 在钱包恢复时扫描并恢复派生账户（BIP-44 m/44'/60'/0'/0/{n}）
- **双运行模式** -- 监督模式（人工审批）或自主模式（仅限额内）
- **Agent 联系人** -- P2P 地址簿，支持名称解析
- **余额监控** -- 后台轮询检测转入
- **交易历史** -- 本地缓存完整记录
- **容器化中继** -- Go 中继服务器，支持 Docker（Hertz 框架）
- **17 个钱包工具** -- 发布到 npm [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet)，可通过 `npm install @janespace-ai/claw-wallet` 或 `npx skills add janespace-ai/claw-wallet` 安装
- **国际化（i18n）** -- 桌面应用支持英文和简体中文，可运行时切换语言

---

## 快速开始

### 前置要求

- Node.js >= 18
- Go >= 1.21（用于中继服务器）
- 兼容 OpenClaw 的 AI Agent 框架

### 1. 启动中继服务器

```bash
cd server
go run cmd/relay/main.go
# 默认端口：:8765
```

或使用 Docker：

```bash
cd server
docker compose up -d
```

### 2. 启动桌面钱包

```bash
cd desktop
npm install
npm run dev
```

### 3. 创建钱包并配对

1. 在桌面应用中：设置密码 -> 备份助记词
2. 点击"Generate Pairing Code" -> 复制 8 位配对码
3. 在你的 Agent 中，调用 `wallet_pair({ shortCode: "ABCD1234" })`
4. 完成 -- E2EE 会话已建立，自动重连已启用

### 4. 与你的 Agent 配合使用

共 17 个可用工具。示例对话：

```
你：    "在 Base 上发送 10 USDC 给 Bob"
Agent： wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → 策略通过 → E2EE → 桌面端签名 → 广播
        "已发送 10 USDC 给 Bob。tx: 0xab3f..."
```

---

## 可用工具

| 工具 | 描述 |
|------|------|
| **钱包管理** | |
| `wallet_create` | 创建新钱包并生成加密 keystore |
| `wallet_import` | 通过私钥导入已有钱包 |
| `wallet_address` | 获取当前钱包地址 |
| `wallet_pair` | 通过短码与桌面钱包配对 |
| **余额与 Gas** | |
| `wallet_balance` | 查询 ETH 或 ERC-20 代币余额 |
| `wallet_estimate_gas` | 发送前估算 gas 费用 |
| **交易** | |
| `wallet_send` | 发送 ETH 或 ERC-20 代币（支持联系人名称） |
| `wallet_history` | 查询分页交易历史 |
| **联系人** | |
| `wallet_contacts_add` | 添加或更新联系人及其多链地址 |
| `wallet_contacts_list` | 列出所有已保存的联系人 |
| `wallet_contacts_resolve` | 按名称查找联系人地址 |
| `wallet_contacts_remove` | 删除联系人 |
| **策略与审批** | |
| `wallet_policy_get` | 查看当前安全策略 |
| `wallet_policy_set` | 更新支出限额、白名单或模式 |
| `wallet_approval_list` | 列出待处理的交易审批 |
| `wallet_approval_approve` | 批准排队中的交易 |
| `wallet_approval_reject` | 拒绝排队中的交易 |

---

## 项目结构

```
wallet/
├── agent/                 # AI Agent 框架 (TypeScript) -- 零密钥
│   ├── index.ts           # ClawWallet 类 -- 编排工具和签名器
│   ├── e2ee/              # E2EE 加密、WebSocket 传输、机器标识
│   │   ├── crypto.ts      # X25519、AES-256-GCM、HKDF、密钥序列化
│   │   ├── transport.ts   # E2EE WebSocket 客户端（含扩展握手）
│   │   └── machine-id.ts  # 设备指纹（SHA256(hostname:MAC)）
│   ├── signer/            # RelaySigner -- 持久配对、自动重连
│   │   ├── relay-client.ts    # 中继连接、确定性 pairId、修复
│   │   ├── ipc-server.ts     # Unix domain socket IPC 服务器
│   │   └── ipc-client.ts     # IPC 客户端，用于 tool -> signer 通信
│   ├── tools/             # 17 个钱包工具定义
│   └── *.ts               # 策略、联系人、历史、监控、验证
│
├── desktop/               # Electron 桌面钱包 -- 持有所有密钥
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 助记词、Keystore V3 加解密
│       │   ├── signing-engine.ts   # 交易签名与内存清零
│       │   ├── signing-history.ts  # SQLite 交易活动历史
│       │   ├── tx-sync-service.ts  # 区块链交易状态同步
│       │   ├── chain-adapter.ts    # RPC 客户端，用于获取交易回执
│       │   ├── database-service.ts # SQLite 连接与 schema 迁移
│       │   ├── price-service.ts    # 多级价格获取（Gate.com、CoinGecko）
│       │   ├── balance-service.ts  # 跨链代币余额聚合
│       │   ├── relay-bridge.ts     # E2EE 中继、三级验证、会话冻结
│       │   ├── security-monitor.ts # IP/设备变更检测、告警
│       │   └── lock-manager.ts     # 钱包锁定/解锁、空闲超时
│       ├── preload/                # 安全 contextBridge（无 nodeIntegration）
│       ├── renderer/               # HTML/CSS/JS UI（活动标签页、余额显示）
│       └── shared/
│           └── e2ee-crypto.ts      # 共享 E2EE 加密原语
│
└── server/                # Go 中继服务器 (Hertz) -- 无状态转发器
    ├── cmd/relay/main.go  # 入口、路由配置
    ├── internal/
    │   ├── hub/           # WebSocket hub、IP 绑定、速率限制
    │   ├── pairing/       # 短码生成与解析
    │   ├── middleware/     # CORS、访问日志
    │   └── iputil/        # IP 提取工具
    ├── Dockerfile         # 多阶段构建
    └── docker-compose.yml # 一键部署
```

---

## 支持的链与代币

| 链 | Chain ID | 内置代币 |
|----|----------|----------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

可通过传入合约地址使用任何 ERC-20 代币。链可扩展 -- 通过配置即可添加任何 EVM 兼容链。

### Web3 网络配置

Agent 和桌面端均支持自定义 RPC 端点配置，适用于生产环境和本地开发。

#### 生产环境配置

创建 `config.json` 并填入你的 RPC 提供商：

```json
{
  "relayUrl": "https://relay.your-domain.com",
  "defaultChain": "base",
  "chains": {
    "ethereum":  { "rpcUrl": "https://ethereum.publicnode.com" },
    "base":      { "rpcUrl": "https://mainnet.base.org" },
    "linea":     { "rpcUrl": "https://rpc.linea.build" },
    "arbitrum":  { "rpcUrl": "https://arb1.arbitrum.io/rpc" },
    "bsc":       { "rpcUrl": "https://bsc.publicnode.com" },
    "optimism":  { "rpcUrl": "https://optimism.publicnode.com" },
    "polygon":   { "rpcUrl": "https://polygon-bor-rpc.publicnode.com" },
    "sei":       { "rpcUrl": "https://evm-rpc.sei-apis.com" }
  }
}
```

#### 本地开发

使用 Hardhat 或 Anvil 进行本地区块链测试：

```json
{
  "relayUrl": "http://localhost:8080",
  "defaultChain": "ethereum",
  "chains": {
    "ethereum": { "rpcUrl": "http://localhost:8545" },
    "base":     { "rpcUrl": "http://localhost:8546" }
  }
}
```

启动本地节点：

```bash
# Ethereum 模拟（Chain ID: 1）
npx hardhat node --chain-id 1 --port 8545

# Base 模拟（Chain ID: 8453）
npx hardhat node --chain-id 8453 --port 8546
```

详见 [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) 获取完整设置指南。

#### 默认行为

如果未提供 `chains` 配置，系统将使用 viem 内置的公共 RPC 端点。

---

## 开发

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# 桌面端 (Electron)
cd desktop && npm install && npm run dev

# 中继服务器 (Go)
cd server && go test ./...

# Docker 部署
cd server && docker compose up --build
```

### 测试套件

| 类别 | 测试内容 |
|------|----------|
| **Keystore** | 密钥生成、加解密、错误密码、V3 结构 |
| **策略** | 限额、白名单、模式、审批流程、整数分运算 |
| **E2EE** | 密钥对序列化、确定性 pairId 派生 |
| **Relay Hub** | WebSocket 路由、配对 IP 绑定、连接速率限制 |
| **配对** | 短码生成、过期、解析 |
| **中间件** | CORS 配置、访问日志 |
| **安全** | 密钥熵、内存清除、输入注入、文件权限、路径遍历、RPC 安全 |

---

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| "Wallet app offline" | 确保桌面钱包正在运行并已连接到中继 |
| "Pairing code expired" | 生成新的配对码（有效期 10 分钟） |
| 签名请求被阻止 | 检查会话是否被冻结（身份不匹配）-- 如需要请重新配对 |
| IP 变更警告 | 配置 IP 策略：`block` / `warn` / `allow` |
| Agent 无法重连 | 使用 `wallet_repair` 清除配对数据并重新配对 |
| 同机器警告 | 将桌面钱包移至独立设备以获得完整安全性 |

---

## 国际化（i18n）

桌面应用支持多语言，可在运行时切换语言：

### 支持的语言

- **English (en)** -- 默认语言
- **简体中文 (zh-CN)** -- Simplified Chinese

### 功能特性

- **自动检测**：首次启动时自动检测系统语言
- **手动切换**：Header 右上角的语言选择器
- **持久化**：用户偏好通过 localStorage 在会话间保存
- **运行时更新**：静态 UI 元素（按钮、标签、标签页）立即更新
- **无缝体验**：语言切换无需重启应用

### 架构

```
i18next 框架
├── 翻译文件 (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # 按钮标签消息
│   │   ├── setup.json       # 钱包设置流程
│   │   ├── activity.json    # 交易活动
│   │   ├── security.json    # 安全事件
│   │   ├── settings.json    # 设置面板
│   │   ├── pairing.json     # 设备配对
│   │   ├── errors.json      # 错误消息
│   │   ├── modals.json      # 审批导出警告对话框
│   │   └── contactsPage.json
│   └── zh-CN/（相同结构；保持键名与 en 同步）
│   注意：`npm run build` 会将这些文件复制到 dist/renderer/locales/ 供 Electron 使用。
├── 语言检测 (i18n.js)
│   ├── 1. 检查 localStorage（用户偏好）
│   ├── 2. 检查 navigator.language（系统语言）
│   └── 3. 回退到英文
└── DOM 更新系统
    ├── data-i18n 属性用于静态内容
    └── i18next.t() 用于动态内容
```

### 添加新语言

1. 创建翻译目录：
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. 从 `en/` 复制并翻译所有 JSON 文件：
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # 编辑每个文件以翻译其中的值
   ```

3. 在 `index.html` 的语言选择器中添加语言选项：
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Your Language</option>
   </select>
   ```

4. 如需要，更新 `i18n.js` 中的命名空间列表

### 翻译键名约定

使用层级化、语义化的命名：

```
namespace.feature.element

示例：
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### 开发者指南

**HTML（静态内容）**：
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript（动态内容）**：
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**使用插值**：
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// 翻译："Remove all entries for contact \"{name}\"?"
```

---

## 贡献

我们欢迎各种贡献！以下是你可以帮助的方式：

### 报告问题
- **Bug 报告**：使用 [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues) 页面
- **功能请求**：提出新功能或改进建议
- **安全漏洞**：请通过邮件私下报告（见 GitHub 个人资料）

### 提交 Pull Request
1. **Fork** 此仓库
2. **创建分支**：`git checkout -b feature/your-feature`
3. **提交更改**：`git commit -m 'Add some feature'`
4. **推送**：`git push origin feature/your-feature`
5. **发起 Pull Request**

### 开发环境设置
```bash
# 克隆仓库
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test
```

### 需要帮助的领域
- **文档**：改进指南、添加教程、翻译为更多语言
- **新链**：添加对更多 EVM 或非 EVM 链的支持
- **UI/UX 改进**：增强桌面钱包界面
- **测试**：编写单元/集成测试，提高测试覆盖率

### 代码风格
- 使用 **TypeScript** 并开启严格类型检查
- 遵循 **Prettier** 格式化（配置在 `.prettierrc` 中）
- 编写有意义的提交信息
- 为新功能添加测试

### 加入社区
- **Discord**：[加入我们的服务器](https://discord.gg/clawd)（即将上线）
- **Twitter**：关注 [@janespace_ai](https://twitter.com/janespace_ai) 获取更新
- **GitHub Discussions**：发起讨论提问或分享想法

---

## 许可证

MIT (c) [janespace-ai](https://github.com/janespace-ai)
