<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <b>繁體中文</b> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Release"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Last Commit"></a>
</p>

<h1 align="center">Claw-Wallet</h1>

<p align="center">
  <b>讓你的 AI Agent 持有一個真正的錢包 -- 安全地。</b><br>
  <i>專為 AI Agent 打造的非託管加密貨幣錢包，具備完整的金鑰隔離機制</i>
</p>

> **不是開發者？** 請造訪 **[janespace-ai.github.io](https://janespace-ai.github.io)** 查看使用者指南 -- 安裝、配對，幾分鐘內即可開始使用。

**Claw-Wallet** 是一款安全的非託管加密貨幣錢包，專為 OpenClaw、Claude Code、Cursor 等 AI Agent 設計。私鑰儲存在獨立的 **Electron 桌面錢包**中，與 AI 模型完全隔離。Agent 與桌面端透過 **Go Relay Server** 建立 **E2EE（端對端加密）** 通道進行通訊 -- Relay 僅轉發密文，永遠無法讀取或竄改訊息。

> **核心安全承諾**：私鑰永遠不會觸及 AI 模型。不在同一台機器上、不在同一個程序中、不在記憶體中。Agent 只能看到錢包地址和交易雜湊值。

## 主要特色

| 特色 | 說明 |
|------|------|
| **完整金鑰隔離** | 金鑰保存在桌面錢包中；Agent 只能看到地址與雜湊值 |
| **多鏈支援** | Ethereum、Base、Arbitrum、Optimism、Polygon、Linea、BSC、Sei |
| **AI Agent 原生支援** | 內建 OpenClaw、Claude Code、Cursor、Codex 等工具 |
| **E2EE 通訊** | X25519 + AES-256-GCM 加密；Relay 只能看到密文 |
| **自動重新連線** | 配對一次，重啟後自動重新連線 |
| **策略引擎** | 單筆交易與每日限額、地址白名單、審批佇列 |
| **桌面端 + CLI** | Electron 桌面應用程式管理金鑰 + CLI 工具供 Agent 使用 |
| **開放原始碼** | MIT 授權 -- 可檢視、修改和貢獻 |

## 4 步驟快速開始

**步驟 1 -- 安裝桌面錢包**

下載最新版本並啟動應用程式。建立錢包、設定密碼，並備份你的助記詞。

| 平台 | 下載 |
|------|------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> 所有版本：[github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="歡迎畫面" />

**步驟 2 -- 連接你的 Agent**

**使用 OpenClaw？** 直接在對話中告訴 OpenClaw：

```
openclaw plugins install @janespace-ai/claw-wallet
```

**使用 Claude Code、Cline、Cursor 或其他 Agent？** 將以下內容貼到你的 Agent 對話中：

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

或透過 CLI 安裝：

```bash
npx skills add janespace-ai/claw-wallet
```

**步驟 3 -- 產生配對碼**

在桌面應用程式中，點選 **「Generate Pairing Code」** 並複製 8 位字元的配對碼。

<img src="screenshots/pair-code-dark.png" width="320" alt="配對碼畫面" />

**步驟 4 -- 開始使用**

將配對碼貼到你的 Agent 中一次即可。之後 Agent 與桌面端會自動重新連線 -- 無需任何操作。

<img src="screenshots/tx-approval-dark.png" width="320" alt="交易審批畫面" />

```
你：   「在 Base 上傳送 10 USDC 給 Bob」
Agent：→ 解析聯絡人 → 建立交易 → E2EE → 桌面端簽署 → 廣播
       「已傳送 10 USDC 給 Bob。tx: 0xab3f...」
```

---

## 架構

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ 零機密資訊   │                               │ 無狀態       │                               │ 持有所有金鑰     │
│ Tool APIs    │                               │ WS 轉發器    │                               │ 本地簽署         │
│ JSON-RPC IPC │                               │ IP 綁定      │                               │ 安全監控         │
│ 17 tools     │                               │ 速率限制     │                               │ 鎖定管理         │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent 永遠無法存取：                                                  桌面端持有：           │
       │  • 私鑰                                                               • BIP-39 助記詞        │
       │  • 助記詞                                                             • Keystore V3 檔案     │
       │  • 金鑰材料                                                           • 簽署引擎             │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**三元件設計**：每個元件各有單一職責。即使 Agent 的主機被完全攻破，攻擊者也無法取得任何金鑰材料。

---

## 使用者互動流程

### 首次設定：配對

僅需進行一次。初始配對完成後，重新連線完全自動化。

```
 你                            桌面錢包                         Relay Server              AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. 建立錢包
    （設定密碼，              產生 BIP-39 助記詞
     備份助記詞）             使用 AES-256-GCM 加密
                              + scrypt KDF
                                    │
 2. 點選「Generate            產生 8 字元配對碼
    Pairing Code」            （有效期限 10 分鐘）
                                    │
 3. 將配對碼複製到 Agent            │                                              Agent 呼叫
    （或透過安全通道                │                                              wallet_pair
    傳送）                          │                                              { shortCode }
                                    │                         ◄──── Agent 以配對碼註冊 ────┘
                                    │
                              桌面端連線 ──────────────────►  Relay 配對匹配
                              X25519 金鑰交換 ◄─────────────► E2EE 工作階段建立
                                    │
                              儲存持久通訊                     Agent 儲存持久
                              金鑰對（加密）                   通訊金鑰對（0600）
                                    │
                              推導確定性                       推導相同的 pairId
                              pairId = SHA256(addr +           = SHA256(addr +
                              agentPubKey)[:16]                agentPubKey)[:16]
                                    │
 配對完成！                   準備簽署                         準備交易
```

### 日常使用：自動重新連線

初始配對完成後，Agent 與桌面端在重啟時會自動重新連線 -- 無需使用者操作。

```
 Agent 重啟                   桌面端重啟
       │                             │
 載入持久通訊                 載入持久通訊
 金鑰對                       金鑰對（使用錢包密碼
 （從磁碟）                   解密）
       │                             │
 重新計算 pairId              重新計算相同的 pairId
       │                             │
 連線至 Relay ────────────────► Relay 依 pairId 路由 ──────────► 桌面端接收
       │                                                             │
 傳送延伸交握：                                               三層驗證：
 • publicKey                                                  Level 1：公鑰與儲存的金鑰匹配
 • machineId                                                  Level 2：machineId 與儲存的 ID 匹配
 • reconnect: true                                            Level 3：IP 變更策略（可設定）
       │                                                             │
 E2EE 工作階段恢復 ◄──────────────────────────────────────── 工作階段啟用
       │                                                             │
 準備交易                                                     準備簽署
```

### 交易流程

```
 你（與 Agent 對話）                 AI Agent                        桌面錢包
──────────────────────────────────────────────────────────────────────────────────────
 「在 Base 上傳送                wallet_send
  0.5 ETH 給 Bob」                to: "bob"（聯絡人）
                                   amount: 0.5
                                   chain: base
                                        │
                                 解析聯絡人 ──────► Bob = 0x742d...
                                 建立交易請求
                                        │
                                 E2EE 加密 ──────────────────────► 解密請求
                                                                       │
                                                                 策略檢查：
                                                                   單筆限額內
                                                                   每日限額內
                                                                   裝置未凍結
                                                                       │
                                                                 解密私鑰
                                                                 簽署交易
                                                                 從記憶體清除金鑰
                                                                 廣播至鏈上
                                                                       │
                                 接收結果 ◄──────────────────────── tx hash + receipt
                                        │
                                 回覆你：
                                 「已傳送 0.5 ETH 給 Bob
                                  tx: 0xab3f...」
```

---

## 安全架構

claw-wallet 採用**縱深防禦**策略，設有兩個獨立的安全域：**通訊安全**（元件之間如何通訊）和**金鑰安全**（金鑰如何儲存與使用）。

### 第 A 部分：通訊安全

#### 1. 端對端加密（E2EE）

Agent 與桌面端之間的所有訊息均經端對端加密。Relay Server 只能看到密文。

| 元件 | 詳情 |
|------|------|
| **金鑰交換** | X25519 ECDH (Curve25519) |
| **金鑰衍生** | HKDF-SHA256 |
| **加密** | AES-256-GCM（認證加密） |
| **防重放** | 每則訊息遞增 nonce |
| **前向保密** | 每次工作階段使用新的臨時金鑰 |

#### 2. 自動配對與重新連線

手動配對僅需進行一次。系統使用**持久通訊金鑰對**和**確定性配對 ID** 實現自動重新連線：

- **持久金鑰對**：X25519 金鑰對儲存至磁碟 -- 桌面端使用錢包密碼加密（scrypt + AES-256-GCM），Agent 端使用檔案權限保護（0600）
- **確定性 PairId**：`SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` -- 雙方獨立計算出相同的 ID，無需協調
- **零互動重連**：重啟時，雙方載入儲存的金鑰，重新計算 pairId，並透過 Relay 自動重新連線

#### 3. 三層重新連線驗證

當 Agent 重新連線時，桌面端在允許任何簽署操作之前會執行三項身份檢查：

| 層級 | 檢查項目 | 失敗動作 |
|------|----------|----------|
| **Level 1**（強制） | 公鑰與儲存的金鑰匹配 | 拒絕 + 強制重新配對 |
| **Level 2**（強制） | machineId 與儲存的 ID 匹配 | 凍結工作階段 + 強制重新配對 |
| **Level 3**（可設定） | IP 位址變更策略 | `block` / `warn`（預設）/ `allow` |

- **machineId**：SHA256(hostname + MAC address) -- 偵測 Agent 是否移至不同的機器
- **工作階段凍結**：偵測到身份不匹配時，所有簽署請求將被封鎖，直到使用者手動重新配對
- **IP 策略**：可依部署環境設定 -- `block` 立即拒絕，`warn` 警告使用者但允許（同子網容許），`allow` 略過檢查

#### 4. Relay 端保護

Go Relay Server 即使無法讀取訊息內容，仍強制執行額外的安全措施：

| 保護機制 | 詳情 |
|----------|------|
| **每個 pairId 的 IP 綁定** | 每組配對同時最多 2 個不同的來源 IP |
| **連線速率限制** | 每個 pairId 每分鐘最多 10 個新 WebSocket 連線 |
| **連線驅逐** | 若第三個客戶端連線至某配對，最舊的連線將被驅逐 |
| **中繼資料記錄** | 連線事件記錄截短的 pairId 以供稽核 |

#### 5. 手動重新配對備援

當自動重新連線失敗時（裝置更換、金鑰損毀等）：

- **Agent 端**：`wallet_repair` RPC 方法清除儲存的配對資料並重設狀態
- **桌面端**：安全面板中的「Re-pair Device」UI 操作
- 雙方產生全新的金鑰對，需要進行新的配對碼交換

### 第 B 部分：金鑰安全

#### 6. 金鑰隔離 -- 金鑰永遠不會觸及 AI 模型

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  無法存取：         │                   │  私鑰僅在           │
│  - 私鑰            │                   │  signTransaction() │
│  - keystore 檔案   │                   │  內部解密           │
│  - 密碼            │                   │  隨即清除           │
└────────────────────┘                   └────────────────────┘
```

Agent 僅透過 Tool APIs 進行互動。沒有任何工具會回傳金鑰材料。

#### 7. 靜態加密 -- Keystore V3

| 元件 | 詳情 |
|------|------|
| **加密演算法** | AES-256-GCM（認證加密） |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **鹽值** | 每次加密 32 位元組隨機值 |
| **IV** | 每次加密 16 位元組隨機值 |
| **認證標籤** | GCM 標籤防止密文竄改 |
| **檔案權限** | 0600（僅擁有者可讀寫） |

#### 8. 記憶體安全

- 私鑰僅在 `signTransaction()` / `signMessage()` 期間解密
- 金鑰緩衝區在 `finally` 區塊中以 `Buffer.fill(0)` 清零 -- 即使簽署拋出例外
- 解密的金鑰材料在記憶體中僅存在毫秒級時間，而非秒級

#### 9. 策略引擎 -- 獨立的支出控制

策略引擎在任何簽署**之前**執行，且無法透過提示注入繞過：

| 控制項目 | 預設值 | 說明 |
|----------|--------|------|
| 單筆交易限額 | $100 | 單筆交易最大金額 |
| 每日限額 | $500 | 滾動式 24 小時累計支出上限 |
| 地址白名單 | 空 | 監督模式下為必填 |
| 運作模式 | 監督模式 | `supervised`（需白名單）或 `autonomous`（僅限額） |
| 審批佇列 | 24 小時過期 | 被封鎖的交易排入佇列等待人工審查 |

**防繞過措施：**
- 整數分（cent）運算，防止浮點精度攻擊
- 白名單比對不區分大小寫
- 加密隨機審批 ID（非連續、不可猜測）

#### 10. 輸入驗證

| 輸入 | 驗證方式 |
|------|----------|
| 地址 | 十六進位格式，長度=42，透過 viem 驗證 EIP-55 校驗和 |
| 金額 | 拒絕 NaN、Infinity、負數、零、空值 |
| 鏈 | 嚴格白名單（`ethereum`、`base`、`linea`、`arbitrum`、`bsc`、`optimism`、`polygon`、`sei`） |
| 代幣符號 | 最多 20 字元，拒絕注入字元 |
| 聯絡人名稱 | 最多 100 字元，拒絕路徑穿越 |

#### 11. 檔案系統與 RPC 安全

- **原子寫入**：先寫入暫存檔 -> 重新命名（防止當機時損毀）
- **0600 權限**：僅擁有者可讀寫敏感檔案
- **路徑穿越防護**：`sanitizePath()` 拒絕資料目錄以外的路徑
- **Gas 合理性檢查**：拒絕 0 gas 和 > 30M gas 的估算值
- **無金鑰洩漏**：錯誤訊息永遠不包含私鑰或密碼

---

## 功能特色

- **非託管且氣隙隔離** -- 金鑰在桌面端，Agent 持有零機密資訊
- **端對端加密** -- X25519 + AES-256-GCM，Relay 只能看到密文
- **自動配對** -- 一次設定，重啟後自動重新連線
- **三層驗證** -- 每次重連時驗證公鑰 + 裝置指紋 + IP 策略
- **Keystore V3 加密** -- AES-256-GCM + scrypt KDF 用於靜態金鑰加密
- **策略引擎** -- 單筆交易與每日支出限額、地址白名單、審批佇列
- **8 條 EVM 鏈** -- Ethereum、Base、Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei；可擴展至任何 EVM 鏈
- **子帳戶復原** -- 錢包還原時掃描並復原衍生帳戶（BIP-44 m/44'/60'/0'/0/{n}）
- **雙運作模式** -- 監督模式（人工審批）或自主模式（限額內自動執行）
- **Agent 聯絡人** -- P2P 通訊錄，支援名稱解析
- **餘額監控** -- 背景輪詢傳入的轉帳
- **交易紀錄** -- 本地快取，包含完整記錄
- **容器化 Relay** -- Go Relay Server 支援 Docker（Hertz 框架）
- **17 個錢包工具** -- 以 [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet) 發佈至 npm，可透過 `npm install @janespace-ai/claw-wallet` 或 `npx skills add janespace-ai/claw-wallet` 安裝
- **國際化（i18n）** -- 桌面應用程式支援英文與簡體中文，可即時切換語言

---

## 快速入門

### 前置需求

- Node.js >= 18
- Go >= 1.21（用於 Relay Server）
- 相容 OpenClaw 的 AI Agent 框架

### 1. 啟動 Relay Server

```bash
cd server
go run cmd/relay/main.go
# 預設埠號：:8765
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

1. 在桌面應用程式中：設定密碼 -> 備份助記詞
2. 點選「Generate Pairing Code」-> 複製 8 字元配對碼
3. 在你的 Agent 中呼叫 `wallet_pair({ shortCode: "ABCD1234" })`
4. 完成 -- E2EE 工作階段已建立，自動重新連線已啟用

### 4. 搭配你的 Agent 使用

提供 17 個工具。對話範例：

```
你：    「在 Base 上傳送 10 USDC 給 Bob」
Agent：  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → 策略通過 → E2EE → 桌面端簽署 → 廣播
        「已傳送 10 USDC 給 Bob。tx: 0xab3f...」
```

---

## 可用工具

| 工具 | 說明 |
|------|------|
| **錢包管理** | |
| `wallet_create` | 建立新錢包並加密 keystore |
| `wallet_import` | 透過私鑰匯入現有錢包 |
| `wallet_address` | 取得目前錢包地址 |
| `wallet_pair` | 透過短代碼與桌面錢包配對 |
| **餘額與 Gas** | |
| `wallet_balance` | 查詢 ETH 或 ERC-20 代幣餘額 |
| `wallet_estimate_gas` | 傳送前估算 gas 費用 |
| **交易** | |
| `wallet_send` | 傳送 ETH 或 ERC-20 代幣（支援聯絡人名稱） |
| `wallet_history` | 查詢分頁交易紀錄 |
| **聯絡人** | |
| `wallet_contacts_add` | 新增或更新聯絡人，支援多鏈地址 |
| `wallet_contacts_list` | 列出所有已儲存的聯絡人 |
| `wallet_contacts_resolve` | 依名稱查詢聯絡人的地址 |
| `wallet_contacts_remove` | 移除聯絡人 |
| **策略與審批** | |
| `wallet_policy_get` | 檢視目前的安全策略 |
| `wallet_policy_set` | 更新支出限額、白名單或模式 |
| `wallet_approval_list` | 列出待審批的交易 |
| `wallet_approval_approve` | 核准佇列中的交易 |
| `wallet_approval_reject` | 駁回佇列中的交易 |

---

## 專案結構

```
wallet/
├── agent/                 # AI Agent 框架（TypeScript）-- 零機密資訊
│   ├── index.ts           # ClawWallet 類別 -- 協調工具與簽署器
│   ├── e2ee/              # E2EE 加密、WebSocket 傳輸、machine-id
│   │   ├── crypto.ts      # X25519、AES-256-GCM、HKDF、金鑰序列化
│   │   ├── transport.ts   # E2EE WebSocket 客戶端，含延伸交握
│   │   └── machine-id.ts  # 裝置指紋（SHA256 of hostname:MAC）
│   ├── signer/            # RelaySigner -- 持久配對、自動重連
│   │   ├── relay-client.ts    # Relay 連線、確定性 pairId、修復
│   │   ├── ipc-server.ts     # Unix domain socket IPC 伺服器
│   │   └── ipc-client.ts     # IPC 客戶端，供 tool → signer 通訊使用
│   ├── tools/             # 17 個錢包工具定義
│   └── *.ts               # 策略、聯絡人、歷史紀錄、監控、驗證
│
├── desktop/               # Electron 桌面錢包 -- 持有所有機密資訊
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 助記詞、Keystore V3 加解密
│       │   ├── signing-engine.ts   # 交易簽署與記憶體清除
│       │   ├── signing-history.ts  # SQLite 支援的交易活動紀錄
│       │   ├── tx-sync-service.ts  # 區塊鏈交易狀態同步
│       │   ├── chain-adapter.ts    # RPC 客戶端，取得交易收據
│       │   ├── database-service.ts # SQLite 連線與結構描述遷移
│       │   ├── price-service.ts    # 多層級價格擷取（Gate.com、CoinGecko）
│       │   ├── balance-service.ts  # 跨鏈代幣餘額彙總
│       │   ├── relay-bridge.ts     # E2EE relay、三層驗證、工作階段凍結
│       │   ├── security-monitor.ts # IP/裝置變更偵測、警示
│       │   └── lock-manager.ts     # 錢包鎖定/解鎖、閒置逾時
│       ├── preload/                # 安全的 contextBridge（無 nodeIntegration）
│       ├── renderer/               # HTML/CSS/JS UI（活動分頁、餘額顯示）
│       └── shared/
│           └── e2ee-crypto.ts      # 共用的 E2EE 基礎加密元件
│
└── server/                # Go Relay Server（Hertz）-- 無狀態轉發器
    ├── cmd/relay/main.go  # 進入點、路由設定
    ├── internal/
    │   ├── hub/           # WebSocket hub、IP 綁定、速率限制
    │   ├── pairing/       # 短代碼產生與解析
    │   ├── middleware/     # CORS、存取記錄
    │   └── iputil/        # IP 擷取工具
    ├── Dockerfile         # 多階段建置
    └── docker-compose.yml # 一鍵部署
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

任何 ERC-20 代幣皆可透過傳入其合約地址來使用。鏈可擴展 -- 透過設定即可新增任何 EVM 相容鏈。

### Web3 網路設定

Agent 與桌面端皆支援自訂 RPC 端點設定，適用於正式環境與本地開發。

#### 正式環境設定

建立 `config.json` 並填入你偏好的 RPC 供應商：

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

#### 本地開發

使用 Hardhat 或 Anvil 進行本地區塊鏈測試：

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

啟動本地節點：

```bash
# Ethereum 模擬（Chain ID: 1）
npx hardhat node --chain-id 1 --port 8545

# Base 模擬（Chain ID: 8453）
npx hardhat node --chain-id 8453 --port 8546
```

詳見 [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) 取得完整的設定指南。

#### 預設行為

若未提供 `chains` 設定，系統將使用 viem 內建的公共 RPC 端點。

---

## 開發

```bash
# Agent（TypeScript）
cd agent && npm install && npm test

# 桌面端（Electron）
cd desktop && npm install && npm run dev

# Relay Server（Go）
cd server && go test ./...

# Docker 部署
cd server && docker compose up --build
```

### 測試套件

| 類別 | 測試項目 |
|------|----------|
| **Keystore** | 金鑰產生、加解密、錯誤密碼、V3 結構 |
| **策略** | 限額、白名單、模式、審批流程、整數分運算 |
| **E2EE** | 金鑰對序列化、確定性 pairId 推導 |
| **Relay Hub** | WebSocket 路由、配對 IP 綁定、連線速率限制 |
| **配對** | 短代碼產生、過期、解析 |
| **中介軟體** | CORS 設定、存取記錄 |
| **安全** | 金鑰熵值、記憶體清除、輸入注入、檔案權限、路徑穿越、RPC 安全 |

---

## 疑難排解

| 問題 | 解決方案 |
|------|----------|
| 「Wallet app offline」 | 確認桌面錢包正在執行且已連線至 Relay |
| 「Pairing code expired」 | 產生新的配對碼（有效期限 10 分鐘） |
| 簽署請求被封鎖 | 檢查工作階段是否被凍結（身份不匹配）-- 如有需要請重新配對 |
| IP 變更警告 | 設定 IP 策略：`block` / `warn` / `allow` |
| Agent 無法重新連線 | 使用 `wallet_repair` 清除配對資料並重新配對 |
| 同一機器警告 | 將桌面錢包移至獨立裝置以獲得完整安全性 |

---

## 國際化（i18n）

桌面應用程式支援多語言，可即時切換語言：

### 支援的語言

- **English (en)** -- 預設語言
- **簡體中文 (zh-CN)** -- Simplified Chinese

### 功能特色

- **自動偵測**：首次啟動時自動偵測系統語言
- **手動切換**：Header 右上角的語言選擇器
- **持久化**：使用者偏好儲存於 localStorage，跨工作階段保留
- **即時更新**：靜態 UI 元素（按鈕、標籤、分頁）立即更新
- **無縫體驗**：語言切換無需重新啟動應用程式

### 架構

```
i18next Framework
├── Translation Files (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # 按鈕、標籤、訊息
│   │   ├── setup.json       # 錢包設定流程
│   │   ├── activity.json    # 交易活動
│   │   ├── security.json    # 安全事件
│   │   ├── settings.json    # 設定面板
│   │   ├── pairing.json     # 裝置配對
│   │   ├── errors.json      # 錯誤訊息
│   │   ├── modals.json      # 審批、匯出、警示對話框
│   │   └── contactsPage.json
│   └── zh-CN/（相同結構；金鑰與 en 保持同步）
│   注意：`npm run build` 會將這些檔案複製至 dist/renderer/locales/ 供 Electron 使用。
├── Language Detection (i18n.js)
│   ├── 1. 檢查 localStorage（使用者偏好）
│   ├── 2. 檢查 navigator.language（系統語言）
│   └── 3. 回退至英文
└── DOM Update System
    ├── data-i18n 屬性用於靜態內容
    └── i18next.t() 用於動態內容
```

### 新增語言

1. 建立翻譯目錄：
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. 從 `en/` 複製並翻譯所有 JSON 檔案：
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # 編輯每個檔案以翻譯值
   ```

3. 在 `index.html` 的語言選擇器中新增語言選項：
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Your Language</option>
   </select>
   ```

4. 如有需要，更新 `i18n.js` 中的命名空間列表

### 翻譯鍵值慣例

使用階層式、語意化命名：

```
namespace.feature.element

範例：
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### 開發者指南

**HTML（靜態內容）**：
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript（動態內容）**：
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**帶插值**：
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// 翻譯：「確定要移除聯絡人「{name}」的所有項目嗎？」
```

---

## 貢獻

我們歡迎貢獻！以下是你可以提供協助的方式：

### 回報問題
- **錯誤回報**：使用 [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues) 頁面
- **功能請求**：提出新功能或改進建議
- **安全漏洞**：請透過電子郵件私下回報（請參閱 GitHub 個人資料）

### 提交 Pull Request
1. **Fork** 此儲存庫
2. **建立分支**：`git checkout -b feature/your-feature`
3. **提交變更**：`git commit -m 'Add some feature'`
4. **推送**：`git push origin feature/your-feature`
5. **開啟 Pull Request**

### 開發環境設定
```bash
# 複製儲存庫
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# 安裝相依套件
npm install

# 建置專案
npm run build

# 執行測試
npm test
```

### 需要協助的領域
- **文件**：改善指南、新增教學、翻譯更多語言
- **新鏈**：新增對其他 EVM 或非 EVM 鏈的支援
- **UI/UX 改進**：增強桌面錢包介面
- **測試**：撰寫單元/整合測試、提升測試覆蓋率

### 程式碼風格
- 使用 **TypeScript** 並啟用嚴格型別檢查
- 遵循 **Prettier** 格式化規則（設定於 `.prettierrc`）
- 撰寫有意義的提交訊息
- 為新功能新增測試

### 加入社群
- **Discord**：[加入我們的伺服器](https://discord.gg/clawd)（即將推出）
- **Twitter**：追蹤 [@janespace_ai](https://twitter.com/janespace_ai) 取得最新消息
- **GitHub Discussions**：發起討論以提出問題或想法

---

## 授權條款

MIT (c) [janespace-ai](https://github.com/janespace-ai)
