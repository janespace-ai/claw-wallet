<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <b>日本語</b> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Release"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Last Commit"></a>
</p>

<h1 align="center">Claw-Wallet</h1>

<p align="center">
  <b>AI Agent に本物のウォレットを -- 安全に。</b><br>
  <i>AI Agent 向けの完全な鍵分離を実現するノンカストディアル暗号ウォレット</i>
</p>

> **開発者でない方へ** ユーザーガイドは **[janespace-ai.github.io](https://janespace-ai.github.io)** をご覧ください。インストール、ペアリング、利用開始までの手順を数分で確認できます。

**Claw-Wallet** は、OpenClaw、Claude Code、Cursor などの AI Agent 向けに設計された、安全なノンカストディアル暗号ウォレットです。秘密鍵は独立した **Electron Desktop Wallet** に保管され、AI モデルから完全に分離されています。Agent と Desktop は **Go Relay Server** を経由した **E2EE（エンドツーエンド暗号化）** チャネルで通信します。Relay は暗号文を転送するだけで、メッセージの読み取りや改ざんは一切できません。

> **セキュリティの基本原則**: 秘密鍵は AI モデルに一切触れません。同一マシン上にも、同一プロセス内にも、メモリ上にも存在しません。Agent が参照できるのはウォレットアドレスとトランザクションハッシュのみです。

## 主な特徴

| 特徴 | 説明 |
|------|------|
| **完全な鍵分離** | 鍵は Desktop Wallet 内に保管。Agent はアドレスとハッシュのみ参照可能 |
| **マルチチェーン対応** | Ethereum、Base、Arbitrum、Optimism、Polygon、Linea、BSC、Sei |
| **AI Agent ネイティブ** | OpenClaw、Claude Code、Cursor、Codex など向けのツールを内蔵 |
| **E2EE 通信** | X25519 + AES-256-GCM 暗号化。Relay は暗号文のみを参照 |
| **自動再接続** | 一度ペアリングすれば、再起動後も自動で再接続 |
| **ポリシーエンジン** | トランザクション単位・日次の上限、アドレスホワイトリスト、承認キュー |
| **Desktop + CLI** | 鍵管理用の Electron デスクトップアプリ + Agent 用の CLI ツール |
| **オープンソース** | MIT ライセンス -- 検証、改変、コントリビュート自由 |

## 4ステップで始める

**ステップ 1 -- Desktop Wallet をインストール**

最新リリースをダウンロードしてアプリを起動します。ウォレットを作成し、パスワードを設定して、ニーモニックをバックアップしてください。

| プラットフォーム | ダウンロード |
|------------------|-------------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> 全リリース一覧: [github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="Welcome screen" />

**ステップ 2 -- Agent を接続**

**OpenClaw をお使いの場合** チャットで直接指示してください:

```
openclaw plugins install @janespace-ai/claw-wallet
```

**Claude Code、Cline、Cursor、その他の Agent をお使いの場合** 以下を Agent のチャットに貼り付けてください:

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

または CLI でインストール:

```bash
npx skills add janespace-ai/claw-wallet
```

**ステップ 3 -- ペアリングコードを生成**

デスクトップアプリで **"Generate Pairing Code"** をクリックし、8文字のコードをコピーします。

<img src="screenshots/pair-code-dark.png" width="320" alt="Pairing code screen" />

**ステップ 4 -- 使い始める**

ペアリングコードを Agent に一度だけ貼り付けます。以降は Agent と Desktop が自動的に再接続するため、ユーザーの操作は不要です。

<img src="screenshots/tx-approval-dark.png" width="320" alt="Transaction approval screen" />

```
あなた:  「Base で Bob に 10 USDC 送って」
Agent:   → 連絡先を解決 → tx を構築 → E2EE → Desktop が署名 → ブロードキャスト
         「Bob に 10 USDC を送信しました。tx: 0xab3f...」
```

---

## アーキテクチャ

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ 秘密情報なし │                               │ ステートレス │                               │ 全鍵を保管       │
│ Tool APIs    │                               │ WS 転送のみ  │                               │ ローカル署名     │
│ JSON-RPC IPC │                               │ IP バインド   │                               │ セキュリティ監視 │
│ 17 tools     │                               │ レート制限    │                               │ ロック管理       │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent は以下にアクセス不可:                                             Desktop が保管:      │
       │  ・秘密鍵                                                              ・BIP-39 ニーモニック │
       │  ・ニーモニック                                                        ・Keystore V3 ファイル│
       │  ・鍵素材                                                              ・署名エンジン        │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**3コンポーネント設計**: 各コンポーネントは単一の責務を持ちます。Agent のホストが完全に侵害されても、攻撃者は鍵素材を一切入手できません。

---

## ユーザーインタラクションフロー

### 初回セットアップ: ペアリング

初回のみ必要です。ペアリング後の再接続は完全に自動化されています。

```
 あなた                       Desktop Wallet                 Relay Server              AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. ウォレット作成
    （パスワード設定、         BIP-39 ニーモニック生成
     ニーモニックバックアップ） AES-256-GCM + scrypt KDF
                              で暗号化
                                    │
 2. 「Generate Pairing        8文字のペアリングコード
    Code」をクリック           を生成（有効期限10分）
                                    │
 3. コードを Agent に               │                                              Agent が
    コピー（またはセキュア          │                                              wallet_pair
    な経路で送信）                  │                                              { shortCode } を呼出
                                    │                         ◄──── Agent がコードで ────┘
                                    │                               登録
                              Desktop が接続 ────────────►    Relay がペアをマッチ
                              X25519 鍵交換 ◄─────────►       E2EE セッション確立
                                    │
                              永続通信鍵ペアを保存            Agent が永続通信鍵
                              （暗号化済み）                  ペアを保存（0600）
                                    │
                              決定論的 pairId を導出          同一の pairId を導出
                              pairId = SHA256(addr +          = SHA256(addr +
                              agentPubKey)[:16]               agentPubKey)[:16]
                                    │
 ペアリング完了！             署名準備完了                    取引準備完了
```

### 日常利用: 自動再接続

初回ペアリング後、Agent と Desktop は再起動時に自動的に再接続します。ユーザー操作は不要です。

```
 Agent 再起動                 Desktop 再起動
       │                             │
 永続通信鍵ペアを              永続通信鍵ペアを
 ディスクから読込              読込（ウォレット
                              パスワードで復号）
       │                             │
 pairId を再計算               同一の pairId を再計算
       │                             │
 Relay に接続 ──────────►      Relay が pairId で     ──────► Desktop が受信
                              ルーティング
       │                                                             │
 拡張ハンドシェイクを送信:                                    3段階認証:
 ・publicKey                                                  Level 1: 公開鍵が保存済みの鍵と一致
 ・machineId                                                  Level 2: machineId が保存済みの ID と一致
 ・reconnect: true                                            Level 3: IP 変更ポリシー（設定可能）
       │                                                             │
 E2EE セッション復元 ◄──────────────────────────────────── セッション有効
       │                                                             │
 取引準備完了                                                 署名準備完了
```

### トランザクションフロー

```
 あなた（Agent とチャット）           AI Agent                        Desktop Wallet
──────────────────────────────────────────────────────────────────────────────────────
 「Base で Bob に 0.5 ETH         wallet_send
  を送って」                        to: "bob"（連絡先）
                                   amount: 0.5
                                   chain: base
                                        │
                                 連絡先を解決 ──► Bob = 0x742d...
                                 tx リクエストを構築
                                        │
                                 E2EE 暗号化 ──────────────────► リクエストを復号
                                                                       │
                                                                 ポリシーチェック:
                                                                   トランザクション上限内
                                                                   日次上限内
                                                                   デバイス凍結なし
                                                                       │
                                                                 秘密鍵を復号
                                                                 トランザクションに署名
                                                                 メモリから鍵をゼロクリア
                                                                 チェーンにブロードキャスト
                                                                       │
                                 結果を受信 ◄────────────────── tx ハッシュ + レシート
                                        │
                                 あなたに返答:
                                 「Bob に 0.5 ETH を送信
                                  しました。tx: 0xab3f...」
```

---

## セキュリティアーキテクチャ

claw-wallet は **多層防御** を採用し、**通信セキュリティ**（コンポーネント間の通信方式）と**鍵セキュリティ**（鍵の保管・使用方法）の2つの独立したセキュリティドメインで構成されています。

### パート A: 通信セキュリティ

#### 1. エンドツーエンド暗号化 (E2EE)

Agent と Desktop 間の全メッセージはエンドツーエンドで暗号化されます。Relay サーバーは暗号文のみを参照します。

| コンポーネント | 詳細 |
|---------------|------|
| **鍵交換** | X25519 ECDH (Curve25519) |
| **鍵導出** | HKDF-SHA256 |
| **暗号化** | AES-256-GCM（認証付き） |
| **リプレイ防止** | メッセージごとのインクリメンタルnonce |
| **前方秘匿性** | セッションごとに新しいエフェメラル鍵 |

#### 2. 自動ペアリングと再接続

手動ペアリングは一度だけ必要です。システムは **永続通信鍵ペア** と **決定論的ペア ID** を使用して自動再接続を実現します:

- **永続鍵ペア**: X25519 鍵ペアはディスクに保存されます。Desktop 側ではウォレットパスワードで暗号化（scrypt + AES-256-GCM）、Agent 側ではファイルパーミッション（0600）で保護
- **決定論的 PairId**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` -- 両側が独立して同一の ID を計算するため、調整不要
- **操作不要の再接続**: 再起動時、両側が保存済みの鍵を読み込み、pairId を再計算して Relay 経由で自動的に再接続

#### 3. 3段階の再接続認証

Agent が再接続する際、Desktop は署名を許可する前に3つの本人確認を行います:

| レベル | チェック内容 | 失敗時の動作 |
|--------|-------------|-------------|
| **Level 1**（厳格） | 公開鍵が保存済みの鍵と一致 | 拒否 + 再ペアリングを強制 |
| **Level 2**（厳格） | machineId が保存済みの ID と一致 | セッション凍結 + 再ペアリングを強制 |
| **Level 3**（設定可能） | IP アドレス変更ポリシー | `block` / `warn`（デフォルト） / `allow` |

- **machineId**: SHA256(hostname + MAC address) -- Agent が別のマシンに移動したことを検出
- **セッション凍結**: 本人確認の不一致が検出されると、ユーザーが手動で再ペアリングするまで全ての署名リクエストがブロック
- **IP ポリシー**: デプロイ環境ごとに設定可能 -- `block` は即座に拒否、`warn` はユーザーに警告して許可（同一サブネット許容あり）、`allow` はチェックをスキップ

#### 4. Relay 側の保護

Go Relay Server はメッセージ内容を読み取れませんが、追加のセキュリティを強制します:

| 保護機能 | 詳細 |
|----------|------|
| **pairId ごとの IP バインド** | ペアあたり同時に最大2つの送信元 IP |
| **接続レート制限** | pairId あたり毎分最大10件の新規 WebSocket 接続 |
| **接続エビクション** | 3番目のクライアントがペアに接続すると、最も古い接続を切断 |
| **メタデータログ** | 監査用にペアID（短縮）付きで接続イベントをログ記録 |

#### 5. 手動再ペアリングフォールバック

自動再接続が失敗した場合（デバイス変更、鍵破損など）:

- **Agent 側**: `wallet_repair` RPC メソッドで保存済みペアリングデータをクリアしてリセット
- **Desktop 側**: セキュリティパネルの「Re-pair Device」UI アクション
- 両側が新しい鍵ペアを生成し、新しいペアリングコードの交換が必要

### パート B: 鍵セキュリティ

#### 6. 鍵分離 -- 鍵は AI モデルに一切触れない

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  アクセス不可:      │                   │  秘密鍵は          │
│  ・秘密鍵          │                   │  signTransaction() │
│  ・keystore ファイル │                   │  内部でのみ復号    │
│  ・パスワード       │                   │  後にゼロクリア    │
└────────────────────┘                   └────────────────────┘
```

Agent は Tool API のみを通じてやり取りします。鍵素材を返すツールは一切ありません。

#### 7. 保存時の暗号化 -- Keystore V3

| コンポーネント | 詳細 |
|---------------|------|
| **暗号方式** | AES-256-GCM（認証付き暗号化） |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **ソルト** | 暗号化ごとにランダム32バイト |
| **IV** | 暗号化ごとにランダム16バイト |
| **認証タグ** | GCM タグにより暗号文の改ざんを防止 |
| **ファイル権限** | 0600（オーナーのみ読み書き可能） |

#### 8. メモリ安全性

- 秘密鍵は `signTransaction()` / `signMessage()` の実行中にのみ復号
- 鍵バッファは `finally` ブロック内で `Buffer.fill(0)` によりゼロクリア -- 署名中に例外が発生しても確実に実行
- 復号された鍵素材がメモリに存在するのはミリ秒単位であり、秒単位ではない

#### 9. ポリシーエンジン -- 独立した支出制御

ポリシーエンジンは署名の**前に**実行され、プロンプトインジェクションでは回避できません:

| 制御項目 | デフォルト | 説明 |
|---------|-----------|------|
| トランザクション上限 | $100 | 単一トランザクションの最大金額 |
| 日次上限 | $500 | 24時間ローリング累計の支出上限 |
| アドレスホワイトリスト | 空 | 監督モードでは必須 |
| 動作モード | Supervised | `supervised`（ホワイトリスト必須）または `autonomous`（上限のみ） |
| 承認キュー | 24時間有効 | ブロックされたトランザクションを手動レビュー用にキューイング |

**バイパス防止策:**
- 浮動小数点精度攻撃を防ぐ整数セント演算
- 大文字小文字を区別しないホワイトリスト照合
- 暗号学的にランダムな承認 ID（連番でなく、推測不可能）

#### 10. 入力バリデーション

| 入力 | バリデーション |
|------|---------------|
| アドレス | 16進数形式、長さ=42、EIP-55 チェックサム（viem による検証） |
| 金額 | NaN、Infinity、負数、ゼロ、空文字を拒否 |
| チェーン | 厳格なホワイトリスト（`ethereum`、`base`、`linea`、`arbitrum`、`bsc`、`optimism`、`polygon`、`sei`） |
| トークンシンボル | 最大20文字、インジェクション文字を拒否 |
| 連絡先名 | 最大100文字、パストラバーサルを拒否 |

#### 11. ファイルシステムと RPC の安全性

- **アトミック書き込み**: 一時ファイルに書き込み後にリネーム（クラッシュ時の破損を防止）
- **0600 パーミッション**: オーナーのみが機密ファイルを読み書き可能
- **パストラバーサル防止**: `sanitizePath()` がデータディレクトリ外のパスを拒否
- **ガスのサニティチェック**: ガス見積もり 0 および 3000万超を拒否
- **鍵漏洩なし**: エラーメッセージに秘密鍵やパスワードを含めない

---

## 機能一覧

- **ノンカストディアルかつエアギャップ** -- 鍵は Desktop に保管、Agent は秘密情報をゼロ保持
- **エンドツーエンド暗号化** -- X25519 + AES-256-GCM、Relay は暗号文のみ参照
- **自動ペアリング** -- 初回のみセットアップ、再起動後は自動再接続
- **3段階認証** -- 再接続ごとに公開鍵 + デバイスフィンガープリント + IP ポリシーで検証
- **Keystore V3 暗号化** -- 保存時の鍵に AES-256-GCM + scrypt KDF
- **ポリシーエンジン** -- トランザクション単位・日次の支出上限、アドレスホワイトリスト、承認キュー
- **8つの EVM チェーン** -- Ethereum、Base、Linea、Arbitrum、BNB Chain、Optimism、Polygon、Sei。任意の EVM チェーンに拡張可能
- **サブアカウントリカバリ** -- ウォレット復元時に派生アカウント（BIP-44 m/44'/60'/0'/0/{n}）をスキャンして復元
- **2つの動作モード** -- Supervised（人間が承認）または Autonomous（上限内で自律）
- **Agent 連絡先** -- 名前解決機能付きの P2P アドレス帳
- **残高モニタリング** -- 着金をバックグラウンドでポーリング
- **トランザクション履歴** -- 完全な記録を持つローカルキャッシュ
- **コンテナ化された Relay** -- Docker 対応の Go Relay Server（Hertz フレームワーク）
- **17のウォレットツール** -- [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet) として npm に公開。`npm install @janespace-ai/claw-wallet` または `npx skills add janespace-ai/claw-wallet` でインストール可能
- **国際化 (i18n)** -- デスクトップアプリは英語と簡体字中国語に対応し、実行時の言語切り替えが可能

---

## クイックスタート

### 前提条件

- Node.js >= 18
- Go >= 1.21（Relay Server 用）
- OpenClaw 互換の AI Agent フレームワーク

### 1. Relay Server を起動

```bash
cd server
go run cmd/relay/main.go
# デフォルト: :8765
```

Docker を使用する場合:

```bash
cd server
docker compose up -d
```

### 2. Desktop Wallet を起動

```bash
cd desktop
npm install
npm run dev
```

### 3. ウォレットを作成してペアリング

1. Desktop アプリで: パスワード設定 → ニーモニックバックアップ
2. 「Generate Pairing Code」をクリック → 8文字のコードをコピー
3. Agent で `wallet_pair({ shortCode: "ABCD1234" })` を呼び出す
4. 完了 -- E2EE セッションが確立され、自動再接続が有効に

### 4. Agent で利用開始

17のツールが利用可能です。会話例:

```
あなた:  「Base で Bob に 10 USDC 送って」
Agent:   wallet_contacts_resolve("bob") → 0x742d...
         wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
         → Policy OK → E2EE → Desktop が署名 → ブロードキャスト
         「Bob に 10 USDC を送信しました。tx: 0xab3f...」
```

---

## 利用可能なツール

| ツール | 説明 |
|--------|------|
| **ウォレット管理** | |
| `wallet_create` | 暗号化された keystore で新しいウォレットを作成 |
| `wallet_import` | 秘密鍵で既存のウォレットをインポート |
| `wallet_address` | 現在のウォレットアドレスを取得 |
| `wallet_pair` | ショートコードで Desktop Wallet とペアリング |
| **残高とガス** | |
| `wallet_balance` | ETH または ERC-20 トークンの残高を照会 |
| `wallet_estimate_gas` | 送信前のガスコストを見積もり |
| **トランザクション** | |
| `wallet_send` | ETH または ERC-20 トークンを送信（連絡先名に対応） |
| `wallet_history` | ページ分割されたトランザクション履歴を照会 |
| **連絡先** | |
| `wallet_contacts_add` | マルチチェーンアドレス付きの連絡先を追加・更新 |
| `wallet_contacts_list` | 保存済みの全連絡先を一覧表示 |
| `wallet_contacts_resolve` | 名前から連絡先のアドレスを検索 |
| `wallet_contacts_remove` | 連絡先を削除 |
| **ポリシーと承認** | |
| `wallet_policy_get` | 現在のセキュリティポリシーを表示 |
| `wallet_policy_set` | 支出上限、ホワイトリスト、モードを更新 |
| `wallet_approval_list` | 保留中のトランザクション承認を一覧表示 |
| `wallet_approval_approve` | キューイングされたトランザクションを承認 |
| `wallet_approval_reject` | キューイングされたトランザクションを拒否 |

---

## プロジェクト構成

```
wallet/
├── agent/                 # AI Agent フレームワーク (TypeScript) -- 秘密情報なし
│   ├── index.ts           # ClawWallet クラス -- ツールとサイナーのオーケストレーション
│   ├── e2ee/              # E2EE 暗号、WebSocket トランスポート、machine-id
│   │   ├── crypto.ts      # X25519、AES-256-GCM、HKDF、鍵シリアライゼーション
│   │   ├── transport.ts   # 拡張ハンドシェイク付き E2EE WebSocket クライアント
│   │   └── machine-id.ts  # デバイスフィンガープリント (SHA256 of hostname:MAC)
│   ├── signer/            # RelaySigner -- 永続ペアリング、自動再接続
│   │   ├── relay-client.ts    # Relay 接続、決定論的 pairId、repair
│   │   ├── ipc-server.ts     # Unix domain socket IPC サーバー
│   │   └── ipc-client.ts     # ツール → サイナー通信用 IPC クライアント
│   ├── tools/             # 17のウォレットツール定義
│   └── *.ts               # ポリシー、連絡先、履歴、モニター、バリデーション
│
├── desktop/               # Electron Desktop Wallet -- 全秘密情報を保管
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 ニーモニック、Keystore V3 暗号化/復号
│       │   ├── signing-engine.ts   # メモリゼロクリア付きトランザクション署名
│       │   ├── signing-history.ts  # SQLite によるトランザクション活動履歴
│       │   ├── tx-sync-service.ts  # ブロックチェーンのトランザクションステータス同期
│       │   ├── chain-adapter.ts    # トランザクションレシート用 RPC クライアント
│       │   ├── database-service.ts # SQLite 接続とスキーママイグレーション
│       │   ├── price-service.ts    # マルチティア価格取得 (Gate.com, CoinGecko)
│       │   ├── balance-service.ts  # チェーン横断のトークン残高集約
│       │   ├── relay-bridge.ts     # E2EE relay、3段階認証、セッション凍結
│       │   ├── security-monitor.ts # IP/デバイス変更検出、アラート
│       │   └── lock-manager.ts     # ウォレットのロック/アンロック、アイドルタイムアウト
│       ├── preload/                # セキュアな contextBridge（nodeIntegration 無効）
│       ├── renderer/               # HTML/CSS/JS UI（Activity Tab、残高表示）
│       └── shared/
│           └── e2ee-crypto.ts      # 共有 E2EE プリミティブ
│
└── server/                # Go Relay Server (Hertz) -- ステートレス転送
    ├── cmd/relay/main.go  # エントリーポイント、ルート設定
    ├── internal/
    │   ├── hub/           # WebSocket ハブ、IP バインド、レート制限
    │   ├── pairing/       # ショートコード生成と解決
    │   ├── middleware/     # CORS、アクセスログ
    │   └── iputil/        # IP 抽出ユーティリティ
    ├── Dockerfile         # マルチステージビルド
    └── docker-compose.yml # ワンコマンドデプロイ
```

---

## 対応チェーンとトークン

| チェーン | Chain ID | 組み込みトークン |
|---------|----------|-----------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

コントラクトアドレスを指定することで、任意の ERC-20 トークンを利用できます。チェーンは拡張可能で、設定により任意の EVM 互換チェーンを追加できます。

### Web3 ネットワーク設定

Agent と Desktop の両方で、本番環境およびローカル開発向けにカスタム RPC エンドポイントの設定が可能です。

#### 本番環境の設定

お好みの RPC プロバイダーで `config.json` を作成:

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

#### ローカル開発

Hardhat または Anvil を使用してローカルブロックチェーンでテスト:

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

ローカルノードの起動:

```bash
# Ethereum シミュレーション (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Base シミュレーション (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

詳細は [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) を参照してください。

#### デフォルト動作

`chains` 設定が提供されない場合、システムは viem の組み込みパブリック RPC エンドポイントを使用します。

---

## 開発

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Docker デプロイ
cd server && docker compose up --build
```

### テストスイート

| カテゴリ | テスト内容 |
|---------|-----------|
| **Keystore** | 鍵生成、暗号化/復号、パスワード誤り、V3 構造 |
| **ポリシー** | 上限、ホワイトリスト、モード、承認ワークフロー、整数セント演算 |
| **E2EE** | 鍵ペアシリアライゼーション、決定論的 pairId 導出 |
| **Relay Hub** | WebSocket ルーティング、ペア IP バインド、接続レート制限 |
| **ペアリング** | ショートコード生成、有効期限、解決 |
| **ミドルウェア** | CORS 設定、アクセスログ |
| **セキュリティ** | 鍵エントロピー、メモリクリア、入力インジェクション、ファイル権限、パストラバーサル、RPC 安全性 |

---

## トラブルシューティング

| 問題 | 解決方法 |
|------|---------|
| 「Wallet app offline」 | Desktop Wallet が起動中で Relay に接続されていることを確認 |
| 「Pairing code expired」 | 新しいコードを生成（有効期限10分） |
| 署名リクエストがブロックされる | セッションが凍結されていないか確認（本人確認の不一致） -- 必要に応じて再ペアリング |
| IP 変更アラート | IP ポリシーを設定: `block` / `warn` / `allow` |
| Agent が再接続できない | `wallet_repair` でペアリングデータをクリアして再ペアリング |
| 同一マシン警告 | 完全なセキュリティのため、Desktop Wallet を別のデバイスに移動 |

---

## 国際化 (i18n)

デスクトップアプリは実行時の言語切り替えに対応した多言語をサポートしています:

### 対応言語

- **English (en)** -- デフォルト言語
- **簡体字中国語 (zh-CN)** -- 简体中文

### 機能

- **自動検出**: 初回起動時にシステム言語を自動検出
- **手動切り替え**: ヘッダー（右上）の言語セレクターで切り替え
- **永続化**: ユーザー設定は localStorage に保存され、セッション間で維持
- **実行時更新**: 静的 UI 要素（ボタン、ラベル、タブ）は即座に更新
- **シームレスな UX**: 言語変更にアプリの再起動は不要

### アーキテクチャ

```
i18next Framework
├── Translation Files (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # ボタン ラベル メッセージ
│   │   ├── setup.json       # ウォレットセットアップフロー
│   │   ├── activity.json    # トランザクション活動
│   │   ├── security.json    # セキュリティイベント
│   │   ├── settings.json    # 設定パネル
│   │   ├── pairing.json     # デバイスペアリング
│   │   ├── errors.json      # エラーメッセージ
│   │   ├── modals.json      # 承認 エクスポート アラートダイアログ
│   │   └── contactsPage.json
│   └── zh-CN/ (同一構造; en とキーを同期)
│   注: `npm run build` でこれらのファイルを dist/renderer/locales/ にコピーします。
├── Language Detection (i18n.js)
│   ├── 1. localStorage を確認（ユーザー設定）
│   ├── 2. navigator.language を確認（システム）
│   └── 3. 英語にフォールバック
└── DOM Update System
    ├── 静的コンテンツ用 data-i18n 属性
    └── 動的コンテンツ用 i18next.t()
```

### 新しい言語の追加

1. 翻訳ディレクトリを作成:
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. `en/` から全 JSON ファイルをコピーして翻訳:
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # 各ファイルを編集して値を翻訳
   ```

3. `index.html` のセレクターに言語オプションを追加:
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Your Language</option>
   </select>
   ```

4. 必要に応じて `i18n.js` の namespace リストを更新

### 翻訳キーの命名規則

階層的かつ意味のある命名を使用:

```
namespace.feature.element

例:
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### 開発者向け

**HTML（静的コンテンツ）**:
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript（動的コンテンツ）**:
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**補間付き**:
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// 翻訳: "Remove all entries for contact \"{name}\"?"
```

---

## コントリビューション

コントリビューションを歓迎します！参加方法は以下の通りです:

### Issue の報告
- **バグ報告**: [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues) ページをご利用ください
- **機能リクエスト**: 新機能や改善の提案をお寄せください
- **セキュリティ脆弱性**: メールで非公開に報告してください（GitHub プロフィール参照）

### プルリクエストの提出
1. リポジトリを **Fork**
2. **ブランチを作成**: `git checkout -b feature/your-feature`
3. **変更をコミット**: `git commit -m 'Add some feature'`
4. **プッシュ**: `git push origin feature/your-feature`
5. **プルリクエストを作成**

### 開発環境のセットアップ
```bash
# リポジトリをクローン
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# 依存関係をインストール
npm install

# プロジェクトをビルド
npm run build

# テストを実行
npm test
```

### 協力が必要な分野
- **ドキュメント**: ガイドの改善、チュートリアルの追加、多言語翻訳
- **新チェーン**: 追加の EVM チェーンや非 EVM チェーンのサポート
- **UI/UX の改善**: デスクトップウォレットのインターフェース向上
- **テスト**: ユニットテスト/統合テストの作成、テストカバレッジの向上

### コードスタイル
- **TypeScript** で厳格な型チェックを使用
- **Prettier** のフォーマットに従う（`.prettierrc` で設定済み）
- 意味のあるコミットメッセージを記述
- 新機能にはテストを追加

### コミュニティに参加
- **Discord**: [サーバーに参加](https://discord.gg/clawd)（近日公開）
- **Twitter**: 最新情報は [@janespace_ai](https://twitter.com/janespace_ai) をフォロー
- **GitHub Discussions**: 質問やアイデアのディスカッションを開始

---

## ライセンス

MIT (C) [janespace-ai](https://github.com/janespace-ai)
