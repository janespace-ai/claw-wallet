## 1. Relay Server: HTTP Bridge Endpoint

- [x] 1.1 Add `SendAndWait(pairId string, requestId string, message []byte, timeout time.Duration) ([]byte, error)` method to Hub — maintains `pendingHTTP map[string]chan []byte`, sends message to WS peer, blocks on response channel
- [x] 1.2 Modify `readPump` to check incoming WS messages for `requestId` matching a pending HTTP request — if matched, route to the pending channel instead of fan-out broadcast
- [x] 1.3 Add cleanup: when a WS client disconnects, notify all pending HTTP requests for that pairId with an error
- [x] 1.4 Add `POST /relay/:pairId` Hertz handler — parse JSON body, extract `requestId`, wrap in sourceIP envelope, call `hub.SendAndWait`, return response or error (404/504/502/429)
- [x] 1.5 Add rate limiting for the HTTP relay endpoint (30 req/min per IP)
- [x] 1.6 Register the new route in `main.go`
- [x] 1.7 Write tests for `SendAndWait` (success, no peer, timeout, concurrent requests)
- [x] 1.8 Write integration tests for `POST /relay/:pairId` endpoint (success, 404, 504, 429)

## 2. Agent SDK: WalletConnection Class

- [x] 2.1 Create `agent/src/wallet-connection.ts` with `WalletConnection` class — constructor takes `relayUrl`, `dataDir`; methods: `pair(shortCode)`, `getAddress()`, `sendToWallet(method, params)`, `hasPairing()`
- [x] 2.2 Implement `pair()` — HTTP GET `/pair/{code}`, generate/load X25519 keypair, derive pairId + shared key, send encrypted `pair_complete` via `POST /relay/{pairId}`, save pairing to disk
- [x] 2.3 Implement `sendToWallet()` — load pairing, derive session, encrypt request with `requestId`, `POST /relay/{pairId}`, decrypt response, destroy session
- [x] 2.4 Implement `getAddress()` — read from local `pairing.json`
- [x] 2.5 Implement pairing persistence — `loadPairing()` / `savePairing()` using existing `pairing.json` format
- [x] 2.6 Write tests for `WalletConnection` (pairing persistence, encryption round-trip, error handling)

## 3. Agent SDK: Refactor ClawWallet and Tool Registry

- [x] 3.1 Update `ClawWallet` to use `WalletConnection` instead of `SignerClient` — replace IPC calls with `walletConnection.sendToWallet()` / `walletConnection.getAddress()`
- [x] 3.2 Update `tool-registry.ts` — replace `SignerClient` dependency with `WalletConnection` in `ToolDependencies`
- [x] 3.3 Update `wallet-pair.ts` tool — use `walletConnection.pair(shortCode)` instead of `signerClient.call("wallet_pair")`
- [x] 3.4 Update `wallet-create.ts` and `wallet-import.ts` tools — return delegation messages directly (no IPC call needed)
- [x] 3.5 Update `transfer.ts` — use `walletConnection.sendToWallet("sign_transaction", params)` instead of `signerClient.call("sign_transaction")`
- [x] 3.6 Update `index.ts` exports — export `WalletConnection`, remove `SignerClient` and `RelaySigner` exports

## 4. Remove Obsolete Code

- [x] 4.1 Delete `agent/src/signer/relay-client.ts` (RelaySigner)
- [x] 4.2 Delete `agent/src/signer/ipc-server.ts` (IpcServer)
- [x] 4.3 Delete `agent/src/signer/ipc-client.ts` (SignerClient)
- [x] 4.4 Delete `agent/src/signer/ipc-protocol.ts` (JSON-RPC protocol)
- [x] 4.5 Delete `agent/src/signer/index.ts` (barrel export)
- [x] 4.6 Delete `agent/src/e2ee/transport.ts` (RelayTransport WebSocket client)
- [x] 4.7 Remove `ws` package from agent `package.json` dependencies
- [x] 4.8 Remove `agent/src/signer/` directory (now empty)
- [x] 4.9 Update or remove signer-related tests in `agent/tests/signer/`

## 5. Simplify MCP Server

- [x] 5.1 Rewrite `mcp-server/src/index.ts` — create `ClawWallet` instance, call `getTools()`, register with MCP. Remove `SignerClient`, socket path config, and manual dependency wiring
- [x] 5.2 Update `mcp-server/package.json` — remove any unused dependencies
- [x] 5.3 Update MCP server tests

## 6. Update Skills and Documentation

- [x] 6.1 Update `agent/skills/claw-wallet-setup/SKILL.md` — remove RelaySigner startup instructions, simplify to just MCP server config
- [x] 6.2 Update `agent/skills/claw-wallet/SKILL.md` — remove any references to signer process
- [x] 6.3 Update `agent/config.example.json` — remove signer-related config if present

## 7. Validation

- [x] 7.1 Run `go test ./...` in `server/` — all existing + new tests pass
- [x] 7.2 Run `npm run build` in `agent/` — build succeeds
- [x] 7.3 Run `npm test` in `agent/` — all tests pass
- [x] 7.4 Run `npm run build` in `agent/mcp-server/` — build succeeds
- [x] 7.5 Verify `ws` package is no longer in agent dependencies
