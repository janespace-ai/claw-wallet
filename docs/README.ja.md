<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <b>日本語</b> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**AIエージェントに本物のウォレットを — 安全に。**

[OpenClaw](https://getclaw.sh) AIエージェント向けの非カストディアル暗号ウォレット。秘密鍵は独立した**Electronデスクトップウォレット**に保管され、AIモデルから完全に隔離されています。エージェントとデスクトップは**Goリレーサーバー**を介した**E2EE（エンドツーエンド暗号化）**チャネルで通信します。リレーは暗号文を転送するだけで、メッセージを読み取ったり改ざんしたりすることは一切できません。

> 秘密鍵はAIモデルに一切触れません。同じマシン上にも、同じプロセス内にも、メモリ内にも存在しません。エージェントが見るのはウォレットアドレスとトランザクションハッシュだけです。

---

## アーキテクチャ

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ Zero secrets │                               │ Stateless    │                               │ Holds all keys   │
│ Tool APIs    │                               │ WS forwarder │                               │ Signs locally    │
│ JSON-RPC IPC │                               │ IP binding   │                               │ Security monitor │
│ 17 tools     │                               │ Rate limiter │                               │ Lock manager     │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent never sees:                                                        Desktop holds:     │
       │  • private keys                                                           • BIP-39 mnemonic  │
       │  • mnemonics                                                              • Keystore V3 file │
       │  • key material                                                           • Signing engine    │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**3コンポーネント設計**：各コンポーネントは単一の責務を持ちます。エージェントのホストが完全に侵害されたとしても、攻撃者は鍵素材を一切取得できません。

---

## ユーザーインタラクションフロー

### 初回セットアップ：ペアリング

初回のみ必要です。初回ペアリング後は、再接続は完全に自動で行われます。

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

### 日常利用：自動再接続

初回ペアリング後は、エージェントとデスクトップは再起動時に自動的に再接続します — ユーザーの操作は不要です。

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

### トランザクションフロー

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

## セキュリティアーキテクチャ

claw-walletは**多層防御**を採用し、**通信セキュリティ**（コンポーネント間の通信方法）と**鍵セキュリティ**（鍵の保管・使用方法）の2つの独立したセキュリティドメインで構成されています。

### パートA：通信セキュリティ

#### 1. エンドツーエンド暗号化（E2EE）

エージェントとデスクトップ間のすべてのメッセージはエンドツーエンドで暗号化されます。リレーサーバーは暗号文しか見ることができません。

| コンポーネント | 詳細 |
|-----------|--------|
| **鍵交換** | X25519 ECDH (Curve25519) |
| **鍵導出** | HKDF-SHA256 |
| **暗号化** | AES-256-GCM（認証付き） |
| **リプレイ防止** | メッセージごとのインクリメンタルノンス |
| **前方秘匿性** | セッションごとに新しいエフェメラル鍵 |

#### 2. 自動ペアリングと再接続

手動ペアリングは一度だけ必要です。システムは**永続通信鍵ペア**と**決定論的ペアID**を使用して自動再接続を行います：

- **永続鍵ペア**：X25519鍵ペアはディスクに保存されます — デスクトップではウォレットパスワードで暗号化（scrypt + AES-256-GCM）、エージェントではファイルパーミッション保護（0600）
- **決定論的PairId**：`SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — 両側が独立して同じIDを計算し、調整は不要
- **ゼロインタラクション再接続**：再起動時、両側が保存された鍵を読み込み、pairIdを再計算し、リレーを通じて自動的に再接続

#### 3. 3段階再接続検証

エージェントが再接続する際、デスクトップは署名を許可する前に3つのID検証を実行します：

| レベル | 検証内容 | 失敗時のアクション |
|-------|-------|----------------|
| **レベル1**（厳格） | 公開鍵が保存された鍵と一致 | 拒否 + 再ペアリング強制 |
| **レベル2**（厳格） | machineIdが保存されたIDと一致 | セッション凍結 + 再ペアリング強制 |
| **レベル3**（設定可能） | IPアドレス変更ポリシー | `block` / `warn`（デフォルト）/ `allow` |

- **machineId**：SHA256(ホスト名 + MACアドレス) — エージェントが別のマシンに移動したことを検出
- **セッション凍結**：ID不一致が検出された場合、ユーザーが手動で再ペアリングするまですべての署名リクエストがブロックされます
- **IPポリシー**：デプロイメントごとに設定可能 — `block`は即座に拒否、`warn`はユーザーに警告しつつ許可（同一サブネット許容あり）、`allow`はチェックをスキップ

#### 4. リレー側の保護

Goリレーサーバーはメッセージの内容を読み取れませんが、追加のセキュリティを適用します：

| 保護機能 | 詳細 |
|------------|--------|
| **pairIdごとのIPバインディング** | ペアあたり同時に最大2つの異なるソースIP |
| **接続レート制限** | pairIdあたり1分間に最大10のWebSocket新規接続 |
| **接続エビクション** | 3番目のクライアントがペアに接続した場合、最も古い接続が切断される |
| **メタデータログ** | 監査用にトランケートされたpairIdで接続イベントを記録 |

#### 5. 手動再ペアリングフォールバック

自動再接続が失敗した場合（デバイス変更、鍵の破損など）：

- **エージェント側**：`wallet_repair` RPCメソッドが保存されたペアリングデータをクリアし、状態をリセット
- **デスクトップ側**：セキュリティパネルの「Re-pair Device」UIアクション
- 両側で新しい鍵ペアが生成され、新しいペアリングコードの交換が必要

### パートB：鍵セキュリティ

#### 6. 鍵の隔離 — 鍵はAIモデルに一切触れない

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

エージェントはTool APIを通じてのみやり取りします。鍵素材を返すツールは一切ありません。

#### 7. 静止時の暗号化 — Keystore V3

| コンポーネント | 詳細 |
|-----------|--------|
| **暗号方式** | AES-256-GCM（認証付き暗号化） |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **ソルト** | 暗号化ごとにランダム32バイト |
| **IV** | 暗号化ごとにランダム16バイト |
| **認証タグ** | GCMタグが暗号文の改ざんを防止 |
| **ファイルパーミッション** | 0600（所有者のみ読み書き可能） |

#### 8. メモリ安全性

- 秘密鍵は`signTransaction()` / `signMessage()`の実行中にのみ復号されます
- 鍵バッファは`finally`ブロック内で`Buffer.fill(0)`によりゼロクリアされます — 署名中にエラーが発生しても同様
- 復号された鍵素材がメモリに存在するのは数秒ではなく数ミリ秒です

#### 9. ポリシーエンジン — 独立した支出制御

ポリシーエンジンは署名の**前**に実行され、プロンプトインジェクションでバイパスすることはできません：

| 制御 | デフォルト | 説明 |
|---------|---------|-------------|
| トランザクションごとの上限 | $100 | 単一トランザクションの最大金額 |
| 日次上限 | $500 | 24時間ローリング累計支出上限 |
| アドレスホワイトリスト | 空 | 監視モードで必須 |
| 動作モード | 監視 | `supervised`（ホワイトリスト必須）または `autonomous`（上限のみ） |
| 承認キュー | 24時間有効期限 | ブロックされたトランザクションの手動レビュー用キュー |

**バイパス防止対策：**
- 浮動小数点精度攻撃を防ぐための整数セント演算
- 大文字小文字を区別しないホワイトリスト照合
- 暗号学的ランダム承認ID（連番でなく、推測不可能）

#### 10. 入力バリデーション

| 入力 | バリデーション |
|-------|-----------|
| アドレス | 16進数形式、長さ=42、viemによるEIP-55チェックサム |
| 金額 | NaN、Infinity、負数、ゼロ、空を拒否 |
| チェーン | 厳格なホワイトリスト（`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`） |
| トークンシンボル | 最大20文字、インジェクション文字を拒否 |
| コンタクト名 | 最大100文字、パストラバーサルを拒否 |

#### 11. ファイルシステムとRPCの安全性

- **アトミック書き込み**：一時ファイルに書き込み → リネーム（クラッシュ時の破損を防止）
- **0600パーミッション**：所有者のみが機密ファイルの読み書きが可能
- **パストラバーサル防止**：`sanitizePath()`がデータディレクトリ外のパスを拒否
- **ガスの妥当性チェック**：ガス0および3000万超のガス見積もりを拒否
- **鍵の漏洩防止**：エラーメッセージに秘密鍵やパスワードを含めない

---

## 機能

- **非カストディアル＆エアギャップ** — 鍵はデスクトップに、エージェントはゼロシークレット
- **エンドツーエンド暗号化** — X25519 + AES-256-GCM、リレーは暗号文のみ参照
- **自動ペアリング** — 初回セットアップのみ、再起動後は自動再接続
- **3段階検証** — 再接続ごとに公開鍵 + デバイスフィンガープリント + IPポリシー
- **Keystore V3暗号化** — 静止時の鍵にAES-256-GCM + scrypt KDF
- **ポリシーエンジン** — トランザクションごと・日次の支出制限、アドレスホワイトリスト、承認キュー
- **8つのEVMチェーン** — Ethereum、Base、Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei；任意のEVMチェーンに拡張可能
- **サブアカウント復元** — ウォレットリストア時にBIP-44派生アカウント（m/44'/60'/0'/0/{n}）を自動スキャンして復元
- **デュアル動作モード** — 監視（人間が承認）または自律（制限内で自動）
- **エージェントコンタクト** — P2Pアドレス帳と名前解決
- **残高モニタリング** — 受信トランスファーのバックグラウンドポーリング
- **トランザクション履歴** — 完全な記録を持つローカルキャッシュ
- **コンテナ化リレー** — Docker対応のGoリレーサーバー（Hertzフレームワーク）
- **17個のMCPツール** — AIエージェント統合用のすぐに登録可能なツール定義

---

## クイックスタート

### 前提条件

- Node.js ≥ 18
- Go ≥ 1.21（リレーサーバー用）
- OpenClaw互換のAIエージェントフレームワーク

### 1. リレーサーバーの起動

```bash
cd server
go run cmd/relay/main.go
# Default: :8765
```

またはDockerで：

```bash
cd server
docker compose up -d
```

### 2. デスクトップウォレットの起動

```bash
cd desktop
npm install
npm run dev
```

### 3. ウォレットの作成とペアリング

1. デスクトップアプリで：パスワードを設定 → ニーモニックをバックアップ
2. 「Generate Pairing Code」をクリック → 8文字のコードをコピー
3. エージェントで `wallet_pair({ shortCode: "ABCD1234" })` を呼び出す
4. 完了 — E2EEセッションが確立、自動再接続が有効に

### 4. エージェントでの使用

エージェントは17個のツールを提供します。会話例：

```
You:    "Send 10 USDC to Bob on Base"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Policy ✓ → E2EE → Desktop signs → Broadcast
        "Sent 10 USDC to Bob. tx: 0xab3f..."
```

---

## 利用可能なツール

| ツール | 説明 |
|------|-------------|
| **ウォレット管理** | |
| `wallet_create` | 暗号化キーストアで新しいウォレットを作成 |
| `wallet_import` | 秘密鍵で既存のウォレットをインポート |
| `wallet_address` | 現在のウォレットアドレスを取得 |
| `wallet_pair` | ショートコードでデスクトップウォレットとペアリング |
| **残高とガス** | |
| `wallet_balance` | ETHまたはERC-20トークンの残高を照会 |
| `wallet_estimate_gas` | 送信前のガスコストを見積もり |
| **トランザクション** | |
| `wallet_send` | ETHまたはERC-20トークンを送信（コンタクト名対応） |
| `wallet_history` | ページネーション付きトランザクション履歴を照会 |
| **コンタクト** | |
| `wallet_contacts_add` | マルチチェーンアドレスでコンタクトを追加・更新 |
| `wallet_contacts_list` | 保存済みコンタクトの一覧を表示 |
| `wallet_contacts_resolve` | 名前でコンタクトのアドレスを検索 |
| `wallet_contacts_remove` | コンタクトを削除 |
| **ポリシーと承認** | |
| `wallet_policy_get` | 現在のセキュリティポリシーを表示 |
| `wallet_policy_set` | 支出制限、ホワイトリスト、モードを更新 |
| `wallet_approval_list` | 保留中のトランザクション承認一覧 |
| `wallet_approval_approve` | キューに入ったトランザクションを承認 |
| `wallet_approval_reject` | キューに入ったトランザクションを拒否 |

---

## プロジェクト構成

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
│   ├── tools/             # 17 tool definitions
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

## 対応チェーンとトークン

| チェーン | チェーンID | 組み込みトークン |
|---------|----------|----------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

コントラクトアドレスを指定することで任意のERC-20トークンを使用できます。チェーンは拡張可能で、設定を通じて任意のEVM互換チェーンを追加できます。

---

## 開発

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Docker deployment
cd server && docker compose up --build
```

### テストスイート

| カテゴリ | テスト内容 |
|----------|---------------|
| **キーストア** | 鍵の生成、暗号化/復号、パスワード不一致、V3構造 |
| **ポリシー** | 制限、ホワイトリスト、モード、承認ワークフロー、整数セント演算 |
| **E2EE** | 鍵ペアのシリアル化、決定論的pairIdの導出 |
| **リレーハブ** | WebSocketルーティング、ペアIPバインディング、接続レート制限 |
| **ペアリング** | ショートコード生成、有効期限、解決 |
| **ミドルウェア** | CORS設定、アクセスログ |
| **セキュリティ** | 鍵のエントロピー、メモリクリア、入力インジェクション、ファイルパーミッション、パストラバーサル、RPCの安全性 |

---

## トラブルシューティング

| 問題 | 解決策 |
|-------|---------|
| 「Wallet app offline」 | デスクトップウォレットが起動中でリレーに接続されていることを確認 |
| 「Pairing code expired」 | 新しいコードを生成（10分のTTL） |
| 署名リクエストがブロックされる | セッションが凍結されていないか確認（ID不一致） — 必要に応じて再ペアリング |
| IPアドレス変更アラート | IPポリシーを設定：`block` / `warn` / `allow` |
| エージェントが再接続できない | `wallet_repair`でペアリングデータをクリアし再ペアリング |
| 同一マシン警告 | 完全なセキュリティのためにデスクトップウォレットを別のデバイスに移動 |

---

## ライセンス

MIT
