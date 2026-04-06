<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <b>한국어</b> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**AI Agent에게 진짜 지갑을 안전하게 맡기세요.**

[OpenClaw](https://getclaw.sh) AI Agent를 위한 비수탁형 암호화폐 지갑입니다. 개인 키는 별도의 **Electron Desktop Wallet**에 보관되어 AI 모델과 완전히 격리됩니다. Agent와 Desktop은 **Go Relay Server**를 경유하는 **E2EE(종단간 암호화)** 채널을 통해 통신합니다 — Relay는 암호문만 전달할 뿐 메시지를 읽거나 변조할 수 없습니다.

> 개인 키는 절대 AI 모델에 닿지 않습니다. 같은 머신에도, 같은 프로세스에도, 메모리에도 존재하지 않습니다. Agent가 볼 수 있는 것은 지갑 주소와 트랜잭션 해시뿐입니다.

---

## 아키텍처

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

**3개 컴포넌트 설계**: 각 컴포넌트는 단일 책임을 가집니다. Agent의 호스트가 완전히 침해되더라도 공격자는 키 자료를 전혀 얻을 수 없습니다.

---

## 사용자 인터랙션 흐름

### 최초 설정: 페어링

최초 1회만 필요합니다. 페어링이 완료되면 이후 재연결은 완전히 자동으로 이루어집니다.

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

### 일상 사용: 자동 재연결

최초 페어링 후, Agent와 Desktop은 재시작 시 자동으로 재연결됩니다 — 사용자 조작이 필요 없습니다.

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

### 트랜잭션 흐름

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

## 보안 아키텍처

claw-wallet은 **심층 방어(defense-in-depth)** 전략을 사용하며, **통신 보안**(컴포넌트 간 통신 방식)과 **키 보안**(키의 저장 및 사용 방식)이라는 두 개의 독립적인 보안 영역으로 구성됩니다.

### Part A: 통신 보안

#### 1. 종단간 암호화 (E2EE)

Agent와 Desktop 간의 모든 메시지는 종단간 암호화됩니다. Relay 서버는 암호문만 볼 수 있습니다.

| Component | Detail |
|-----------|--------|
| **Key Exchange** | X25519 ECDH (Curve25519) |
| **Key Derivation** | HKDF-SHA256 |
| **Encryption** | AES-256-GCM (authenticated) |
| **Anti-Replay** | Incrementing nonce per message |
| **Forward Secrecy** | New ephemeral keys per session |

#### 2. 자동 페어링 및 재연결

수동 페어링은 최초 1회만 필요합니다. 시스템은 **영구 통신 키 쌍**과 **결정론적 페어 ID**를 사용하여 자동으로 재연결합니다:

- **Persistent Key Pairs**: X25519 키 쌍이 디스크에 저장됩니다 — Desktop에서는 지갑 비밀번호로 암호화(scrypt + AES-256-GCM), Agent에서는 파일 권한으로 보호(0600)
- **Deterministic PairId**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — 양쪽이 독립적으로 동일한 ID를 계산하며, 조율이 필요 없습니다
- **Zero-interaction Reconnect**: 재시작 시 양쪽 모두 저장된 키를 로드하고, pairId를 재계산한 후, Relay를 통해 자동으로 재연결합니다

#### 3. 3단계 재연결 검증

Agent가 재연결할 때, Desktop은 서명을 허용하기 전에 세 가지 신원 확인을 수행합니다:

| Level | Check | Failure Action |
|-------|-------|----------------|
| **Level 1** (Hard) | Public key matches stored key | Reject + force re-pair |
| **Level 2** (Hard) | machineId matches stored ID | Freeze session + force re-pair |
| **Level 3** (Configurable) | IP address change policy | `block` / `warn` (default) / `allow` |

- **machineId**: SHA256(hostname + MAC address) — Agent가 다른 머신으로 이동했는지 감지합니다
- **Session Freeze**: 신원 불일치가 감지되면, 사용자가 수동으로 재페어링할 때까지 모든 서명 요청이 차단됩니다
- **IP Policy**: 배포 환경에 맞게 설정 가능 — `block`은 즉시 거부, `warn`은 사용자에게 알리되 허용(동일 서브넷 허용), `allow`는 검사를 건너뜁니다

#### 4. Relay 측 보호

Go Relay Server는 메시지 내용을 읽을 수 없지만 추가적인 보안을 적용합니다:

| Protection | Detail |
|------------|--------|
| **Per-pairId IP Binding** | Max 2 distinct source IPs per pair simultaneously |
| **Connection Rate Limit** | Max 10 new WebSocket connections per pairId per minute |
| **Connection Eviction** | If a third client connects to a pair, the oldest is evicted |
| **Metadata Logging** | Connection events logged with truncated pairId for audit |

#### 5. 수동 재페어링 폴백

자동 재연결이 실패할 경우(디바이스 변경, 키 손상 등):

- **Agent 측**: `wallet_repair` RPC 메서드가 저장된 페어링 데이터를 삭제하고 상태를 초기화합니다
- **Desktop 측**: 보안 패널의 "Re-pair Device" UI 액션
- 양쪽 모두 새로운 키 쌍을 생성하며, 새로운 페어링 코드 교환이 필요합니다

### Part B: 키 보안

#### 6. 키 격리 — 키는 절대 AI 모델에 닿지 않음

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

Agent는 오직 Tool API를 통해서만 상호작용합니다. 어떤 도구도 키 자료를 반환하지 않습니다.

#### 7. 저장 시 암호화 — Keystore V3

| Component | Detail |
|-----------|--------|
| **Cipher** | AES-256-GCM (authenticated encryption) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes random per encryption |
| **IV** | 16 bytes random per encryption |
| **Auth Tag** | GCM tag prevents ciphertext tampering |
| **File Permissions** | 0600 (owner read/write only) |

#### 8. 메모리 안전

- 개인 키는 `signTransaction()` / `signMessage()` 실행 중에만 복호화됩니다
- 키 버퍼는 `finally` 블록에서 `Buffer.fill(0)`으로 제로화됩니다 — 서명 중 예외가 발생하더라도 마찬가지입니다
- 복호화된 키 자료는 메모리에 밀리초 단위로만 존재하며, 초 단위로 존재하지 않습니다

#### 9. 정책 엔진 — 독립적 지출 통제

정책 엔진은 모든 서명 **이전에** 실행되며, 프롬프트 인젝션으로 우회할 수 없습니다:

| Control | Default | Description |
|---------|---------|-------------|
| Per-transaction limit | $100 | 단일 트랜잭션 최대 금액 |
| Daily limit | $500 | 롤링 24시간 누적 지출 한도 |
| Address whitelist | Empty | 감독 모드에서 필수 |
| Operating mode | Supervised | `supervised` (화이트리스트 필수) 또는 `autonomous` (한도만 적용) |
| Approval queue | 24h expiry | 차단된 트랜잭션이 수동 검토를 위해 대기 |

**우회 방지 조치:**
- 부동소수점 정밀도 공격을 방지하기 위한 정수 센트 연산
- 대소문자를 구분하지 않는 화이트리스트 매칭
- 암호학적 랜덤 승인 ID (비순차적, 추측 불가)

#### 10. 입력 검증

| Input | Validation |
|-------|-----------|
| Address | Hex format, length=42, EIP-55 checksum via viem |
| Amount | Rejects NaN, Infinity, negative, zero, empty |
| Chain | Strict whitelist (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| Token symbol | Max 20 chars, rejects injection chars |
| Contact name | Max 100 chars, rejects path traversal |

#### 11. 파일 시스템 및 RPC 안전

- **Atomic writes**: 임시 파일에 쓴 후 이름 변경 (크래시 시 손상 방지)
- **0600 permissions**: 소유자만 민감한 파일을 읽고 쓸 수 있음
- **Path traversal prevention**: `sanitizePath()`가 데이터 디렉토리 외부 경로를 거부
- **Gas sanity checks**: 가스 0 및 3000만 초과 가스 추정을 거부
- **No key leakage**: 오류 메시지에 개인 키나 비밀번호가 포함되지 않음

---

## 기능

- **비수탁형 및 에어갭** — 키는 Desktop에, Agent는 비밀 정보 제로
- **종단간 암호화** — X25519 + AES-256-GCM, Relay는 암호문만 확인
- **자동 페어링** — 1회 설정 후 재시작 시 자동 재연결
- **3단계 검증** — 재연결 시마다 공개 키 + 디바이스 핑거프린트 + IP 정책 확인
- **Keystore V3 암호화** — 저장 시 AES-256-GCM + scrypt KDF
- **정책 엔진** — 트랜잭션별 및 일일 지출 한도, 주소 화이트리스트, 승인 대기열
- **8개 EVM 체인** — Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei; 모든 EVM 체인으로 확장 가능
- **서브 계정 복원** — 지갑 복원 시 BIP-44 파생 계정(m/44'/60'/0'/0/{n}) 자동 스캔 및 복원
- **듀얼 운영 모드** — 감독(Supervised, 사람이 승인) 또는 자율(Autonomous, 한도 내)
- **Agent 연락처** — 이름 해석 기능이 있는 P2P 주소록
- **잔액 모니터링** — 입금 전송을 위한 백그라운드 폴링
- **트랜잭션 히스토리** — 전체 기록이 포함된 로컬 캐시
- **컨테이너화된 Relay** — Docker 지원 Go Relay Server (Hertz 프레임워크)
- **17개 지갑 도구** — AI Agent 통합을 위한 즉시 사용 가능한 도구 정의

---

## 빠른 시작

### 사전 요구사항

- Node.js ≥ 18
- Go ≥ 1.21 (Relay Server용)
- OpenClaw 호환 AI Agent 프레임워크

### 1. Relay Server 시작

```bash
cd server
go run cmd/relay/main.go
# Default: :8765
```

또는 Docker로:

```bash
cd server
docker compose up -d
```

### 2. Desktop Wallet 시작

```bash
cd desktop
npm install
npm run dev
```

### 3. 지갑 생성 및 페어링

1. Desktop 앱에서: 비밀번호 설정 → 니모닉 백업
2. "Generate Pairing Code" 클릭 → 8자리 코드 복사
3. Agent에서 `wallet_pair({ shortCode: "ABCD1234" })` 호출
4. 완료 — E2EE 세션 수립, 자동 재연결 활성화

### 4. Agent와 함께 사용

Agent는 17개의 도구를 제공합니다. 대화 예시:

```
You:    "Send 10 USDC to Bob on Base"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Policy ✓ → E2EE → Desktop signs → Broadcast
        "Sent 10 USDC to Bob. tx: 0xab3f..."
```

---

## 사용 가능한 도구

| Tool | Description |
|------|-------------|
| **Wallet Management** | |
| `wallet_create` | 암호화된 keystore로 새 지갑 생성 |
| `wallet_import` | 개인 키를 통해 기존 지갑 가져오기 |
| `wallet_address` | 현재 지갑 주소 조회 |
| `wallet_pair` | 단축 코드를 통해 Desktop Wallet과 페어링 |
| **Balance & Gas** | |
| `wallet_balance` | ETH 또는 ERC-20 토큰 잔액 조회 |
| `wallet_estimate_gas` | 전송 전 가스 비용 추정 |
| **Transactions** | |
| `wallet_send` | ETH 또는 ERC-20 토큰 전송 (연락처 이름 지원) |
| `wallet_history` | 페이지네이션된 트랜잭션 히스토리 조회 |
| **Contacts** | |
| `wallet_contacts_add` | 멀티체인 주소로 연락처 추가 또는 업데이트 |
| `wallet_contacts_list` | 저장된 모든 연락처 목록 표시 |
| `wallet_contacts_resolve` | 이름으로 연락처 주소 조회 |
| `wallet_contacts_remove` | 연락처 삭제 |
| **Policy & Approvals** | |
| `wallet_policy_get` | 현재 보안 정책 조회 |
| `wallet_policy_set` | 지출 한도, 화이트리스트 또는 모드 업데이트 |
| `wallet_approval_list` | 대기 중인 트랜잭션 승인 목록 표시 |
| `wallet_approval_approve` | 대기 중인 트랜잭션 승인 |
| `wallet_approval_reject` | 대기 중인 트랜잭션 거부 |

---

## 프로젝트 구조

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

## 지원 체인 및 토큰

| 체인 | Chain ID | 내장 토큰 |
|------|----------|----------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

모든 ERC-20 토큰은 컨트랙트 주소를 전달하여 사용할 수 있습니다. 체인은 확장 가능합니다 — 설정을 통해 모든 EVM 호환 체인을 추가할 수 있습니다.

---

## 개발

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

### 테스트 스위트

| Category | What's Tested |
|----------|---------------|
| **Keystore** | 키 생성, 암호화/복호화, 잘못된 비밀번호, V3 구조 |
| **Policy** | 한도, 화이트리스트, 모드, 승인 워크플로우, 정수 센트 연산 |
| **E2EE** | 키 쌍 직렬화, 결정론적 pairId 도출 |
| **Relay Hub** | WebSocket 라우팅, 페어 IP 바인딩, 연결 속도 제한 |
| **Pairing** | 단축 코드 생성, 만료, 해석 |
| **Middleware** | CORS 설정, 접근 로깅 |
| **Security** | 키 엔트로피, 메모리 클리어링, 입력 인젝션, 파일 권한, 경로 탐색, RPC 안전 |

---

## 문제 해결

| Issue | Solution |
|-------|---------|
| "Wallet app offline" | Desktop Wallet이 실행 중이고 Relay에 연결되어 있는지 확인하세요 |
| "Pairing code expired" | 새 코드를 생성하세요 (10분 TTL) |
| Signing requests blocked | 세션이 동결되었는지 확인하세요 (신원 불일치) — 필요 시 재페어링 |
| IP change alert | IP 정책을 설정하세요: `block` / `warn` / `allow` |
| Agent can't reconnect | `wallet_repair`를 사용하여 페어링 데이터를 삭제하고 재페어링하세요 |
| Same-machine warning | 완전한 보안을 위해 Desktop Wallet을 별도의 디바이스로 이동하세요 |

---

## 라이선스

MIT
