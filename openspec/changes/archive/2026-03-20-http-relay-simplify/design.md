## Context

The Claw Wallet uses a three-tier architecture: Agent SDK → Relay Server → Desktop Wallet. Currently the Agent communicates with the Relay via persistent WebSocket connections managed by `RelayTransport`, and signing requests are routed through a separate `RelaySigner` process accessible over Unix Socket IPC. This worked for the initial prototype but introduces unnecessary complexity: a separate daemon process, IPC serialization, WebSocket lifecycle management, and ~680 lines of transport code. Only 2 of 17 tools actually need to talk to the Desktop Wallet.

The Desktop Wallet always maintains a WebSocket connection to the Relay Server. This will not change. The Agent side is the only part being restructured.

## Goals / Non-Goals

**Goals:**
- Replace agent-side WebSocket with stateless HTTP requests to the Relay Server
- Eliminate the RelaySigner daemon and IPC layer entirely
- Add an HTTP→WS bridge endpoint to the Go Relay Server
- Preserve E2EE security guarantees (X25519 + AES-256-GCM)
- Simplify MCP Server to a thin SDK wrapper
- Maintain backward compatibility for Desktop Wallet (zero changes)
- Enable future mobile wallet support (push notification + message queue can be added to the same HTTP endpoint later)

**Non-Goals:**
- Mobile wallet push notification support (future work)
- Message persistence / queue in the Relay Server (future work; this change uses synchronous HTTP hold)
- Changes to the Desktop Wallet code
- Changes to the E2EE cryptographic primitives
- Agent-to-Agent communication

## Decisions

### 1. Synchronous HTTP bridge endpoint (`POST /relay/{pairId}`)

**Decision**: Add a new HTTP endpoint to the Relay Server that accepts an agent message, forwards it to the WebSocket-connected wallet for that pairId, and synchronously waits for the wallet's response before returning the HTTP response.

**Alternatives considered**:
- *Polling*: Agent sends message, polls for response. More complex, higher latency, extra state management.
- *Server-Sent Events*: Agent opens SSE stream. Still requires persistent connection, doesn't solve the core problem.
- *WebSocket kept as-is, fix MCP Server*: Just start `RelaySigner` inside MCP Server. Retains all complexity, doesn't improve mobile future.

**Rationale**: Signing is inherently request-response. HTTP synchronous hold is the simplest model and maps directly to MCP tool execution (call → wait → return). The Relay holds the HTTP connection for up to 120 seconds (matching current sign timeout), which is well within HTTP keep-alive limits.

### 2. Hub gains `SendAndWait` method

**Decision**: Expose a new method on the Go `Hub` struct: `SendAndWait(pairId string, message []byte, timeout time.Duration) ([]byte, error)`. This method finds the WebSocket peer for the given pairId, sends the message through its `Send` channel, and blocks on a response channel until a reply arrives or timeout occurs.

**Implementation approach**:
- The Hub maintains a `pendingHTTP map[string]chan []byte` keyed by a unique `requestId` embedded in the message.
- When a WS client sends a message that contains a `requestId` matching a pending HTTP request, the Hub routes the response to the waiting channel instead of broadcasting it.
- The HTTP handler creates the channel, registers it, sends the message, and blocks on the channel with timeout via `select`.

**Alternatives considered**:
- *Virtual client*: Create a fake `*Client` with no real WebSocket. Rejected because it pollutes the pair's client list and triggers rate limits and disconnect notifications.
- *Separate response endpoint*: Agent polls `GET /relay/{pairId}/response/{requestId}`. Rejected for added complexity.

**Rationale**: `SendAndWait` is clean, contained, and doesn't interfere with existing WS routing. The `requestId` matching ensures responses are correctly correlated even if multiple HTTP requests are in-flight.

### 3. `WalletConnection` replaces `RelaySigner` + `RelayTransport` + `SignerClient`

**Decision**: Create a new `WalletConnection` class in the agent SDK that handles:
- Loading/saving pairing credentials from disk
- E2EE encryption/decryption using stored keys
- Sending messages to the Relay via HTTP `fetch()`
- Pairing flow (HTTP GET to `/pair/{code}`, then encrypted pair_complete via HTTP bridge)

**Key design**: `WalletConnection` is stateless per-request. It loads the E2EE session key from stored pairing data on each call, encrypts the request, sends it via HTTP, decrypts the response. No persistent connections, no reconnection logic, no background threads.

**Alternatives considered**:
- *Keep RelaySigner, embed in MCP Server*: Still requires IPC server, complex lifecycle. Rejected.
- *Make SDK a thin HTTP-only client without E2EE*: Move E2EE to Relay Server. Rejected because it breaks the zero-trust relay model.

**Rationale**: Matches the stateless tool execution model perfectly. The E2EE session key is derived deterministically from stored pairing keys, so it can be recreated on each request without a handshake.

### 4. E2EE session key reuse from stored pairing

**Decision**: After initial pairing, both the agent public key and peer (wallet) public key are stored in `pairing.json`. On each request, `WalletConnection` re-derives the shared secret via X25519 ECDH and HKDF, creating a fresh session for encryption. The session is destroyed after each request.

**Important**: Sequence numbers must be managed carefully. Since each HTTP request creates a new session, we use request-scoped sequence counters (starting from 0 for each request). The Desktop Wallet already tries all active sessions for decryption (brute-force across sessions), so this is compatible. However, we should use a per-request random nonce prefix approach instead of monotonic counters for the HTTP model.

**Alternative**: Maintain a persistent session in memory. Rejected because it reintroduces state that must survive across MCP tool calls.

### 5. MCP Server becomes a thin `ClawWallet` wrapper

**Decision**: The MCP Server simply creates a `ClawWallet` instance, calls `getTools()`, and registers them with the MCP protocol. No `SignerClient`, no socket path, no IPC.

**Config**: Only `RELAY_URL`, `DATA_DIR`, and `DEFAULT_CHAIN` environment variables needed.

## Risks / Trade-offs

- **[Risk] HTTP timeout for slow signing (user needs to approve on phone/desktop)** → Mitigation: 120-second HTTP timeout matches current WebSocket timeout. If this becomes insufficient for future mobile wallets, switch to polling or WebSocket on the Relay response path.

- **[Risk] Per-request E2EE session creation adds CPU overhead** → Mitigation: X25519 ECDH + HKDF is ~0.1ms on modern hardware. Signing operations are rare (not high-frequency), so this is negligible.

- **[Risk] Breaking change for existing IPC consumers** → Mitigation: The only IPC consumers are the MCP Server and `ClawWallet` class, both within this monorepo. No external consumers known.

- **[Risk] Relay Hub `pendingHTTP` map could leak if responses never arrive** → Mitigation: Cleanup in a deferred function with the HTTP handler's timeout. The `select` with `time.After` ensures the channel is always cleaned up.

- **[Risk] Multiple HTTP requests in-flight for same pairId** → Mitigation: Each request has a unique `requestId`. The Hub matches responses by `requestId`, not by `pairId`, so concurrent requests are safe.

- **[Trade-off] Slightly higher latency per signing request (TCP+TLS handshake)** → Acceptable because signing operations are infrequent and user-initiated. HTTP keep-alive can mitigate if needed.
