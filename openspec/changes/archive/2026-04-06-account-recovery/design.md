## Context

HD wallet derivation path: `m/44'/60'/0'/0/{index}`, indices 0–9.

After deregister + re-import, `AccountManager` only registers index 0. Indices 1–9 exist on-chain but are unknown to the app. `AccountManager.getAddress(mnemonic, index)` and `KeyManager.getAddressForAccountIndex(index)` can derive them without persisting anything — we only persist after explicit user confirmation.

Existing building blocks:
- `AccountManager.deriveAccount(mnemonic, index)` — derives address + private key for any index
- `AccountManager.hasAccount(index)` — checks if index is already in `wallet.db`
- `BalanceService.getWalletBalances(address)` — queries all configured networks, returns `TokenBalance[]`
- `KeyManager.getMnemonicIfUnlocked()` — returns mnemonic only while unlocked
- IPC pattern: request/response via `ipcMain.handle`

## Design Decisions

### 1. Scan one index per IPC call (`wallet:recover-scan-next`)

The renderer controls the loop. Each call receives `fromIndex: number` (starts at 1) and returns:
```ts
type ScanResult =
  | { status: "found"; index: number; address: string; balances: TokenBalance[] }
  | { status: "empty"; nextIndex: number }   // this index has no balance, caller should try nextIndex
  | { status: "done" }                        // reached max index with no more to scan
  | { status: "already-registered" }          // index already in wallet.db, skip it
```

The renderer drives the state machine: call → if `empty`, call again with `nextIndex`; if `found`, show confirmation; if `done`, show "no more accounts found".

A 1-second delay is added in the handler between each network query to keep scanning slow and avoid hammering public RPCs.

### 2. Skip already-registered indices silently

If `AccountManager.hasAccount(index)` returns true, return `{ status: "already-registered", nextIndex: index + 1 }`. The renderer loops automatically.

### 3. "Has balance" threshold: any non-zero amount on any network

A sub-account is considered worth showing if `balances.some(b => parseFloat(b.amount) > 0)`.

### 4. Import uses existing `wallet:create-sub-account` flow, but at a specific index

Currently `createAccount` auto-picks the next free index. We need `createAccountAtIndex(mnemonic, index, nickname?)` that inserts at a specific index (or throws if already taken). This is a small addition to `AccountManager`.

Alternatively: since we already know the index is free (we checked `hasAccount` above), we can add a `forceIndex` option to `createAccount`.

**Decision**: Add `importAccountAtIndex(mnemonic: string, index: number, nickname?: string): Account` to `AccountManager`. Same logic as `createAccount` but skips the auto-increment, uses the given index, and throws if already occupied.

### 5. Inter-scan delay: 1 second per index in the handler

`await new Promise(r => setTimeout(r, 1000))` before returning `empty` or `already-registered`. For `found`, no artificial delay — user is looking at a modal.

### 6. UI flow

```
[Add Account Modal]
  └─ click "Or → Recover existing sub-accounts"
       └─ [Scanning Modal]  ←── renders while await recoverScanNext(currentIndex)
            ├─ result: found  → [Found Account Modal]
            │     ├─ "Import this account" → importAccountAtIndex → back to account list
            │     └─ "Skip, find next"    → [Scanning Modal] with nextIndex = found.index + 1
            ├─ result: empty/already-registered → [Scanning Modal] auto-advances
            └─ result: done  → inline message "No more sub-accounts found" + close button
```

Cancel button in scanning modal: sets a `cancelled` flag; the renderer stops calling `recoverScanNext`.

### 7. Max index

Scan indices 1 through 9 inclusive. When `fromIndex > 9`, return `{ status: "done" }` immediately.

## Risks / Trade-offs

**[Risk] Public RPCs rate-limit rapid sequential queries** → 1-second inter-index delay mitigates this. Each index also queries all chains (currently 8), so there are 8 parallel requests per index — still well within free-tier limits.

**[Risk] User cancels mid-scan** → Renderer simply stops calling the IPC handler. No cleanup needed on main process side.

**[Trade-off] One IPC call per index vs. scanning all in background** → Per-call is simpler to cancel, easier to show incremental progress, and avoids a long-running background task that could outlive the modal.

**[Trade-off] importAccountAtIndex vs reusing createAccount** → Separate method is clearer and safer; avoids coupling recovery logic into the existing auto-increment path.
