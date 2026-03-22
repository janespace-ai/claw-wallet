## Why

The Agent currently communicates with the Desktop Wallet through a 3-layer chain: MCP Server → IPC Unix Socket → RelaySigner → WebSocket/E2EE → Relay Server → Desktop. This architecture was designed around a persistent WebSocket connection with stateful E2EE sessions, which required a separate long-running RelaySigner daemon process. In practice, (1) only 2 of 17 tools actually communicate with the Desktop (`sign_transaction` and `wallet_pair`), (2) the MCP Server is already a long-running process making the separate RelaySigner redundant, and (3) persistent WebSocket connections are incompatible with future mobile wallet platforms (iOS/Android background restrictions). Replacing the agent-side WebSocket with stateless HTTP relay requests eliminates two entire code layers (IPC + RelaySigner), fixes the current "Signer not running" bug, enables future mobile wallet support, and reduces the MCP Server to a thin shell over the SDK.

## What Changes

- **New**: Add `POST /relay/{pairId}` HTTP endpoint to the Go Relay Server — accepts an E2EE-encrypted message, forwards it to the WebSocket-connected Wallet for that pairId, waits for the response, and returns it as the HTTP response
- **New**: Create `WalletConnection` class in the agent SDK — a stateless HTTP client that handles E2EE encryption/decryption and relay communication via `fetch()`, replacing both `RelayTransport` (WebSocket) and `RelaySigner` (IPC + routing)
- **Remove**: `RelayTransport` (agent/src/e2ee/transport.ts) — WebSocket client, ~200 lines
- **Remove**: `RelaySigner` (agent/src/signer/relay-client.ts) — IPC server + WS routing, ~300 lines
- **Remove**: `IpcServer` (agent/src/signer/ipc-server.ts) — Unix socket server, ~87 lines
- **Remove**: `IpcClient` / `SignerClient` (agent/src/signer/ipc-client.ts) — Unix socket client, ~92 lines
- **Simplify**: MCP Server — remove SignerClient, use `ClawWallet.getTools()` directly (becomes ~30 lines of effective code)
- **Simplify**: `ClawWallet` SDK entry point — use `WalletConnection` directly instead of `SignerClient`
- **BREAKING**: Remove Unix Socket IPC protocol — any external code depending on `SignerClient` or `IpcServer` must switch to the SDK or MCP

## Capabilities

### New Capabilities

- `http-relay-bridge`: The Relay Server's HTTP endpoint for synchronous message relay between Agent (HTTP) and Wallet (WebSocket), including message queuing, timeout management, and E2EE passthrough

### Modified Capabilities

- `e2ee-communication`: Agent-side E2EE transport changes from WebSocket to HTTP; session key reuse from stored pairing credentials instead of live handshake; Desktop side unchanged
- `go-relay-server`: New HTTP endpoint added; Hub gains a `SendAndWait` method for HTTP→WS message bridging
- `signer-daemon`: RelaySigner and IPC protocol removed; replaced by in-process `WalletConnection` class
- `openclaw-plugin`: Tool dependencies change from `SignerClient` to `WalletConnection`; tool behavior unchanged

## Impact

- **Relay Server (Go)**: New HTTP handler + Hub method. Existing WebSocket routing unchanged. Desktop Wallet connection unaffected.
- **Agent SDK (TypeScript)**: Major simplification. ~680 lines removed (transport.ts, relay-client.ts, ipc-server.ts, ipc-client.ts). ~150 lines added (WalletConnection). Net reduction ~530 lines.
- **MCP Server**: Simplified to pure SDK wrapper. No longer needs `SignerClient` or socket path config. Only needs `RELAY_URL` and `DATA_DIR`.
- **Desktop Wallet**: No changes. Desktop continues to use WebSocket to Relay Server. The relay envelope format (`{sourceIP, data}`) and E2EE message format (`{type: "encrypted", payload}`) remain identical.
- **Dependencies**: `ws` package can be removed from agent SDK dependencies (no longer a WebSocket client).
- **Skills**: Update `claw-wallet-setup/SKILL.md` to remove RelaySigner startup instructions.
