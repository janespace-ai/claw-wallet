<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <b>한국어</b> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Release"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Last Commit"></a>
</p>

<h1 align="center">Claw-Wallet</h1>

<p align="center">
  <b>AI 에이전트에게 진짜 지갑을 안전하게 맡기세요.</b><br>
  <i>AI 에이전트를 위한 완전한 키 격리 비수탁형 암호화폐 지갑</i>
</p>

> **개발자가 아니신가요?** 사용자 가이드는 **[janespace-ai.github.io](https://janespace-ai.github.io)** 를 방문하세요 — 설치, 페어링, 시작 방법을 몇 분 안에 확인할 수 있습니다.

**Claw-Wallet**은 OpenClaw, Claude Code, Cursor 등 AI 에이전트를 위해 특별히 설계된 안전한 비수탁형 암호화폐 지갑입니다. 개인 키는 별도의 **Electron 데스크톱 지갑**에 저장되어 AI 모델로부터 완전히 격리됩니다. 에이전트와 데스크톱은 **Go Relay Server**를 통한 **E2EE(종단간 암호화)** 채널로 통신합니다 — 릴레이는 암호문만 전달하며 메시지를 읽거나 변조할 수 없습니다.

> **핵심 보안 약속**: 개인 키는 절대로 AI 모델에 닿지 않습니다. 같은 머신에도, 같은 프로세스에도, 메모리에도 존재하지 않습니다. 에이전트는 지갑 주소와 트랜잭션 해시만 볼 수 있습니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **완전한 키 격리** | 키는 데스크톱 지갑에 보관; 에이전트는 주소와 해시만 확인 |
| **멀티체인 지원** | Ethereum, Base, Arbitrum, Optimism, Polygon, Linea, BSC, Sei |
| **AI 에이전트 네이티브** | OpenClaw, Claude Code, Cursor, Codex 등을 위한 내장 도구 |
| **E2EE 통신** | X25519 + AES-256-GCM 암호화; 릴레이는 암호문만 확인 가능 |
| **자동 재연결** | 한 번 페어링하면 재시작 후 자동으로 재연결 |
| **정책 엔진** | 트랜잭션별 및 일일 한도, 주소 화이트리스트, 승인 대기열 |
| **데스크톱 + CLI** | 키 관리를 위한 Electron 데스크톱 앱 + 에이전트용 CLI 도구 |
| **오픈 소스** | MIT 라이선스 — 검토, 수정, 기여 가능 |

## 4단계로 시작하기

**1단계 — 데스크톱 지갑 설치**

최신 릴리스를 다운로드하고 앱을 실행하세요. 지갑을 생성하고, 비밀번호를 설정하고, 니모닉을 백업하세요.

| 플랫폼 | 다운로드 |
|--------|----------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> 모든 릴리스: [github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="Welcome screen" />

**2단계 — 에이전트 연결**

**OpenClaw를 사용하시나요?** 채팅에서 OpenClaw에 직접 입력하세요:

```
openclaw plugins install @janespace-ai/claw-wallet
```

**Claude Code, Cline, Cursor 또는 다른 에이전트를 사용하시나요?** 에이전트 채팅에 다음을 붙여넣으세요:

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

또는 CLI로 설치하세요:

```bash
npx skills add janespace-ai/claw-wallet
```

**3단계 — 페어링 코드 생성**

데스크톱 앱에서 **"페어링 코드 생성"** 을 클릭하고 8자리 코드를 복사하세요.

<img src="screenshots/pair-code-dark.png" width="320" alt="Pairing code screen" />

**4단계 — 사용 시작**

페어링 코드를 에이전트에 한 번 붙여넣으세요. 이후부터 에이전트와 데스크톱은 자동으로 재연결됩니다 — 사용자 조작이 필요 없습니다.

<img src="screenshots/tx-approval-dark.png" width="320" alt="Transaction approval screen" />

```
사용자: "Base에서 Bob에게 10 USDC 보내줘"
에이전트: → 연락처 확인 → 트랜잭션 구성 → E2EE → 데스크톱 서명 → 브로드캐스트
         "Bob에게 10 USDC를 보냈습니다. tx: 0xab3f..."
```

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
       │  에이전트가 접근할 수 없는 것:                                            데스크톱이 보유하는 것:  │
       │  • 개인 키                                                              • BIP-39 니모닉       │
       │  • 니모닉                                                               • Keystore V3 파일    │
       │  • 키 자료                                                              • 서명 엔진            │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**3개 컴포넌트 설계**: 각 컴포넌트는 단일 책임을 가집니다. 에이전트의 호스트가 완전히 침해되더라도 공격자는 키 자료를 전혀 얻을 수 없습니다.

---

## 사용자 상호작용 흐름

### 최초 설정: 페어링

최초 1회만 필요합니다. 초기 페어링 후에는 재연결이 완전히 자동으로 이루어집니다.

```
 사용자                       데스크톱 지갑                    릴레이 서버               AI 에이전트
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. 지갑 생성
    (비밀번호 설정,           BIP-39 니모닉 생성
     니모닉 백업)             AES-256-GCM으로 암호화
                              + scrypt KDF
                                    │
 2. "페어링 코드 생성"        8자리 페어링 코드 생성
    클릭                      (유효 시간 10분)
                                    │
 3. 코드를 에이전트에                │                                              에이전트가
    복사 (또는 보안                  │                                              wallet_pair
    채널로 전송)                    │                                              { shortCode } 호출
                                    │                         ◄──── 에이전트가 코드로 등록 ────┘
                                    │
                              데스크톱 연결 ────────────────►  릴레이가 페어 매칭
                              X25519 키 교환 ◄─────────────► E2EE 세션 수립
                                    │
                              영구 통신 키 쌍 저장            에이전트가 영구 통신
                              (암호화됨)                      키 쌍 저장 (0600)
                                    │
                              결정론적 pairId 도출            동일한 pairId 도출
                              = SHA256(addr +                = SHA256(addr +
                              agentPubKey)[:16]              agentPubKey)[:16]
                                    │
 페어링 완료!                 서명 준비 완료                  거래 준비 완료
```

### 일상 사용: 자동 재연결

초기 페어링 후, 에이전트와 데스크톱은 재시작 시 자동으로 재연결됩니다 — 사용자 조작이 필요 없습니다.

```
 에이전트 재시작              데스크톱 재시작
       │                             │
 영구 통신 키 쌍              영구 통신 키 쌍
 디스크에서 로드              로드 (지갑 비밀번호로
                              복호화)
       │                             │
 pairId 재계산                동일 pairId 재계산
       │                             │
 릴레이에 연결 ──────────────► 릴레이가 pairId로 라우팅 ──────► 데스크톱 수신
       │                                                             │
 확장 핸드셰이크 전송:                                        3단계 검증:
 • publicKey                                                  Level 1: 공개 키가 저장된 키와 일치
 • machineId                                                  Level 2: machineId가 저장된 ID와 일치
 • reconnect: true                                            Level 3: IP 변경 정책 (설정 가능)
       │                                                             │
 E2EE 세션 복원 ◄──────────────────────────────────────────── 세션 활성화
       │                                                             │
 거래 준비 완료                                               서명 준비 완료
```

### 트랜잭션 흐름

```
 사용자 (에이전트와 대화)             AI 에이전트                       데스크톱 지갑
──────────────────────────────────────────────────────────────────────────────────────
 "Base에서 Bob에게              wallet_send
  0.5 ETH 보내줘"                to: "bob"  (연락처)
                                   amount: 0.5
                                   chain: base
                                        │
                                 연락처 확인 ──► Bob = 0x742d...
                                 트랜잭션 요청 구성
                                        │
                                 E2EE 암호화 ──────────────────► 요청 복호화
                                                                       │
                                                                 정책 확인:
                                                                   트랜잭션별 한도 이내
                                                                   일일 한도 이내
                                                                   기기 동결 상태 아님
                                                                       │
                                                                 개인 키 복호화
                                                                 트랜잭션 서명
                                                                 메모리에서 키 제거
                                                                 체인에 브로드캐스트
                                                                       │
                                 결과 수신 ◄────────────────── tx 해시 + 영수증
                                        │
                                 사용자에게 반환:
                                 "Bob에게 0.5 ETH를
                                  보냈습니다. tx: 0xab3f..."
```

---

## 보안 아키텍처

claw-wallet은 두 개의 독립적인 보안 도메인으로 **심층 방어**를 구현합니다: **통신 보안**(컴포넌트 간 통신 방법)과 **키 보안**(키 저장 및 사용 방법).

### Part A: 통신 보안

#### 1. 종단간 암호화 (E2EE)

에이전트와 데스크톱 간의 모든 메시지는 종단간 암호화됩니다. 릴레이 서버는 암호문만 볼 수 있습니다.

| 구성 요소 | 세부 사항 |
|-----------|-----------|
| **키 교환** | X25519 ECDH (Curve25519) |
| **키 파생** | HKDF-SHA256 |
| **암호화** | AES-256-GCM (인증됨) |
| **재전송 방지** | 메시지당 증가하는 논스 |
| **순방향 비밀성** | 세션당 새로운 임시 키 |

#### 2. 자동 페어링 및 재연결

수동 페어링은 최초 1회만 필요합니다. 시스템은 자동 재연결을 위해 **영구 통신 키 쌍**과 **결정론적 페어 ID**를 사용합니다:

- **영구 키 쌍**: X25519 키 쌍이 디스크에 저장됨 — 데스크톱에서는 지갑 비밀번호로 암호화 (scrypt + AES-256-GCM), 에이전트에서는 파일 권한으로 보호 (0600)
- **결정론적 PairId**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — 양쪽 모두 동일한 ID를 독립적으로 계산하며, 조율이 필요 없음
- **무조작 재연결**: 재시작 시 양쪽 모두 저장된 키를 로드하고 pairId를 재계산하여 릴레이를 통해 자동으로 재연결

#### 3. 3단계 재연결 검증

에이전트가 재연결할 때, 데스크톱은 서명을 허용하기 전에 세 가지 신원 확인을 수행합니다:

| 단계 | 확인 항목 | 실패 시 조치 |
|------|-----------|-------------|
| **Level 1** (필수) | 공개 키가 저장된 키와 일치 | 거부 + 재페어링 강제 |
| **Level 2** (필수) | machineId가 저장된 ID와 일치 | 세션 동결 + 재페어링 강제 |
| **Level 3** (설정 가능) | IP 주소 변경 정책 | `block` / `warn` (기본값) / `allow` |

- **machineId**: SHA256(hostname + MAC 주소) — 에이전트가 다른 머신으로 이동했는지 감지
- **세션 동결**: 신원 불일치가 감지되면 사용자가 수동으로 재페어링할 때까지 모든 서명 요청이 차단됨
- **IP 정책**: 배포별 설정 가능 — `block`은 즉시 거부, `warn`은 사용자에게 경고하되 허용 (동일 서브넷 허용), `allow`는 확인을 건너뜀

#### 4. 릴레이 측 보호

Go Relay Server는 메시지 내용을 읽을 수 없지만 추가적인 보안을 적용합니다:

| 보호 조치 | 세부 사항 |
|-----------|-----------|
| **pairId별 IP 바인딩** | 페어당 동시 최대 2개의 고유 소스 IP |
| **연결 속도 제한** | pairId당 분당 최대 10개의 새 WebSocket 연결 |
| **연결 퇴거** | 세 번째 클라이언트가 페어에 연결하면 가장 오래된 것이 퇴거됨 |
| **메타데이터 로깅** | 감사를 위해 축약된 pairId로 연결 이벤트 기록 |

#### 5. 수동 재페어링 대체 방법

자동 재연결이 실패할 경우 (기기 변경, 키 손상 등):

- **에이전트 측**: `wallet_repair` RPC 메서드가 저장된 페어링 데이터를 지우고 상태를 초기화
- **데스크톱 측**: 보안 패널의 "기기 재페어링" UI 동작
- 양쪽 모두 새로운 키 쌍을 생성하며, 새 페어링 코드 교환이 필요

### Part B: 키 보안

#### 6. 키 격리 — 키는 절대 AI 모델에 닿지 않음

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  접근 불가:         │                   │  개인 키는 오직     │
│  - 개인 키         │                   │  signTransaction() │
│  - keystore 파일   │                   │  내부에서만 복호화  │
│  - 비밀번호        │                   │  후 즉시 제거       │
└────────────────────┘                   └────────────────────┘
```

에이전트는 Tool API를 통해서만 상호작용합니다. 어떤 도구도 키 자료를 반환하지 않습니다.

#### 7. 저장 시 암호화 — Keystore V3

| 구성 요소 | 세부 사항 |
|-----------|-----------|
| **암호화** | AES-256-GCM (인증된 암호화) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **솔트** | 암호화당 32바이트 랜덤 |
| **IV** | 암호화당 16바이트 랜덤 |
| **인증 태그** | GCM 태그가 암호문 변조를 방지 |
| **파일 권한** | 0600 (소유자만 읽기/쓰기 가능) |

#### 8. 메모리 안전

- 개인 키는 `signTransaction()` / `signMessage()` 실행 중에만 복호화됨
- 키 버퍼는 `finally` 블록에서 `Buffer.fill(0)`로 제로화됨 — 서명 중 오류가 발생해도 마찬가지
- 복호화된 키 자료는 메모리에 초 단위가 아닌 밀리초 단위로만 존재

#### 9. 정책 엔진 — 독립적 지출 통제

정책 엔진은 모든 서명 **전에** 실행되며 프롬프트 인젝션으로 우회할 수 없습니다:

| 통제 항목 | 기본값 | 설명 |
|-----------|--------|------|
| 트랜잭션별 한도 | $100 | 단일 트랜잭션 최대 금액 |
| 일일 한도 | $500 | 24시간 누적 지출 한도 |
| 주소 화이트리스트 | 비어 있음 | 감독 모드에서 필수 |
| 운영 모드 | 감독 모드 | `supervised` (화이트리스트 필수) 또는 `autonomous` (한도만 적용) |
| 승인 대기열 | 24시간 만료 | 차단된 트랜잭션이 수동 검토를 위해 대기 |

**우회 방지 조치:**
- 부동소수점 정밀도 공격을 방지하기 위한 정수 센트 연산
- 대소문자 구분 없는 화이트리스트 매칭
- 순차적이지 않고 추측 불가능한 암호학적 랜덤 승인 ID

#### 10. 입력 검증

| 입력 | 검증 |
|------|------|
| 주소 | 16진수 형식, 길이=42, viem을 통한 EIP-55 체크섬 |
| 금액 | NaN, Infinity, 음수, 0, 빈 값 거부 |
| 체인 | 엄격한 화이트리스트 (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| 토큰 심볼 | 최대 20자, 인젝션 문자 거부 |
| 연락처 이름 | 최대 100자, 경로 순회 거부 |

#### 11. 파일 시스템 및 RPC 안전

- **원자적 쓰기**: 임시 파일에 쓰기 후 이름 변경 (충돌 시 손상 방지)
- **0600 권한**: 소유자만 민감한 파일을 읽기/쓰기 가능
- **경로 순회 방지**: `sanitizePath()`가 데이터 디렉토리 외부 경로를 거부
- **가스 정합성 검사**: 가스 0과 30M 초과 가스 추정값 거부
- **키 유출 없음**: 오류 메시지에 개인 키나 비밀번호가 절대 포함되지 않음

---

## 기능

- **비수탁형 및 에어갭** — 키는 데스크톱에, 에이전트는 비밀 정보 없음
- **종단간 암호화** — X25519 + AES-256-GCM, 릴레이는 암호문만 확인
- **자동 페어링** — 1회 설정, 재시작 후 자동 재연결
- **3단계 검증** — 재연결 시마다 공개 키 + 기기 지문 + IP 정책 확인
- **Keystore V3 암호화** — AES-256-GCM + scrypt KDF로 저장된 키 보호
- **정책 엔진** — 트랜잭션별 및 일일 지출 한도, 주소 화이트리스트, 승인 대기열
- **8개 EVM 체인** — Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei; 모든 EVM 체인으로 확장 가능
- **하위 계정 복구** — 지갑 복원 시 파생 계정 (BIP-44 m/44'/60'/0'/0/{n}) 스캔 및 복구
- **이중 운영 모드** — 감독 모드 (사람이 승인) 또는 자율 모드 (한도 내)
- **에이전트 연락처** — 이름 확인이 가능한 P2P 주소록
- **잔액 모니터링** — 수신 전송에 대한 백그라운드 폴링
- **트랜잭션 내역** — 전체 기록이 포함된 로컬 캐시
- **컨테이너화된 릴레이** — Docker를 지원하는 Go Relay Server (Hertz 프레임워크)
- **17개 지갑 도구** — npm에 [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet)으로 게시, `npm install @janespace-ai/claw-wallet` 또는 `npx skills add janespace-ai/claw-wallet`로 설치 가능
- **국제화 (i18n)** — 데스크톱 앱이 영어와 중국어 간체를 지원하며 런타임 언어 전환 가능

---

## 빠른 시작

### 사전 요구 사항

- Node.js 18 이상
- Go 1.21 이상 (Relay Server용)
- OpenClaw 호환 AI 에이전트 프레임워크

### 1. Relay Server 시작

```bash
cd server
go run cmd/relay/main.go
# 기본값: :8765
```

또는 Docker로:

```bash
cd server
docker compose up -d
```

### 2. 데스크톱 지갑 시작

```bash
cd desktop
npm install
npm run dev
```

### 3. 지갑 생성 및 페어링

1. 데스크톱 앱에서: 비밀번호 설정 → 니모닉 백업
2. "페어링 코드 생성" 클릭 → 8자리 코드 복사
3. 에이전트에서 `wallet_pair({ shortCode: "ABCD1234" })` 호출
4. 완료 — E2EE 세션이 수립되며 자동 재연결 활성화

### 4. 에이전트와 함께 사용

17개의 도구를 사용할 수 있습니다. 대화 예시:

```
사용자:   "Base에서 Bob에게 10 USDC 보내줘"
에이전트: wallet_contacts_resolve("bob") → 0x742d...
          wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
          → 정책 확인 → E2EE → 데스크톱 서명 → 브로드캐스트
          "Bob에게 10 USDC를 보냈습니다. tx: 0xab3f..."
```

---

## 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| **지갑 관리** | |
| `wallet_create` | 암호화된 keystore로 새 지갑 생성 |
| `wallet_import` | 개인 키를 통해 기존 지갑 가져오기 |
| `wallet_address` | 현재 지갑 주소 조회 |
| `wallet_pair` | 단축 코드를 통해 데스크톱 지갑과 페어링 |
| **잔액 및 가스** | |
| `wallet_balance` | ETH 또는 ERC-20 토큰 잔액 조회 |
| `wallet_estimate_gas` | 전송 전 가스 비용 추정 |
| **트랜잭션** | |
| `wallet_send` | ETH 또는 ERC-20 토큰 전송 (연락처 이름 지원) |
| `wallet_history` | 페이지네이션된 트랜잭션 내역 조회 |
| **연락처** | |
| `wallet_contacts_add` | 멀티체인 주소로 연락처 추가 또는 업데이트 |
| `wallet_contacts_list` | 저장된 모든 연락처 목록 표시 |
| `wallet_contacts_resolve` | 이름으로 연락처 주소 조회 |
| `wallet_contacts_remove` | 연락처 삭제 |
| **정책 및 승인** | |
| `wallet_policy_get` | 현재 보안 정책 조회 |
| `wallet_policy_set` | 지출 한도, 화이트리스트 또는 모드 업데이트 |
| `wallet_approval_list` | 대기 중인 트랜잭션 승인 목록 표시 |
| `wallet_approval_approve` | 대기 중인 트랜잭션 승인 |
| `wallet_approval_reject` | 대기 중인 트랜잭션 거부 |

---

## 프로젝트 구조

```
wallet/
├── agent/                 # AI 에이전트 프레임워크 (TypeScript) — 비밀 정보 없음
│   ├── index.ts           # ClawWallet 클래스 — 도구 및 서명자 조율
│   ├── e2ee/              # E2EE 암호화, WebSocket 전송, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, 키 직렬화
│   │   ├── transport.ts   # 확장 핸드셰이크가 포함된 E2EE WebSocket 클라이언트
│   │   └── machine-id.ts  # 기기 지문 (SHA256(hostname:MAC))
│   ├── signer/            # RelaySigner — 영구 페어링, 자동 재연결
│   │   ├── relay-client.ts    # 릴레이 연결, 결정론적 pairId, 복구
│   │   ├── ipc-server.ts     # Unix 도메인 소켓 IPC 서버
│   │   └── ipc-client.ts     # 도구 → 서명자 통신을 위한 IPC 클라이언트
│   ├── tools/             # 17개 지갑 도구 정의
│   └── *.ts               # 정책, 연락처, 내역, 모니터, 검증
│
├── desktop/               # Electron 데스크톱 지갑 — 모든 비밀 정보 보유
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 니모닉, Keystore V3 암호화/복호화
│       │   ├── signing-engine.ts   # 메모리 제로화가 포함된 트랜잭션 서명
│       │   ├── signing-history.ts  # SQLite 기반 트랜잭션 활동 내역
│       │   ├── tx-sync-service.ts  # 블록체인 트랜잭션 상태 동기화
│       │   ├── chain-adapter.ts    # 트랜잭션 영수증용 RPC 클라이언트
│       │   ├── database-service.ts # SQLite 연결 및 스키마 마이그레이션
│       │   ├── price-service.ts    # 다중 티어 가격 조회 (Gate.com, CoinGecko)
│       │   ├── balance-service.ts  # 체인 간 토큰 잔액 집계
│       │   ├── relay-bridge.ts     # E2EE 릴레이, 3단계 검증, 세션 동결
│       │   ├── security-monitor.ts # IP/기기 변경 감지, 알림
│       │   └── lock-manager.ts     # 지갑 잠금/해제, 유휴 타임아웃
│       ├── preload/                # 보안 contextBridge (nodeIntegration 없음)
│       ├── renderer/               # HTML/CSS/JS UI (활동 탭, 잔액 표시)
│       └── shared/
│           └── e2ee-crypto.ts      # 공유 E2EE 프리미티브
│
└── server/                # Go Relay Server (Hertz) — 상태 비저장 포워더
    ├── cmd/relay/main.go  # 진입점, 라우트 설정
    ├── internal/
    │   ├── hub/           # WebSocket 허브, IP 바인딩, 속도 제한
    │   ├── pairing/       # 단축 코드 생성 및 해석
    │   ├── middleware/     # CORS, 접근 로깅
    │   └── iputil/        # IP 추출 유틸리티
    ├── Dockerfile         # 멀티스테이지 빌드
    └── docker-compose.yml # 단일 명령 배포
```

---

## 지원 체인 및 토큰

| 체인 | 체인 ID | 내장 토큰 |
|------|---------|-----------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

모든 ERC-20 토큰은 컨트랙트 주소를 전달하여 사용할 수 있습니다. 체인은 확장 가능합니다 — 설정을 통해 모든 EVM 호환 체인을 추가할 수 있습니다.

### Web3 네트워크 설정

에이전트와 데스크톱 모두 프로덕션 및 로컬 개발을 위한 사용자 정의 RPC 엔드포인트 설정을 지원합니다.

#### 프로덕션 설정

선호하는 RPC 제공자로 `config.json`을 생성하세요:

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

#### 로컬 개발

로컬 블록체인 테스트를 위해 Hardhat 또는 Anvil을 사용하세요:

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

로컬 노드 시작:

```bash
# Ethereum 시뮬레이션 (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Base 시뮬레이션 (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

전체 설정 가이드는 [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)를 참조하세요.

#### 기본 동작

`chains` 설정이 제공되지 않으면 시스템은 viem의 내장 공개 RPC 엔드포인트를 사용합니다.

---

## 개발

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Docker 배포
cd server && docker compose up --build
```

### 테스트 스위트

| 카테고리 | 테스트 내용 |
|----------|-------------|
| **Keystore** | 키 생성, 암호화/복호화, 잘못된 비밀번호, V3 구조 |
| **정책** | 한도, 화이트리스트, 모드, 승인 워크플로, 정수 센트 연산 |
| **E2EE** | 키 쌍 직렬화, 결정론적 pairId 파생 |
| **Relay Hub** | WebSocket 라우팅, 페어 IP 바인딩, 연결 속도 제한 |
| **페어링** | 단축 코드 생성, 만료, 해석 |
| **미들웨어** | CORS 설정, 접근 로깅 |
| **보안** | 키 엔트로피, 메모리 클리어링, 입력 인젝션, 파일 권한, 경로 순회, RPC 안전 |

---

## 문제 해결

| 문제 | 해결 방법 |
|------|-----------|
| "지갑 앱 오프라인" | 데스크톱 지갑이 실행 중이고 릴레이에 연결되어 있는지 확인 |
| "페어링 코드 만료" | 새 코드 생성 (10분 TTL) |
| 서명 요청 차단됨 | 세션이 동결되었는지 확인 (신원 불일치) — 필요시 재페어링 |
| IP 변경 알림 | IP 정책 설정: `block` / `warn` / `allow` |
| 에이전트 재연결 불가 | `wallet_repair`를 사용하여 페어링 데이터를 지우고 재페어링 |
| 동일 머신 경고 | 완전한 보안을 위해 데스크톱 지갑을 별도 기기로 이동 |

---

## 국제화 (i18n)

데스크톱 앱은 런타임 언어 전환을 지원하는 다국어를 지원합니다:

### 지원 언어

- **English (en)** — 기본 언어
- **Simplified Chinese (zh-CN)** — 简体中文

### 기능

- **자동 감지**: 첫 실행 시 시스템 언어를 자동으로 감지
- **수동 전환**: 헤더 (우측 상단)의 언어 선택기
- **지속성**: 사용자 설정이 세션 간 localStorage에 저장
- **런타임 업데이트**: 정적 UI 요소 (버튼, 레이블, 탭)가 즉시 업데이트
- **매끄러운 UX**: 언어 변경 시 앱 재시작 불필요

### 아키텍처

```
i18next Framework
├── Translation Files (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # 버튼 레이블 메시지
│   │   ├── setup.json       # 지갑 설정 흐름
│   │   ├── activity.json    # 트랜잭션 활동
│   │   ├── security.json    # 보안 이벤트
│   │   ├── settings.json    # 설정 패널
│   │   ├── pairing.json     # 기기 페어링
│   │   ├── errors.json      # 오류 메시지
│   │   ├── modals.json      # 승인 내보내기 알림 대화상자
│   │   └── contactsPage.json
│   └── zh-CN/ (동일 구조; en과 키를 동기화 유지)
│   참고: `npm run build`는 이 파일들을 dist/renderer/locales/로 복사합니다 (Electron용).
├── Language Detection (i18n.js)
│   ├── 1. localStorage 확인 (사용자 설정)
│   ├── 2. navigator.language 확인 (시스템)
│   └── 3. 영어로 폴백
└── DOM Update System
    ├── 정적 콘텐츠용 data-i18n 속성
    └── 동적 콘텐츠용 i18next.t()
```

### 새 언어 추가

1. 번역 디렉토리 생성:
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. `en/`에서 모든 JSON 파일을 복사하고 번역:
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # 각 파일을 편집하여 값을 번역
   ```

3. `index.html`의 선택기에 언어 옵션 추가:
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Your Language</option>
   </select>
   ```

4. 필요시 `i18n.js`의 네임스페이스 목록 업데이트

### 번역 키 규칙

계층적이고 의미론적인 이름 지정을 사용하세요:

```
namespace.feature.element

예시:
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### 개발자를 위한 안내

**HTML (정적 콘텐츠)**:
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript (동적 콘텐츠)**:
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**보간 사용**:
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// 번역: "연락처 \"{name}\"의 모든 항목을 삭제하시겠습니까?"
```

---

## 기여하기

기여를 환영합니다! 다음과 같이 도울 수 있습니다:

### 이슈 보고
- **버그 보고**: [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues) 페이지를 사용하세요
- **기능 요청**: 새로운 기능이나 개선 사항을 제안하세요
- **보안 취약점**: 이메일로 비공개 보고해 주세요 (GitHub 프로필 참조)

### 풀 리퀘스트 제출
1. 저장소를 **포크**하세요
2. **브랜치 생성**: `git checkout -b feature/your-feature`
3. **변경 사항 커밋**: `git commit -m 'Add some feature'`
4. **푸시**: `git push origin feature/your-feature`
5. **풀 리퀘스트 열기**

### 개발 환경 설정
```bash
# 저장소 클론
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# 의존성 설치
npm install

# 프로젝트 빌드
npm run build

# 테스트 실행
npm test
```

### 도움이 필요한 분야
- **문서화**: 가이드 개선, 튜토리얼 추가, 더 많은 언어로 번역
- **새 체인**: 추가 EVM 또는 비EVM 체인 지원 추가
- **UI/UX 개선**: 데스크톱 지갑 인터페이스 향상
- **테스트**: 단위/통합 테스트 작성, 테스트 커버리지 개선

### 코드 스타일
- 엄격한 타입 검사가 포함된 **TypeScript** 사용
- **Prettier** 포매팅 준수 (`.prettierrc`에 설정됨)
- 의미 있는 커밋 메시지 작성
- 새 기능에 대한 테스트 추가

### 커뮤니티 참여
- **Discord**: [서버 참여](https://discord.gg/clawd) (준비 중)
- **Twitter**: 업데이트를 위해 [@janespace_ai](https://twitter.com/janespace_ai) 팔로우
- **GitHub Discussions**: 질문이나 아이디어를 위한 토론 시작

---

## 라이선스

MIT (C) [janespace-ai](https://github.com/janespace-ai)
