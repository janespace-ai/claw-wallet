<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <b>繁體中文</b> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**讓您的 AI Agent 持有真正的錢包——安全無虞。**

一個為 [OpenClaw](https://getclaw.sh) AI Agent 設計的非託管加密貨幣錢包。私鑰存放在獨立的 **Electron 桌面錢包**中，與 AI 模型完全隔離。Agent 與桌面端透過 **Go 中繼伺服器**的 **E2EE（端對端加密）** 通道進行通訊——中繼伺服器僅轉發密文，永遠無法讀取或篡改訊息。

> 私鑰永遠不會接觸 AI 模型。不在同一台機器上、不在同一個程序中、不在記憶體中。Agent 只能看到錢包地址和交易雜湊值。

---

## 架構

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ Zero secrets │                               │ Stateless    │                               │ Holds all keys   │
│ Tool APIs    │                               │ WS forwarder │                               │ Signs locally    │
│ JSON-RPC IPC │                               │ IP binding   │                               │ Security monitor │
│ 17 MCP tools │                               │ Rate limiter │                               │ Lock manager     │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent never sees:                                                        Desktop holds:     │
       │  • private keys                                                           • BIP-39 mnemonic  │
       │  • mnemonics                                                              • Keystore V3 file │
       │  • key material                                                           • Signing engine    │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**三組件設計**：每個組件各司其職。即使 Agent 所在的主機被完全攻破，攻擊者也無法取得任何金鑰資料。

---

## 使用者互動流程

### 首次設定：配對

僅需執行一次。完成初始配對後，重新連線將完全自動進行。

```
 You                          Desktop Wallet                 Relay Server              AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. Create wallet
    (set password,            Generates BIP-39 mnemonic
     backup mnemonic)         Encrypts with AES-256-GCM
                              + scrypt KDF
                                    │
 2. Click "Generate           Generates 8-char pairing
    Pairing Code"             code (valid 10 min)
                                    │
 3. Copy code to Agent              │                                              Agent calls
    (or send via secure             │                                              wallet_pair
    channel)                        │                                              { shortCode }
                                    │                         ◄──── Agent registers ────┘
                                    │                               with code
                              Desktop connects ────────────►  Relay matches pair
                              X25519 key exchange ◄─────────► E2EE session established
                                    │
                              Saves persistent comm          Agent saves persistent
                              key pair (encrypted)           comm key pair (0600)
                                    │
                              Derives deterministic          Derives same pairId
                              pairId = SHA256(addr +         = SHA256(addr +
                              agentPubKey)[:16]              agentPubKey)[:16]
                                    │
 ✓ Paired!                    Ready to sign                  Ready to transact
```

### 日常使用：自動重新連線

完成初始配對後，Agent 與桌面端在重新啟動時會自動重新連線——無需使用者操作。

```
 Agent restarts               Desktop restarts
       │                             │
 Loads persistent             Loads persistent
 comm key pair                comm key pair (decrypts
 from disk                    with wallet password)
       │                             │
 Recomputes pairId            Recomputes same pairId
       │                             │
 Connects to Relay ──────────► Relay routes by pairId ──────► Desktop receives
       │                                                             │
 Sends extended handshake:                                    Three-level verification:
 • publicKey                                                  ✓ Level 1: Public key matches stored key
 • machineId                                                  ✓ Level 2: machineId matches stored ID
 • reconnect: true                                            ✓ Level 3: IP change policy (configurable)
       │                                                             │
 E2EE session restored ◄──────────────────────────────────── Session active
       │                                                             │
 Ready to transact                                            Ready to sign
```

### 交易流程

```
 You (chat with Agent)                AI Agent                        Desktop Wallet
──────────────────────────────────────────────────────────────────────────────────────
 "Send 0.5 ETH to Bob           wallet_send
  on Base"                         to: "bob"  (contact)
                                   amount: 0.5
                                   chain: base
                                        │
                                 Resolve contact ──► Bob = 0x742d...
                                 Build tx request
                                        │
                                 E2EE encrypt ──────────────────► Decrypt request
                                                                       │
                                                                 Policy check:
                                                                   ✓ Within per-tx limit
                                                                   ✓ Within daily limit
                                                                   ✓ Device not frozen
                                                                       │
                                                                 Decrypt private key
                                                                 Sign transaction
                                                                 Zero key from memory
                                                                 Broadcast to chain
                                                                       │
                                 Receive result ◄────────────────── tx hash + receipt
                                        │
                                 Return to you:
                                 "Sent 0.5 ETH to Bob
                                  tx: 0xab3f..."
```

---

## 安全架構

claw-wallet 採用**縱深防禦**策略，包含兩個獨立的安全領域：**通訊安全**（組件間的通訊方式）和**金鑰安全**（金鑰的儲存與使用方式）。

### 第 A 部分：通訊安全

#### 1. 端對端加密（E2EE）

Agent 與桌面端之間的所有訊息均經過端對端加密。中繼伺服器只能看到密文。

| 組件 | 詳情 |
|-----------|--------|
| **金鑰交換** | X25519 ECDH (Curve25519) |
| **金鑰衍生** | HKDF-SHA256 |
| **加密方式** | AES-256-GCM（認證加密） |
| **防重放攻擊** | 每條訊息遞增隨機數 |
| **前向保密** | 每次會話使用新的臨時金鑰 |

#### 2. 自動配對與重新連線

手動配對僅需執行一次。系統使用**持久通訊金鑰對**和**確定性配對 ID** 實現自動重新連線：

- **持久金鑰對**：X25519 金鑰對儲存至磁碟——桌面端使用錢包密碼加密（scrypt + AES-256-GCM），Agent 端以檔案權限保護（0600）
- **確定性 PairId**：`SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]`——雙方獨立計算出相同的 ID，無需協調
- **零互動重新連線**：重新啟動時，雙方載入儲存的金鑰、重新計算 pairId，並自動透過中繼伺服器重新連線

#### 3. 三級重新連線驗證

當 Agent 重新連線時，桌面端會在允許任何簽名操作之前執行三項身份檢查：

| 級別 | 檢查項目 | 失敗時的處理 |
|-------|-------|----------------|
| **第 1 級**（硬性） | 公鑰與儲存的金鑰匹配 | 拒絕 + 強制重新配對 |
| **第 2 級**（硬性） | machineId 與儲存的 ID 匹配 | 凍結會話 + 強制重新配對 |
| **第 3 級**（可配置） | IP 位址變更策略 | `block` / `warn`（預設）/ `allow` |

- **machineId**：SHA256(hostname + MAC address)——偵測 Agent 是否移至不同的機器
- **會話凍結**：當偵測到身份不匹配時，所有簽名請求將被封鎖，直到使用者手動重新配對
- **IP 策略**：可依部署環境配置——`block` 立即拒絕、`warn` 警告使用者但允許（具有相同子網路容錯）、`allow` 跳過檢查

#### 4. 中繼端防護

Go 中繼伺服器即使無法讀取訊息內容，仍會執行額外的安全措施：

| 防護措施 | 詳情 |
|------------|--------|
| **每對 PairId IP 綁定** | 每對同時最多 2 個不同的來源 IP |
| **連線速率限制** | 每個 pairId 每分鐘最多 10 個新的 WebSocket 連線 |
| **連線驅逐** | 當第三個客戶端連線至同一對時，最舊的連線將被驅逐 |
| **中繼資料記錄** | 連線事件以截斷的 pairId 記錄，供稽核使用 |

#### 5. 手動重新配對備援

當自動重新連線失敗時（裝置變更、金鑰損毀等）：

- **Agent 端**：`wallet_repair` RPC 方法清除已儲存的配對資料並重設狀態
- **桌面端**：安全面板中的「重新配對裝置」UI 操作
- 雙方產生全新的金鑰對，需要新的配對碼交換

### 第 B 部分：金鑰安全

#### 6. 金鑰隔離——金鑰永遠不接觸 AI 模型

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  NO access to:     │                   │  Private key only  │
│  - private keys    │                   │  decrypted inside  │
│  - keystore file   │                   │  signTransaction() │
│  - password        │                   │  then zeroed       │
└────────────────────┘                   └────────────────────┘
```

Agent 僅透過 Tool API 進行互動。沒有任何工具會回傳金鑰資料。

#### 7. 靜態加密——Keystore V3

| 組件 | 詳情 |
|-----------|--------|
| **加密演算法** | AES-256-GCM（認證加密） |
| **金鑰衍生函式** | scrypt (N=131072, r=8, p=1) |
| **鹽值** | 每次加密使用 32 位元組隨機值 |
| **初始向量** | 每次加密使用 16 位元組隨機值 |
| **認證標籤** | GCM 標籤防止密文被篡改 |
| **檔案權限** | 0600（僅擁有者可讀寫） |

#### 8. 記憶體安全

- 私鑰僅在 `signTransaction()` / `signMessage()` 執行期間解密
- 金鑰緩衝區在 `finally` 區塊中使用 `Buffer.fill(0)` 歸零——即使簽名過程拋出異常
- 解密的金鑰資料僅在記憶體中存在毫秒級時間，而非秒級

#### 9. 策略引擎——獨立的支出控制

策略引擎在任何簽名操作**之前**執行，且無法透過提示注入繞過：

| 控制項目 | 預設值 | 說明 |
|---------|---------|-------------|
| 單筆交易限額 | $100 | 單筆交易最大金額 |
| 每日限額 | $500 | 滾動 24 小時累計支出上限 |
| 地址白名單 | 空 | 監督模式下為必要項目 |
| 運作模式 | 監督模式 | `supervised`（需要白名單）或 `autonomous`（僅限額） |
| 審批佇列 | 24 小時過期 | 被阻擋的交易排入佇列等待人工審查 |

**防繞過措施：**
- 整數分位運算，防止浮點精度攻擊
- 不區分大小寫的白名單比對
- 加密隨機審批 ID（非順序、不可猜測）

#### 10. 輸入驗證

| 輸入 | 驗證方式 |
|-------|-----------|
| 地址 | 十六進位格式，長度=42，透過 viem 進行 EIP-55 校驗和驗證 |
| 金額 | 拒絕 NaN、Infinity、負數、零、空值 |
| 鏈 | 嚴格白名單（`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`） |
| 代幣符號 | 最多 20 字元，拒絕注入字元 |
| 聯絡人名稱 | 最多 100 字元，拒絕路徑穿越 |

#### 11. 檔案系統與 RPC 安全

- **原子寫入**：寫入暫存檔案 → 重新命名（防止當機時檔案損毀）
- **0600 權限**：僅擁有者可讀寫敏感檔案
- **路徑穿越防護**：`sanitizePath()` 拒絕資料目錄外的路徑
- **Gas 合理性檢查**：拒絕 0 gas 和超過 30M gas 的估算
- **無金鑰洩漏**：錯誤訊息永遠不包含私鑰或密碼

---

## 功能特色

- **非託管且氣隙隔離** — 金鑰在桌面端，Agent 不持有任何秘密
- **端對端加密** — X25519 + AES-256-GCM，中繼伺服器只能看到密文
- **自動配對** — 一次設定，重新啟動後自動重新連線
- **三級驗證** — 每次重新連線時驗證公鑰 + 裝置指紋 + IP 策略
- **Keystore V3 加密** — AES-256-GCM + scrypt KDF 保護靜態金鑰
- **策略引擎** — 單筆交易和每日支出限額、地址白名單、審批佇列
- **8 條 EVM 鏈** — Ethereum、Base、Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei；可擴展至任意 EVM 鏈
- **子帳戶恢復** — 錢包恢復時自動掃描並找回 BIP-44 衍生帳戶（m/44'/60'/0'/0/{n}）
- **雙重運作模式** — 監督模式（人工審批）或自主模式（限額內自動執行）
- **Agent 聯絡人** — 點對點通訊錄，支援名稱解析
- **餘額監控** — 背景輪詢偵測入帳轉帳
- **交易歷史** — 本地快取完整記錄
- **容器化中繼** — Go 中繼伺服器支援 Docker（Hertz 框架）
- **17 個 MCP 工具** — 為 AI Agent 整合準備的即用型工具定義

---

## 快速開始

### 前置需求

- Node.js ≥ 18
- Go ≥ 1.21（中繼伺服器需要）
- 相容 OpenClaw 的 AI Agent 框架

### 1. 啟動中繼伺服器

```bash
cd server
go run cmd/relay/main.go
# 預設：:8765
```

或使用 Docker：

```bash
cd server
docker compose up -d
```

### 2. 啟動桌面錢包

```bash
cd desktop
npm install
npm run dev
```

### 3. 建立錢包並配對

1. 在桌面應用程式中：設定密碼 → 備份助記詞
2. 點擊「產生配對碼」→ 複製 8 字元代碼
3. 在您的 Agent 中，呼叫 `wallet_pair({ shortCode: "ABCD1234" })`
4. 完成——E2EE 會話已建立，自動重新連線已啟用

### 4. 與您的 Agent 搭配使用

Agent 提供 17 個工具。對話範例：

```
You:    "Send 10 USDC to Bob on Base"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Policy ✓ → E2EE → Desktop signs → Broadcast
        "Sent 10 USDC to Bob. tx: 0xab3f..."
```

---

## 可用工具

| 工具 | 說明 |
|------|-------------|
| **錢包管理** | |
| `wallet_create` | 建立帶有加密金鑰庫的新錢包 |
| `wallet_import` | 透過私鑰匯入現有錢包 |
| `wallet_address` | 取得目前錢包地址 |
| `wallet_pair` | 透過短代碼與桌面錢包配對 |
| **餘額與 Gas** | |
| `wallet_balance` | 查詢 ETH 或 ERC-20 代幣餘額 |
| `wallet_estimate_gas` | 發送前估算 gas 費用 |
| **交易** | |
| `wallet_send` | 發送 ETH 或 ERC-20 代幣（支援聯絡人名稱） |
| `wallet_history` | 查詢分頁交易歷史 |
| **聯絡人** | |
| `wallet_contacts_add` | 新增或更新具有多鏈地址的聯絡人 |
| `wallet_contacts_list` | 列出所有已儲存的聯絡人 |
| `wallet_contacts_resolve` | 依名稱查詢聯絡人地址 |
| `wallet_contacts_remove` | 移除聯絡人 |
| **策略與審批** | |
| `wallet_policy_get` | 檢視目前的安全策略 |
| `wallet_policy_set` | 更新支出限額、白名單或模式 |
| `wallet_approval_list` | 列出待處理的交易審批 |
| `wallet_approval_approve` | 批准排入佇列的交易 |
| `wallet_approval_reject` | 拒絕排入佇列的交易 |

---

## 專案結構

```
wallet/
├── agent/                 # AI Agent framework (TypeScript) — zero secrets
│   ├── index.ts           # ClawWallet class — orchestrates tools & signer
│   ├── e2ee/              # E2EE crypto, WebSocket transport, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, key serialization
│   │   ├── transport.ts   # E2EE WebSocket client with extended handshake
│   │   └── machine-id.ts  # Device fingerprint (SHA256 of hostname:MAC)
│   ├── signer/            # RelaySigner — persistent pairing, auto-reconnect
│   │   ├── relay-client.ts    # Relay connection, deterministic pairId, repair
│   │   ├── ipc-server.ts     # Unix domain socket IPC server
│   │   └── ipc-client.ts     # IPC client for tool → signer communication
│   ├── tools/             # 17 MCP tool definitions
│   └── *.ts               # Policy, contacts, history, monitor, validation
│
├── desktop/               # Electron Desktop Wallet — holds all secrets
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 mnemonic, Keystore V3 encrypt/decrypt
│       │   ├── signing-engine.ts   # Transaction signing with memory zeroing
│       │   ├── relay-bridge.ts     # E2EE relay, three-level verification, session freeze
│       │   ├── security-monitor.ts # IP/device change detection, alerts
│       │   └── lock-manager.ts     # Wallet lock/unlock, idle timeout
│       ├── preload/                # Secure contextBridge (no nodeIntegration)
│       ├── renderer/               # HTML/CSS/JS UI
│       └── shared/
│           └── e2ee-crypto.ts      # Shared E2EE primitives
│
└── server/                # Go Relay Server (Hertz) — stateless forwarder
    ├── cmd/relay/main.go  # Entry point, route setup
    ├── internal/
    │   ├── hub/           # WebSocket hub, IP binding, rate limiting
    │   ├── pairing/       # Short code generation & resolution
    │   ├── middleware/     # CORS, access logging
    │   └── iputil/        # IP extraction utilities
    ├── Dockerfile         # Multi-stage build
    └── docker-compose.yml # One-command deployment
```

---

## 支援的鏈與代幣

| 鏈 | Chain ID | 內建代幣 |
|----|----------|----------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

任何 ERC-20 代幣皆可透過傳入其合約地址使用。鏈可擴展——透過配置即可新增任何 EVM 相容鏈。

---

## 開發

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Docker 部署
cd server && docker compose up --build
```

### 測試套件

| 類別 | 測試內容 |
|----------|---------------|
| **金鑰庫** | 金鑰產生、加密/解密、錯誤密碼、V3 結構 |
| **策略** | 限額、白名單、模式、審批工作流程、整數分位運算 |
| **E2EE** | 金鑰對序列化、確定性 pairId 衍生 |
| **中繼 Hub** | WebSocket 路由、配對 IP 綁定、連線速率限制 |
| **配對** | 短代碼產生、過期、解析 |
| **中介軟體** | CORS 配置、存取記錄 |
| **安全性** | 金鑰熵值、記憶體清除、輸入注入、檔案權限、路徑穿越、RPC 安全 |

---

## 疑難排解

| 問題 | 解決方案 |
|-------|---------|
| 「錢包應用程式離線」 | 確認桌面錢包正在執行並已連線至中繼伺服器 |
| 「配對碼已過期」 | 產生新的代碼（10 分鐘有效期） |
| 簽名請求被封鎖 | 檢查會話是否已凍結（身份不匹配）——如需要請重新配對 |
| IP 變更警告 | 配置 IP 策略：`block` / `warn` / `allow` |
| Agent 無法重新連線 | 使用 `wallet_repair` 清除配對資料並重新配對 |
| 同機器警告 | 將桌面錢包移至單獨的裝置以獲得完整的安全性 |

---

## 授權條款

MIT
