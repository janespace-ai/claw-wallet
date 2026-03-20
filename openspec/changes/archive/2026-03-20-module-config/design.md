## Context

三个模块的配置成熟度差异很大：

- **Server（Go）**：仅 `PORT` 通过环境变量配置，其余 ~20 个参数（限流、超时、CORS、WebSocket、配对码）全部硬编码
- **Desktop（Electron）**：刚引入了 `config.ts`（env → config.json → 默认值），但只覆盖 `relayUrl`、`ipChangePolicy`、`lockMode` 三个字段，另有 ~13 个参数硬编码
- **Agent（TypeScript 库）**：通过构造函数接受 6 个选项，但签名超时、重连策略、默认策略限额等 ~15 个参数硬编码在源码中，且无文件/环境变量配置能力

Desktop 的 `config.ts` 已经建立了一个好的模式（三层优先级：环境变量 > config.json > 默认值），本次设计的核心是把这个模式推广到另外两个模块，并扩展 Desktop 自身的配置范围。

## Goals / Non-Goals

**Goals:**

- 每个模块有一个 `config.json`（或 Go 等价物）+ `config.example.json`，开发者拷贝后修改即可
- 所有运维可调参数从硬编码提取为配置项，附带合理默认值
- Server 和 Agent 采用与 Desktop 一致的优先级模式：环境变量 > 配置文件 > 默认值
- 配置文件不提交到 Git（`.gitignore`），示例文件提交
- 所有配置项必须附带英文说明（Go struct 使用 field comments，TypeScript 接口使用 JSDoc，config.example.json 使用 `_comment` 伴随字段或独立 README 说明）

**Non-Goals:**

- 不引入配置管理框架（如 viper for Go、cosmiconfig for Node）——项目规模不需要
- 不做运行时热重载——修改配置后重启即可
- 不改变 Agent 的 `ClawWalletOptions` 构造函数 API——构造参数仍优先于文件配置
- 不配置化安全常量（如加密算法选择、BIP44 路径、scrypt 参数）——这些应保持硬编码
- 不配置化 UI 相关参数（窗口尺寸等）

## Decisions

### 1. Server 配置方案

**决策**：在 `server/` 下新增 `config.go` 模块，启动时尝试读取 `config.json`，字段可通过环境变量覆盖。

**配置结构**（Go struct）：

```go
type Config struct {
    Port               string        `json:"port"`               // Server listen port (env: PORT, default: "8080")
    CORSAllowedOrigins []string      `json:"corsAllowedOrigins"` // Allowed CORS origins, use ["*"] for dev (env: CORS_ORIGINS, default: ["*"])
    GracefulShutdown   string        `json:"gracefulShutdown"`   // Graceful shutdown timeout, e.g. "10s" (default: "10s")
    WS                 WSConfig      `json:"ws"`                 // WebSocket connection parameters
    RateLimit          RateLimitConfig `json:"rateLimit"`         // Rate limiting parameters
    Pairing            PairingConfig `json:"pairing"`            // Pairing code parameters
}

type WSConfig struct {
    ReadLimitBytes int64  `json:"readLimitBytes"` // Max WebSocket message size in bytes (default: 65536 = 64KB)
    ReadTimeout    string `json:"readTimeout"`    // Read deadline / pong wait timeout, e.g. "60s" (default: "60s")
    WriteTimeout   string `json:"writeTimeout"`   // Write deadline for outgoing messages, e.g. "10s" (default: "10s")
    PingInterval   string `json:"pingInterval"`   // Interval between ping frames, e.g. "30s" (default: "30s")
}

type RateLimitConfig struct {
    MessageRate       int    `json:"messageRate"`       // Max messages per second per client (default: 100)
    ConnectionRate    int    `json:"connectionRate"`    // Max new connections per minute per pair (default: 10)
    MaxIPsPerPair     int    `json:"maxIPsPerPair"`     // Max unique IPs allowed per pair ID (default: 2)
    MaxClientsPerPair int    `json:"maxClientsPerPair"` // Max concurrent WebSocket clients per pair (default: 2)
    CleanupInterval   string `json:"cleanupInterval"`   // Interval to purge expired rate-limit buckets, e.g. "5m" (default: "5m")
}

type PairingConfig struct {
    CodeLength      int    `json:"codeLength"`      // Length of generated pairing codes (default: 8)
    CodeTTL         string `json:"codeTTL"`         // Time-to-live for pairing codes, e.g. "10m" (default: "10m")
    IPRateLimit     int    `json:"ipRateLimit"`     // Max pairing code creates per minute per IP (default: 10)
    CleanupInterval string `json:"cleanupInterval"` // Interval to purge expired codes, e.g. "1m" (default: "1m")
}
```

