<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <b>日本語</b> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**AIエージェントに、安全な本物のウォレットを。**

[OpenClaw](https://getclaw.sh) AI Agent フレームワーク向け Web3 ウォレットプラグイン。ローカルでセルフホスト、非カストディアルな暗号資産ウォレットで、AI エージェントが資産管理・送金・EVM チェーンとのやり取りを行える一方、秘密鍵は暗号化され LLM から完全に隔離されます。

> 秘密鍵が AI モデルに触れることはありません。エージェントは Tool API 経由で動作し、返すのはアドレスとトランザクションハッシュのみです。

---

## なぜ claw-wallet？

AI エージェントがオンチェーンで動く（取引・支払い・DeFi 戦略）とき、根本的なジレンマがあります：**モデルは「動く」必要があるが、鍵を見てはならない**。claw-wallet は役割の分離でこれを解決します。

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent (LLM)                     │
│                                                             │
│  "Send 10 USDC to Alice on Base"                            │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool APIs   │───▶│ Policy Engine│───▶│ Keystore     │    │
│  │ (16 tools)  │    │ (limits &    │    │ (AES-256-GCM │    │
│  │             │    │  approvals)  │    │  + scrypt)   │    │
│  └─────────────┘    └──────────────┘    └──────┬───────┘    │
│                                                │            │
│                                         sign & broadcast    │
│                                                │            │
│                                         ┌──────▼───────┐    │
│                                         │  EVM Chain   │    │
│                                         │  Base / ETH  │    │
│                                         └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**LLM が参照できるもの：** ウォレットアドレス、残高、トランザクションハッシュ、ポリシー状態。  
**LLM が参照できないもの：** 秘密鍵、ニーモニック、復号された鍵材料。

---

## 主な機能

- **非カストディアル＆ローカル** — 鍵はあなたのマシンで暗号化保存、クラウド依存なし。
- **Keystore V3 暗号化** — AES-256-GCM + scrypt KDF、Ethereum クライアントと同じ標準。
- **ポリシーエンジン** — 1 取引あたり・1 日あたりの支出制限、アドレスホワイトリスト、手動承認キュー。プロンプトインジェクションでエージェントが乗っ取られても、未承認の送金はブロックされます。
- **マルチチェーン EVM** — Base（デフォルト・低 Gas）と Ethereum メインネット。任意の EVM チェーンへ拡張可能。
- **二つの運用モード** — 監視モード（人の承認）と自律モード（制限内で自動実行）。
- **エージェント連絡先** — P2P アドレス帳。エージェント同士でアドレスを共有し、名前で解決。
- **残高モニタリング** — 着金をバックグラウンドでポーリングし、リアルタイム通知。
- **トランザクション履歴** — 送受信の全取引をローカルにキャッシュ。
- **16 個の OpenClaw ツール** — そのまま使えるツール定義で AI エージェントに統合。

---

## ユースケース

### シナリオ 1: 人 → エージェント → 契約 / 機関

あなたがエージェントに「業者への支払い」「NFT ミント」「DeFi プロトコル操作」を指示します。

```
 You (chat)                    Your Agent                        On-chain
─────────────────────────────────────────────────────────────────────────────
 "Pay 50 USDC to the          wallet_contacts_resolve            Uniswap
  Uniswap treasury             → 0x1a9C...                      Treasury
  on Ethereum"                                                   Contract
                               wallet_send                         │
                                 to: 0x1a9C...                     │
                                 amount: 50                        │
                                 token: USDC                       │
                                 chain: ethereum                   │
                                        │                          │
                               Policy Engine checks:               │
                                 ✓ $50 < $100 per-tx limit         │
                                 ✓ Daily total within $500         │
                                 ✓ 0x1a9C in whitelist             │
                                        │                          │
                               Sign → Broadcast ──────────────────▶│
                                        │                          │
                               Return: tx hash 0xab3f...      ✓ Confirmed
```

**典型的な用途：** SaaS の支払い、オンチェーンサービス購入、DeFi プロトコル利用、取引所入金。アドレスホワイトリストで、事前に許可した契約先にしか送金できません。

### シナリオ 2: 人 → エージェント → 別のエージェント

あなたのエージェントが、別の AI エージェントにサービス対価を支払うケース。連絡先機能でアドレスを名前解決します。

```
 You (chat)              Your Agent                   Bob's Agent
──────────────────────────────────────────────────────────────────
 "Send 10 USDC          wallet_contacts_add
  to Bob's agent          name: "bob-agent"
  on Base"                base: 0x742d...
                                │
                         wallet_send
                           to: "bob-agent"     ◄── resolved from contacts
                           amount: 10
                           token: USDC
                           chain: base
                                │
                         Policy ✓ → Sign → Broadcast ──────▶ 0x742d...
                                │                              │
                         tx: 0xef01...                    Bob's monitor
                                                          detects +10 USDC
                                                          notifies Bob's Agent
```

**典型的な用途：** エージェント間の API 利用料・データ購入・協調タスクの報酬。連絡先を使えば、名前を指定するだけで定期送金でき、毎回アドレスを貼る必要はありません。

### シナリオ 3: エージェントの自律運用

エージェントが単体で動き、ポリシー制限内で取引・サービス購入・ポートフォリオ調整を行います。1 取引ごとに人は介在しません。

```
 Agent (autonomous mode)                              On-chain
──────────────────────────────────────────────────────────────────
 Detects: ETH price dropped 5%
 Decision: Buy opportunity

 wallet_balance → 500 USDC available
 wallet_estimate_gas → 0.0001 ETH

 wallet_send
   to: 0xDEX_ROUTER         (whitelisted)
   amount: 200
   token: USDC
   chain: base
         │
 Policy Engine:
   ✓ $200 > $100 per-tx limit  ← BLOCKED
   → Queued for approval (id: a3f8...)

 ─── Option A: Raise limits ───
 wallet_policy_set
   perTransactionLimitUsd: 300
   mode: "autonomous"

 Re-send → Policy ✓ → Sign → Broadcast → Confirmed

 ─── Option B: Human approves ───
 wallet_approval_approve("a3f8...")
 → Sign → Broadcast → Confirmed
```

**典型的な用途：** DeFi イールドファーミング、自動売買、定期購読の支払い、リバランス。ポリシーエンジンが**安全レール**となり、完全自律のエージェントも設定可能な支出範囲内でしか動きません。

### モード比較

| | 監視モード | 自律モード |
|---|---|---|
| **決定者** | ホワイトリスト外の取引は人が承認 | 制限内でエージェントが決定 |
| **ホワイトリスト** | 必須（リスト外はブロック） | 不要（制限内なら任意アドレス可） |
| **支出制限** | 1 取引・1 日制限を適用 | 同左 |
| **向いている用途** | 高額ウォレット、信頼構築期 | 日常運用、トレードボット |
| **制限超過時** | キュー → 人が承認/拒否 | キュー → 人が承認/拒否 |

---

## クイックスタート

### インストール

```bash
npm install claw-wallet
```

### 基本的な使い方

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();

// OpenClaw エージェントに 16 ツールを登録
const tools = wallet.getTools();

// ... エージェントがツールで送受信・管理 ...

// 終了時：履歴・連絡先・ポリシーをディスクに保存
await wallet.shutdown();
```

---

## 動作の流れ

### トランザクションの流れ

エージェントの意図からオンチェーン確定までの流れ：

```
  Agent says: "Send 0.5 ETH to Bob on Base"
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. Input Validation                │  Address format, amount range,
  │     validateAddress / validateAmount │  chain whitelist, token symbol
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. Recipient Resolution            │  "Bob" → contacts lookup
  │     Contact name or 0x address      │  → 0x742d...4a (on Base)
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  3. Balance Check                   │  ETH balance ≥ amount + gas?
  │     getBalance + estimateGas        │  ERC-20: token balance + ETH for gas
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  4. Policy Check                    │  ✓ Within per-tx limit ($100)?
  │     PolicyEngine.checkTransaction   │  ✓ Within daily limit ($500)?
  │                                     │  ✓ Address whitelisted (supervised)?
  │     Blocked? → Queue for approval   │  → approval ID returned
  │     Allowed? → Continue ↓           │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  5. Sign Transaction                │  Decrypt key (scrypt + AES-256-GCM)
  │     Keystore → decrypt → sign       │  Sign tx with viem
  │     → immediately clear key buffer  │  Zero key in memory in finally{}
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  6. Broadcast & Confirm             │  Send raw tx to RPC
  │     broadcastTransaction            │  Wait for receipt
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  7. Record & Return                 │  Save to local history
  │     TransactionHistory.addRecord    │  Return: { hash, status, gasUsed }
  └─────────────────────────────────────┘
```

### 承認フロー（監視モード）

制限超過やホワイトリスト外アドレスへの送金時：

```
  Agent → wallet_send → Policy blocks → approval ID returned
                                              │
              ┌───────────────────────────────┘
              ▼
  Human reviews:  wallet_approval_list  →  see pending tx details
                  wallet_approval_approve(id)  →  tx executes
                  wallet_approval_reject(id)   →  tx cancelled
                  (auto-expires after 24h if no action)
```

---

## 利用可能なツール

claw-wallet が提供する 16 ツール：

| Tool | Description |
|------|-------------|
| **Wallet Management** | |
| `wallet_create` | Create a new wallet with encrypted keystore |
| `wallet_import` | Import existing wallet via private key |
| `wallet_address` | Get current wallet address (no decryption needed) |
| **Balance & Gas** | |
| `wallet_balance` | Query ETH or ERC-20 token balance |
| `wallet_estimate_gas` | Estimate transaction gas cost |
| **Transactions** | |
| `wallet_send` | Send ETH or ERC-20 tokens (supports contact names) |
| `wallet_history` | Query paginated transaction history |
| **Contacts** | |
| `wallet_contacts_add` | Add or update a contact with multi-chain addresses |
| `wallet_contacts_list` | List all saved contacts |
| `wallet_contacts_resolve` | Look up a contact's address by name |
| `wallet_contacts_remove` | Remove a contact |
| **Policy & Approvals** | |
| `wallet_policy_get` | View current security policy |
| `wallet_policy_set` | Update spending limits, whitelist, or mode |
| `wallet_approval_list` | List pending transaction approvals |
| `wallet_approval_approve` | Approve a queued transaction |
| `wallet_approval_reject` | Reject a queued transaction |

---

## セキュリティモデル

claw-wallet は**多層防御**で設計されています。

### 1. 鍵の隔離 — 鍵は LLM に触れない

Agent は Tool API 経由でのみ操作し、鍵材料を返すツールはありません。`wallet_create` でさえ返すのはアドレスのみです。

### 2. 保管時の暗号化 — Keystore V3

| Component | Detail |
|-----------|--------|
| **Cipher** | AES-256-GCM (authenticated encryption) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes random per encryption |
| **IV** | 16 bytes random per encryption |
| **Auth Tag** | GCM tag prevents ciphertext tampering |
| **File Permissions** | 0600 (owner read/write only) |

### 3. メモリ安全

秘密鍵は `signTransaction()` / `signMessage()` の実行中のみ復号され、`finally` でバッファをゼロクリアします。

### 4. ポリシーエンジン

署名の前に必ず実行され、プロンプトインジェクションでは迂回できません。単一取引・1 日あたりの制限、ホワイトリスト、24 時間で失効する承認キュー。金額は**整数セント**で扱い浮動小数点攻撃を防止し、承認 ID は暗号論的乱数です。

### 5. 入力検証

アドレス・金額・チェーン・トークンシンボル・連絡先名・Keystore JSON をすべて検証し、パストラバーサルや不正な KDF パラメータを拒否します。

### 6. ファイルシステム

原子書き込み（一時ファイル → リネーム）、0600 パーミッション、データディレクトリ外へのパス拒否。

### 7. RPC 安全

負の残高は 0 扱い、Gas は 0 および 30M 超を拒否。エラーメッセージに秘密鍵・パスワードは含めません。

---

## 設定

```typescript
const wallet = new ClawWallet({
  dataDir: "~/.openclaw/wallet",
  defaultChain: "base",
  chains: {
    base: { rpcUrl: "https://your-base-rpc.com" },
    ethereum: { rpcUrl: "https://your-eth-rpc.com" },
  },
  password: process.env.WALLET_PASSWORD,
  pollIntervalMs: 30_000,
  onBalanceChange: (event) => {
    console.log(`${event.direction}: ${event.difference} ${event.token} on ${event.chain}`);
  },
});
```

---

## データ保存

すべてローカルに保存（クラウド送信なし）：

```
~/.openclaw/wallet/
├── keystore.json    # Encrypted private key (Keystore V3, chmod 0600)
├── contacts.json    # Agent contacts address book
├── history.json     # Transaction history cache
└── policy.json      # Security policy & approval queue
```

---

## 対応チェーン・トークン

| Chain | Chain ID | Default RPC | Built-in Tokens |
|-------|----------|-------------|-----------------|
| Base | 8453 | Public Base RPC | USDC, USDT |
| Ethereum | 1 | Public Ethereum RPC | USDC, USDT |

ERC-20 は契約アドレスを指定すれば利用可能。チェーンは設定で拡張できます。

---

## アーキテクチャ

`src/` に `index.ts`（ClawWallet）、`keystore.ts`、`chain.ts`、`transfer.ts`、`policy.ts`、`contacts.ts`、`history.ts`、`monitor.ts`、`validation.ts`、および `tools/` 配下の 16 ツール定義。ブロックチェーン用は [viem](https://viem.sh) のみ、暗号は Node.js 標準の `node:crypto` を使用。

---

## 開発

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

機能テスト（keystore / chain / contacts / history / policy / E2E）とセキュリティテスト（鍵・入力・ポリシー・ファイル・RPC）を実施しています。

---

## 要件

- Node.js ≥ 18
- OpenClaw 互換の AI エージェントフレームワーク（または Tool 定義をサポートするフレームワーク）

---

## ライセンス

MIT
