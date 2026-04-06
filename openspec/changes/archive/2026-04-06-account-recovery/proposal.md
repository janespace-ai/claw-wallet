## Why

When a user deregisters the desktop app, the entire `dataDir` (including `wallet.db`) is wiped. On re-import with the same mnemonic, only account index 0 is restored — any sub-accounts the user had created (indices 1–9) are lost from the app's perspective, even though their funds remain on-chain.

Users have no way to discover and re-import those sub-accounts without knowing the exact HD index and manually deriving the address. This is a significant UX friction for anyone who used sub-accounts.

## What Changes

Add a "Recover sub-accounts" flow accessible from the existing "Add account" modal. The flow scans HD wallet indices 1–9 one at a time, checks on-chain balances slowly, skips zero-balance accounts, and presents each found account in a confirmation modal — letting the user import it or skip to the next.

- **Backend**: New IPC handler `wallet:recover-scan-next` that derives one address, queries its balance across all configured networks, and returns the result (address, index, balances) or `null` if no balance found and max index reached
- **Frontend**: Three UI states driven by the existing "Add account" modal entry point:
  1. Add account modal gains an "Or → Recover existing sub-accounts" link
  2. Scanning state modal (progress bar, current index, cancel button)
  3. Found account modal (address, per-chain balances, "Import" / "Skip to next" buttons)

## Capabilities

### New Capabilities

- Scan HD indices 1–9 for sub-accounts with on-chain balance
- Present each found account with its address and per-chain balance summary
- Import a found account into `wallet.db` with an optional nickname
- Skip a found account and continue scanning for the next

### Modified Capabilities

- "Add account" modal gains a secondary entry point for account recovery

## Non-Goals

- Does not scan index 0 (always present after import)
- Does not scan beyond index 9 (hard cap at 10 accounts total)
- Does not recover sub-accounts that have zero balance (user must have funds to confirm ownership)
- Does not modify the deregister/wipe behavior itself

## Impact

- **desktop/src/main/index.ts**: New `wallet:recover-scan-next` IPC handler
- **desktop/src/main/account-manager.ts**: New `getAddress(mnemonic, index)` already exists; new helper to check if index is already registered
- **desktop/src/renderer/app.js**: New modal states for scanning and found-account confirmation; link added to existing add-account modal
- **desktop/src/preload/index.ts**: Expose `recoverScanNext(fromIndex)` via `contextBridge`
- No changes to agent, relay, or signing engine