**理由**：Go 标准库的 `encoding/json` 足以读取 JSON，`os.Getenv` 覆盖关键字段，无需引入 viper。

### 2. Desktop 配置扩展方案

**决策**：扩展现有 `AppConfig` 接口，添加嵌套配置块。各模块通过 `config` 对象接收参数，而非自己持有硬编码常量。

**扩展字段**：

```typescript
interface AppConfig {
    /** Relay server WebSocket URL, e.g. "ws://localhost:8080" */
    relayUrl: string;
    /** IP change policy: "block" rejects, "warn" alerts, "allow" ignores */
    ipChangePolicy: "block" | "warn" | "allow";
    /** Lock mode: "convenience" allows biometric, "strict" enforces password */
    lockMode: "convenience" | "strict";

    relay: {
        /** Base delay in ms before first reconnect attempt (default: 1000) */
        reconnectBaseMs: number;
        /** Maximum reconnect delay in ms, caps exponential backoff (default: 30000) */
        reconnectMaxMs: number;
    };
    signing: {
        /** Maximum total USD value of auto-approved transactions per day (default: 100) */
        dailyLimitUsd: number;
        /** Maximum USD value per single auto-approved transaction (default: 50) */
        perTxLimitUsd: number;
        /** Token symbols allowed for auto-approval (default: ["ETH","USDC","USDT"]) */
        tokenWhitelist: string[];
    };
    lock: {
        /** Idle timeout in ms before auto-lock in strict mode (default: 300000 = 5min) */
        strictIdleTimeoutMs: number;
    };
    security: {
        /** Maximum number of security events to retain in memory (default: 1000) */
        maxEvents: number;
    };
}
```

**理由**：保持已有的 `config.ts` 模式不变，只扩展接口。嵌套结构使配置文件层次清晰。

### 3. Agent 配置方案

**决策**：在 `agent/` 下新增 `config.ts` 模块，采用与 Desktop 相同的三层优先级。构造函数参数优先于文件配置（即四层：constructor > env > config.json > defaults）。

**配置结构**：

```typescript
interface AgentConfig {
    /** Timeout in ms waiting for Desktop Wallet to sign a transaction (default: 120000 = 2min) */
    signTimeoutMs: number;
    /** Base delay in ms before first reconnect attempt (default: 1000) */
    reconnectBaseMs: number;
    /** Maximum reconnect delay in ms, caps exponential backoff (default: 30000) */
    reconnectMaxMs: number;
    policy: {
        /** Maximum USD value per single transaction before requiring approval (default: 100) */
        perTxLimitUsd: number;
        /** Maximum total USD value of transactions per day (default: 500) */
        dailyLimitUsd: number;
        /** Policy mode: "supervised" requires whitelist, "autonomous" allows any address within limits (default: "supervised") */
        mode: "supervised" | "autonomous";
    };
}
```

**理由**：Agent 作为库被其他程序引用，构造函数参数必须保持最高优先级。文件配置是补充，方便独立部署时调参。

### 4. 环境变量命名约定

**决策**：三个模块统一采用 `CLAW_<MODULE>_<FIELD>` 格式，如：
- `CLAW_SERVER_PORT`、`CLAW_SERVER_CORS_ORIGINS`
- `CLAW_DESKTOP_RELAY_URL`
- `CLAW_AGENT_SIGN_TIMEOUT_MS`

Server 保留对 `PORT` 的向后兼容（优先检查 `CLAW_SERVER_PORT`，回退到 `PORT`）。

**理由**：带前缀避免环境变量冲突，模块标识清晰。

## Risks / Trade-offs

- **[配置项过多导致认知负担]** → 用合理默认值缓解，`config.example.json` 只展示最常调整的字段，注释说明其余可选项
- **[Desktop 的 `relay-bridge.ts` 有独立的 `DEFAULT_RELAY_URL`]** → 迁移时消除这个重复，统一从 `config` 读取
- **[Server 的 CORS `*` 和 CheckOrigin 仍默认全开]** → 配置化后默认值保持 `*`（开发友好），文档中强调生产环境必须限制
- **[Agent config.json 路径问题]** → Agent 作为库，config.json 应查找 cwd 和 dataDir，而非固定路径
