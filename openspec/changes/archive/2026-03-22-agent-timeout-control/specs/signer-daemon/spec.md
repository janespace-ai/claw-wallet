## MODIFIED Requirements

### Requirement: WalletConnection fetch timeout
The `WalletConnection` class SHALL enforce a timeout on every outgoing HTTP request using `AbortController`. The timeout SHALL vary by operation type:

| Operation | Timeout | Configurable via |
|-----------|---------|------------------|
| `pair()` GET `/pair/:code` | 10s | `pairTimeoutMs` |
| `pair_complete` POST to relay | 15s | — |
| `sign_transaction` / `sign_message` | 120s (default) | `signTimeoutMs` |
| Other `sendToWallet()` methods | 30s | `relayTimeoutMs` |

When a timeout fires, the request SHALL be aborted and an Error with message "Request timeout (<N>s)" SHALL be thrown.

#### Scenario: Pair code validation times out
- **WHEN** Agent calls `pair("ABC123")` and Relay does not respond within 10 seconds
- **THEN** `pair()` throws Error "Request timeout (10s)"

#### Scenario: Sign transaction with custom timeout
- **WHEN** Agent calls `sendToWallet("sign_transaction", params)` and config `signTimeoutMs` is 180000
- **THEN** the HTTP request uses a 180-second timeout and passes `timeout: 180` to the Relay

#### Scenario: Generic method uses default timeout
- **WHEN** Agent calls `sendToWallet("get_status", {})` with no special timeout config
- **THEN** the HTTP request uses a 30-second timeout

### Requirement: Pre-flight health check
Before sending an encrypted request to the Relay, `sendToWallet()` SHALL perform a cached health check against `GET /health` with a 5-second timeout. If the health check fails, an Error "Relay Server unreachable" SHALL be thrown immediately without attempting the relay request. The health check result SHALL be cached for 30 seconds.

#### Scenario: Relay unreachable
- **WHEN** Agent calls `sendToWallet("sign_transaction", params)` and `GET /health` fails or times out
- **THEN** `sendToWallet()` throws Error "Relay Server unreachable" within 5 seconds

#### Scenario: Health check cached
- **WHEN** Agent calls `sendToWallet()` twice within 30 seconds and the first health check succeeds
- **THEN** the second call skips the health check and proceeds directly

### Requirement: Timeout configuration
The `AgentConfig` SHALL include the following timeout fields, configurable via environment variables and config.json:

| Field | Env Var | Default |
|-------|---------|---------|
| `pairTimeoutMs` | `CLAW_AGENT_PAIR_TIMEOUT_MS` | 10000 |
| `relayTimeoutMs` | `CLAW_AGENT_RELAY_TIMEOUT_MS` | 30000 |
| `signTimeoutMs` | `CLAW_AGENT_SIGN_TIMEOUT_MS` | 120000 |

#### Scenario: Environment variable override
- **WHEN** `CLAW_AGENT_SIGN_TIMEOUT_MS=300000` is set
- **THEN** `signTimeoutMs` resolves to 300000
