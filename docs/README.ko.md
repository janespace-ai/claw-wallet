<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.ja.md">日本語</a> | <b>한국어</b> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**AI 에이전트에게 안전한 지갑을 — 보안은 확실하게.**

[OpenClaw](https://getclaw.sh) AI 에이전트 프레임워크용 Web3 지갑 플러그인입니다. 로컬에서 셀프 호스팅하는 비수탁형 암호화폐 지갑으로, AI 에이전트가 자산 관리·전송·EVM 블록체인 상호작용을 할 수 있으면서도 개인키는 암호화되어 LLM과 완전히 분리됩니다.

> 개인키는 AI 모델에 노출되지 않습니다. 에이전트는 Tool API를 통해 동작하며, 반환하는 것은 주소와 트랜잭션 해시뿐입니다.

---

## 왜 claw-wallet인가?

AI 에이전트가 온체인에서 동작할 때(거래, 결제, DeFi 전략) 근본적인 딜레마가 있습니다: **모델은 행동해야 하지만 키를 보면 안 됩니다**. claw-wallet은 역할 분리로 이를 해결합니다.

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

**LLM이 볼 수 있는 것:** 지갑 주소, 잔액, 트랜잭션 해시, 정책 상태.  
**LLM이 볼 수 없는 것:** 개인키, 니모닉, 복호화된 키 자료.

---

## 주요 기능

- **비수탁·로컬** — 키는 사용자 기기에서 암호화 저장, 클라우드 의존 없음.
- **Keystore V3 암호화** — AES-256-GCM + scrypt KDF, 이더리움 클라이언트와 동일 표준.
- **정책 엔진** — 거래당·일일 지출 한도, 주소 화이트리스트, 수동 승인 대기열. 프롬프트 인젝션으로 에이전트가 탈취되어도 미승인 전송은 차단됩니다.
- **멀티체인 EVM** — Base(기본·저 Gas) 및 이더리움 메인넷. 다른 EVM 체인으로 확장 가능.
- **이중 운영 모드** — 감독 모드(사람 승인) 또는 자율 모드(한도 내 자동 실행).
- **에이전트 연락처** — P2P 주소록. 에이전트끼리 주소를 교환하고 이름으로 해석.
- **잔액 모니터링** — 입금을 백그라운드에서 폴링하고 실시간 알림.
- **트랜잭션 기록** — 송수신 전체 거래를 로컬에 캐시.
- **16개 OpenClaw 도구** — 바로 사용 가능한 도구 정의로 AI 에이전트에 통합.

---

## 사용 시나리오

### 시나리오 1: 사람 → 에이전트 → 계약/기관

사용자가 에이전트에게 판매자 결제, NFT 민팅, DeFi 프로토콜 상호작용을 지시합니다.

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

**대표 용도:** SaaS 구독 결제, 온체인 서비스 구매, DeFi 프로토콜 이용, 거래소 입금. 주소 화이트리스트로 사전 승인된 계약 주소로만 전송 가능합니다.

### 시나리오 2: 사람 → 에이전트 → 다른 에이전트

사용자 에이전트가 다른 AI 에이전트에게 서비스 대가를 지급. 연락처로 주소를 이름으로 해석합니다.

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

**대표 용도:** 에이전트 간 API 호출 비용, 데이터 구매, 협업 태스크 보상. 연락처로 이름만 지정해 주기적 결제가 가능하며 매번 주소를 붙여넣을 필요가 없습니다.

### 시나리오 3: 에이전트 자율 운영

에이전트가 단독으로 동작하며 정책 한도 내에서 거래·서비스 구매·포트폴리오 조정을 수행합니다. 거래마다 사람이 개입하지 않습니다.

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

**대표 용도:** DeFi 수익 농사, 자동 매매, 정기 구독 결제, 리밸런싱. 정책 엔진이 **안전 레일** 역할을 해 완전 자율 에이전트도 설정 가능한 지출 범위 안에서만 동작합니다.

### 모드 비교

| | 감독 모드 | 자율 모드 |
|---|---|---|
| **결정 주체** | 화이트리스트 외 거래는 사람이 승인 | 한도 내에서 에이전트가 결정 |
| **화이트리스트** | 필수(리스트 외 차단) | 불필요(한도 내면 임의 주소 가능) |
| **지출 한도** | 거래당·일일 한도 적용 | 동일 |
| **적합 용도** | 고액 지갑, 신뢰 구축 단계 | 일상 운영, 트레이딩 봇 |
| **한도 초과 시** | 대기열 → 사람 승인/거절 | 대기열 → 사람 승인/거절 |

---

## 빠른 시작

### 설치

```bash
npm install claw-wallet
```

### 기본 사용

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();

// OpenClaw 에이전트에 16개 도구 등록
const tools = wallet.getTools();

// ... 에이전트가 도구로 송수신·관리 ...

// 종료 시: 기록·연락처·정책을 디스크에 저장
await wallet.shutdown();
```

---

## 동작 흐름

### 트랜잭션 흐름

에이전트 의도부터 온체인 확정까지: 입력 검증 → 수신자 해석(연락처/0x 주소) → 잔액·가스 확인 → 정책 검사 → 서명(복호화 후 즉시 메모리 제로) → 브로드캐스트·확인 → 기록 및 반환.

### 승인 흐름(감독 모드)

한도 초과 또는 화이트리스트 외 주소로 전송 시: `wallet_send`가 정책에 의해 차단되고 승인 ID가 반환됩니다. 사용자는 `wallet_approval_list`로 대기 중인 거래를 보고, `wallet_approval_approve(id)` / `wallet_approval_reject(id)`로 처리합니다. 24시간 무행동 시 자동 만료됩니다.

---

## 사용 가능한 도구

claw-wallet이 제공하는 16개 도구:

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

## 보안 모델

claw-wallet은 **다층 방어**로 설계되었습니다.

### 1. 키 격리

에이전트는 Tool API를 통해서만 동작하며, 키 자료를 반환하는 도구는 없습니다. `wallet_create`도 주소만 반환합니다.

### 2. 저장 시 암호화 — Keystore V3

AES-256-GCM(인증 암호화), scrypt KDF(N=131072, r=8, p=1), 암호화마다 32바이트 랜덤 salt·16바이트 IV, GCM 태그로 변조 방지, 파일 권한 0600.

### 3. 메모리 안전

개인키는 `signTransaction()` / `signMessage()` 실행 중에만 복호화되며, `finally`에서 버퍼를 제로 클리어합니다.

### 4. 정책 엔진

서명 전에 항상 실행되며 프롬프트 인젝션으로 우회할 수 없습니다. 거래당·일일 한도, 화이트리스트, 24시간 만료 승인 대기열. 금액은 **정수 센트**로 처리해 부동소수점 공격을 막고, 승인 ID는 암호학적 난수입니다.

### 5. 입력 검증

주소·금액·체인·토큰 심볼·연락처 이름·Keystore JSON을 모두 검증하고, 경로 순회·비정상 KDF 파라미터를 거부합니다.

### 6. 파일 시스템

원자적 쓰기(임시 파일 → 이름 변경), 0600 권한, 데이터 디렉터리 밖 경로 거부.

### 7. RPC 안전

음수 잔액은 0으로 처리, Gas 0 및 30M 초과 거부. 오류 메시지에 개인키·비밀번호를 포함하지 않습니다.

---

## 설정

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

## 데이터 저장

모든 데이터는 로컬에만 저장됩니다(클라우드 전송 없음):

```
~/.openclaw/wallet/
├── keystore.json    # Encrypted private key (Keystore V3, chmod 0600)
├── contacts.json    # Agent contacts address book
├── history.json     # Transaction history cache
└── policy.json      # Security policy & approval queue
```

---

## 지원 체인·토큰

| Chain | Chain ID | Default RPC | Built-in Tokens |
|-------|----------|-------------|-----------------|
| Base | 8453 | Public Base RPC | USDC, USDT |
| Ethereum | 1 | Public Ethereum RPC | USDC, USDT |

ERC-20는 컨트랙트 주소를 지정하면 사용 가능합니다. 체인은 설정으로 확장할 수 있습니다.

---

## 아키텍처

`src/`에 `index.ts`(ClawWallet), `keystore.ts`, `chain.ts`, `transfer.ts`, `policy.ts`, `contacts.ts`, `history.ts`, `monitor.ts`, `validation.ts` 및 `tools/` 하위 16개 도구 정의. 블록체인은 [viem](https://viem.sh)만 사용하고, 암호화는 Node.js 기본 `node:crypto`를 사용합니다.

---

## 개발

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

기능 테스트(keystore / chain / contacts / history / policy / E2E)와 보안 테스트(키·입력·정책·파일·RPC)를 포함합니다.

---

## 요구 사항

- Node.js ≥ 18
- OpenClaw 호환 AI 에이전트 프레임워크(또는 Tool 정의를 지원하는 프레임워크)

---

## 라이선스

MIT
