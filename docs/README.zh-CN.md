<p align="center">
  <a href="../README.md">English</a> | <b>简体中文</b> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**让你的 AI Agent 安全地拥有一个真正的钱包。**

为 [OpenClaw](https://getclaw.sh) AI Agent 打造的非托管加密钱包。私钥存储在独立的 **Electron 桌面钱包** 中，与 AI 模型完全隔离。Agent 与桌面钱包通过 **Go 中继服务器** 建立 **端到端加密（E2EE）** 通道通信——中继服务器只转发密文，无法读取或篡改任何消息。

> 私钥绝不接触 AI 模型。不在同一台机器上，不在同一个进程中，不在内存中。Agent 只能看到钱包地址和交易哈希。

---

## 架构

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go 中继     │◄────────────────────────────►│  桌面钱包        │
│  (TypeScript)│   X25519 + AES-256-GCM       │  服务器      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ 零秘密       │                               │ 无状态       │                               │ 持有所有密钥     │
│ Tool APIs    │                               │ WS 转发      │                               │ 本地签名         │
│ JSON-RPC IPC │                               │ IP 绑定      │                               │ 安全监控         │
│ 17 个工具    │                               │ 速率限制     │                               │ 锁定管理         │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent 无法访问:                                                          桌面钱包持有:       │
       │  • 私钥                                                                   • BIP-39 助记词     │
       │  • 助记词                                                                 • Keystore V3 文件  │
       │  • 密钥材料                                                               • 签名引擎          │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**三组件设计**：每个组件职责单一。即使 Agent 所在主机被完全攻破，攻击者也无法获得任何密钥材料。

---

## 用户交互流程

### 首次配对

仅需一次。配对完成后，重连完全自动化。

```
 你                          桌面钱包                        中继服务器                AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. 创建钱包
    (设置密码,               生成 BIP-39 助记词
     备份助记词)              AES-256-GCM + scrypt
                             加密存储
                                    │
 2. 点击「生成               生成 8 位配对码
    配对码」                 (有效期 10 分钟)
                                    │
 3. 将配对码传给              │                                              Agent 调用
    Agent                     │                                              wallet_pair
                              │                                              { shortCode }
                              │                         ◄──── Agent 注册 ────────┘
                              │                               配对码
                        桌面连接 ────────────────►      中继匹配配对
                        X25519 密钥交换 ◄─────────►     E2EE 会话建立
                              │
                        保存持久化通信密钥对              Agent 保存持久化
                        (密码加密)                       通信密钥对 (0600 权限)
                              │
                        派生确定性 pairId                 派生相同 pairId
                        = SHA256(地址 +                  = SHA256(地址 +
                        agentPubKey)[:16]                agentPubKey)[:16]
                              │
 ✓ 配对完成！            就绪，可签名                     就绪，可交易
```

### 日常使用：自动重连

首次配对后，Agent 和桌面钱包在重启后自动重连——无需任何用户操作。

```
 Agent 重启                  桌面钱包重启
       │                             │
 从磁盘加载持久化             从磁盘加载持久化
 通信密钥对                   通信密钥对
                              (用钱包密码解密)
       │                             │
 重新计算 pairId              重新计算相同 pairId
       │                             │
 连接中继 ────────────────►  中继按 pairId 路由 ─────────► 桌面收到连接
       │                                                         │
 发送扩展握手:                                              三级验证:
 • publicKey                                                ✓ 第一级: 公钥匹配存储的密钥
 • machineId                                                ✓ 第二级: machineId 匹配存储的 ID
 • reconnect: true                                          ✓ 第三级: IP 变更策略 (可配置)
       │                                                         │
 E2EE 会话恢复 ◄──────────────────────────────────────── 会话激活
       │                                                         │
 就绪，可交易                                              就绪，可签名
```

### 交易流程

```
 你 (与 Agent 对话)                 AI Agent                        桌面钱包
──────────────────────────────────────────────────────────────────────────────────────
 "在 Base 上发送               wallet_send
  0.5 ETH 给 Bob"               to: "bob"  (联系人)
                                 amount: 0.5
                                 chain: base
                                        │
                                 解析联系人 ──► Bob = 0x742d...
                                 构建交易请求
                                        │
                                 E2EE 加密 ──────────────────► 解密请求
                                                                     │
                                                               策略检查:
                                                                 ✓ 单笔限额内
                                                                 ✓ 每日限额内
                                                                 ✓ 设备未冻结
                                                                     │
                                                               解密私钥
                                                               签名交易
                                                               内存清零
                                                               广播上链
                                                                     │
                                 接收结果 ◄──────────────────── 交易哈希 + 回执
                                        │
                                 返回给你:
                                 "已发送 0.5 ETH 给 Bob
                                  tx: 0xab3f..."
```

---

## 安全架构

claw-wallet 采用**纵深防御**策略，包含两个独立的安全域：**通信安全**（组件如何通信）和**密钥安全**（密钥如何存储和使用）。

### Part A: 通信安全

#### 1. 端到端加密 (E2EE)

Agent 和桌面钱包之间的所有消息都进行端到端加密。中继服务器只能看到密文。

| 组件 | 详情 |
|------|------|
| **密钥交换** | X25519 ECDH (Curve25519) |
| **密钥派生** | HKDF-SHA256 |
| **加密算法** | AES-256-GCM（认证加密） |
| **防重放** | 每条消息递增 nonce |
| **前向保密** | 每个会话使用新的临时密钥 |

#### 2. 自动配对与重连

手动配对仅需一次。系统使用**持久化通信密钥对**和**确定性配对 ID** 实现自动重连：

- **持久化密钥对**：X25519 密钥对保存到磁盘——桌面端用钱包密码加密（scrypt + AES-256-GCM），Agent 端文件权限保护（0600）
- **确定性 PairId**：`SHA256(钱包地址 + ":" + agentPublicKeyHex)[:16]`——双方独立计算相同 ID，无需协调
- **零交互重连**：重启后双方加载存储的密钥，重新计算 pairId，通过中继自动重连

#### 3. 三级重连验证

Agent 重连时，桌面钱包执行三级身份验证，验证通过后才允许签名：

| 级别 | 检查项 | 失败处理 |
|------|--------|---------|
| **第一级**（强制） | 公钥匹配存储的密钥 | 拒绝 + 强制重新配对 |
| **第二级**（强制） | machineId 匹配存储的 ID | 冻结会话 + 强制重新配对 |
| **第三级**（可配置） | IP 地址变更策略 | `block` / `warn`（默认） / `allow` |

- **machineId**：SHA256(主机名 + MAC 地址)——检测 Agent 是否迁移到了不同的机器
- **会话冻结**：检测到身份不匹配时，所有签名请求被阻止，直到用户手动重新配对
- **IP 策略**：可按部署环境配置——`block` 立即拒绝，`warn` 提醒用户但允许（同子网容忍），`allow` 跳过检查

#### 4. 中继侧保护

Go 中继服务器即使无法读取消息内容，也强制执行额外的安全措施：

| 保护措施 | 详情 |
|---------|------|
| **Per-pairId IP 绑定** | 每个配对同时最多允许 2 个不同源 IP |
| **连接速率限制** | 每个 pairId 每分钟最多 10 个新 WebSocket 连接 |
| **连接驱逐** | 第三个客户端连接时，最旧的连接被驱逐 |
| **元数据日志** | 连接事件记录（截断的 pairId）用于审计 |

#### 5. 手动重配对兜底

自动重连失败时（设备更换、密钥损坏等）：

- **Agent 侧**：`wallet_repair` RPC 方法，清除存储的配对数据并重置状态
- **桌面侧**：安全面板中的「重新配对设备」操作
- 双方生成全新密钥对，需要重新交换配对码

### Part B: 密钥安全

#### 6. 密钥隔离 — 密钥绝不接触 AI 模型

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │   桌面钱包         │
│                    │ 地址、交易哈希     │                    │
│  无法访问:         │                   │  私钥仅在           │
│  - 私钥            │                   │  signTransaction() │
│  - 密钥库文件      │                   │  内部解密           │
│  - 密码            │                   │  之后立即清零       │
└────────────────────┘                   └────────────────────┘
```

Agent 仅通过 Tool API 交互。没有任何工具会返回密钥材料。

#### 7. 静态加密 — Keystore V3

| 组件 | 详情 |
|------|------|
| **加密算法** | AES-256-GCM（认证加密） |
| **密钥派生** | scrypt (N=131072, r=8, p=1) |
| **盐值** | 每次加密 32 字节随机生成 |
| **初始向量** | 每次加密 16 字节随机生成 |
| **认证标签** | GCM 标签防止密文篡改 |
| **文件权限** | 0600（仅所有者可读写） |

#### 8. 内存安全

- 私钥仅在 `signTransaction()` / `signMessage()` 执行期间解密
- 密钥缓冲区在 `finally` 块中通过 `Buffer.fill(0)` 清零——即使签名抛出异常
- 解密后的密钥材料在内存中仅存在毫秒级时间

#### 9. 策略引擎 — 独立消费控制

策略引擎在任何签名操作**之前**运行，无法通过提示词注入绕过：

| 控制项 | 默认值 | 描述 |
|--------|--------|------|
| 单笔限额 | $100 | 单笔交易最大金额 |
| 每日限额 | $500 | 滚动 24 小时累计消费上限 |
| 地址白名单 | 空 | 监督模式下必须 |
| 运行模式 | 监督模式 | `supervised`（需白名单）或 `autonomous`（仅限额） |
| 审批队列 | 24 小时过期 | 被阻止的交易排队等待人工审核 |

**防绕过措施：**
- 整数分运算防止浮点精度攻击
- 白名单匹配不区分大小写
- 加密随机审批 ID（非连续、不可猜测）

#### 10. 输入验证

| 输入项 | 验证规则 |
|--------|---------|
| 地址 | 十六进制格式、长度=42、EIP-55 校验和 |
| 金额 | 拒绝 NaN、Infinity、负数、零、空值 |
| 链 | 严格白名单 (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| 代币符号 | 最多 20 字符，拒绝注入字符 |
| 联系人名称 | 最多 100 字符，拒绝路径遍历 |

#### 11. 文件系统与 RPC 安全

- **原子写入**：先写临时文件 → 重命名（防止崩溃时数据损坏）
- **0600 权限**：仅所有者可读写敏感文件
- **路径遍历防护**：`sanitizePath()` 拒绝数据目录外的路径
- **Gas 合理性检查**：拒绝 0 Gas 和 > 3000 万 Gas 的估算
- **无密钥泄露**：错误信息中绝不包含私钥或密码

---

## 功能特性

- **非托管 & 物理隔离** — 密钥在桌面钱包，Agent 持有零秘密
- **端到端加密** — X25519 + AES-256-GCM，中继只看到密文
- **自动配对** — 一次设置，重启后自动重连
- **三级验证** — 每次重连都验证公钥 + 设备指纹 + IP 策略
- **Keystore V3 加密** — AES-256-GCM + scrypt KDF 静态加密
- **策略引擎** — 单笔/每日消费限额、地址白名单、审批队列
- **8 条 EVM 链** — 以太坊、Base、Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei；可扩展至任意 EVM 链
- **子账户恢复** — 钱包恢复时自动扫描并找回 BIP-44 派生账户（m/44'/60'/0'/0/{n}）
- **双运行模式** — 监督模式（人工审批）或自主模式（限额内自动执行）
- **Agent 通讯录** — P2P 地址簿，按名称自动解析
- **余额监控** — 后台轮询检测入账转账
- **交易历史** — 本地缓存完整记录
- **容器化中继** — Go 中继服务器支持 Docker 部署（Hertz 框架）
- **17 个钱包工具** — 一行命令安装，`npx skills add janespace-ai/claw-wallet`

---

## 📦 两种使用方式

### 🤖 方式一：Skills 安装（推荐，适合 AI Agent）

一行命令，让 AI Agent 获得完整的钱包能力。支持 OpenClaw、Claude Code、Cline、Cursor 等任何兼容 `npx skills` 的 Agent。

**通过 CLI 安装：**
```bash
npx skills add janespace-ai/claw-wallet
```

**或直接粘贴到 Agent 对话（OpenClaw）：**
```
帮我安装 Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

安装后设置 `RELAY_URL=http://localhost:8080`（默认值——打开 Claw Wallet 桌面 app 后中继服务自动启动）。

然后配对一次：
```
"请配对我的钱包，配对码是 XXXXXXXX"
```

查看 [skills/claw-wallet/SKILL.md](../skills/claw-wallet/SKILL.md) 了解完整工具说明。

### 🔧 方式二：SDK 直接集成（适合代码集成）

在 Node.js 应用中直接安装使用：

```bash
npm install claw-wallet
```

```typescript
import { ClawWallet } from 'claw-wallet';

const wallet = new ClawWallet({
  relayUrl: 'http://localhost:8080',
  defaultChain: 'base',
});
await wallet.initialize();
const tools = wallet.getTools();
```

查看 [agent/examples/](../agent/examples/README.md) 获取完整示例。

---

## 快速开始

### 前提条件

- Node.js ≥ 18
- Go ≥ 1.21（中继服务器）
- OpenClaw 兼容的 AI Agent 框架

### 1. 启动中继服务器

```bash
cd server
go run cmd/relay/main.go
# 默认端口: 8765
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

1. 在桌面应用中：设置密码 → 备份助记词
2. 点击「生成配对码」→ 复制 8 位配对码
3. 在 Agent 中调用 `wallet_pair({ shortCode: "ABCD1234" })`
4. 完成——E2EE 会话已建立，自动重连已启用

### 4. 配合 Agent 使用

Agent 提供 17 个工具。示例对话：

```
你:     "在 Base 上发送 10 USDC 给 Bob"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → 策略 ✓ → E2EE → 桌面签名 → 广播上链
        "已发送 10 USDC 给 Bob。tx: 0xab3f..."
```

---

## 可用工具

| 工具 | 描述 |
|------|------|
| **钱包管理** | |
| `wallet_create` | 创建新钱包，生成加密密钥库 |
| `wallet_import` | 通过私钥导入已有钱包 |
| `wallet_address` | 获取当前钱包地址 |
| `wallet_pair` | 通过配对码与桌面钱包配对 |
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

## 项目结构

```
wallet/
├── agent/                 # AI Agent 框架 (TypeScript) — 零秘密
│   ├── index.ts           # ClawWallet 类 — 编排工具与签名器
│   ├── e2ee/              # E2EE 加密、WebSocket 传输、设备指纹
│   │   ├── crypto.ts      # X25519、AES-256-GCM、HKDF、密钥序列化
│   │   ├── transport.ts   # E2EE WebSocket 客户端（扩展握手）
│   │   └── machine-id.ts  # 设备指纹 (SHA256(主机名:MAC))
│   ├── signer/            # RelaySigner — 持久化配对、自动重连
│   │   ├── relay-client.ts    # 中继连接、确定性 pairId、修复
│   │   ├── ipc-server.ts     # Unix 域套接字 IPC 服务器
│   │   └── ipc-client.ts     # IPC 客户端（工具 → 签名器通信）
│   ├── tools/             # 17 个钱包工具定义
│   └── *.ts               # 策略、通讯录、历史、监控、验证
│
├── desktop/               # Electron 桌面钱包 — 持有所有秘密
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 助记词、Keystore V3 加解密
│       │   ├── signing-engine.ts   # 交易签名（内存清零）
│       │   ├── relay-bridge.ts     # E2EE 中继、三级验证、会话冻结
│       │   ├── security-monitor.ts # IP/设备变更检测、告警
│       │   └── lock-manager.ts     # 钱包锁定/解锁、空闲超时
│       ├── preload/                # 安全 contextBridge (无 nodeIntegration)
│       ├── renderer/               # HTML/CSS/JS 界面
│       └── shared/
│           └── e2ee-crypto.ts      # 共享 E2EE 原语
│
└── server/                # Go 中继服务器 (Hertz) — 无状态转发器
    ├── cmd/relay/main.go  # 入口、路由配置
    ├── internal/
    │   ├── hub/           # WebSocket 集线器、IP 绑定、速率限制
    │   ├── pairing/       # 配对码生成与解析
    │   ├── middleware/     # CORS、访问日志
    │   └── iputil/        # IP 提取工具
    ├── Dockerfile         # 多阶段构建
    └── docker-compose.yml # 一键部署
```

---

## 支持的链和代币

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

可以通过传入合约地址使用任何 ERC-20 代币。链可扩展——通过配置添加任何 EVM 兼容链。

---

## 开发

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# 桌面钱包 (Electron)
cd desktop && npm install && npm run dev

# 中继服务器 (Go)
cd server && go test ./...

# Docker 部署
cd server && docker compose up --build
```

### 测试套件

| 分类 | 测试内容 |
|------|---------|
| **密钥库** | 密钥生成、加解密、错误密码、V3 结构 |
| **策略** | 限额、白名单、模式、审批流程、整数分运算 |
| **E2EE** | 密钥对序列化、确定性 pairId 派生 |
| **中继集线器** | WebSocket 路由、配对 IP 绑定、连接速率限制 |
| **配对** | 配对码生成、过期、解析 |
| **中间件** | CORS 配置、访问日志 |
| **安全** | 密钥熵、内存清零、输入注入、文件权限、路径遍历、RPC 安全 |

---

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| "Wallet app offline" | 确保桌面钱包正在运行并已连接中继服务器 |
| "Pairing code expired" | 重新生成配对码（10 分钟有效期） |
| 签名请求被阻止 | 检查会话是否被冻结（身份不匹配）——必要时重新配对 |
| IP 变更告警 | 配置 IP 策略：`block` / `warn` / `allow` |
| Agent 无法重连 | 使用 `wallet_repair` 清除配对数据并重新配对 |
| 同一主机警告 | 将桌面钱包迁移到独立设备以获得完整安全性 |

---

## 许可证

MIT
