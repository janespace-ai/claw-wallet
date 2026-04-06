## 1. Backend: AccountManager

- [x] 1.1 Add `importAccountAtIndex(mnemonic: string, index: number, nickname?: string): Account` to `AccountManager`
  - Validate `0 <= index <= 9`
  - Throw if `hasAccount(index)` returns true
  - Derive address via `deriveAccount(mnemonic, index)`
  - Insert row into `accounts` table with the given index
  - Add to `this.accounts` map
  - Return the new `Account`

## 2. Backend: IPC handler

- [x] 2.1 Add `wallet:recover-scan-next` handler in `desktop/src/main/index.ts`
  - Signature: `ipcMain.handle("wallet:recover-scan-next", async (_, fromIndex: number)`
  - Guard: throw if wallet locked (`keyManager.getMnemonicIfUnlocked()` returns null)
  - If `fromIndex > 9`: return `{ status: "done" }`
  - If `hasAccount(fromIndex)`: return `{ status: "already-registered", nextIndex: fromIndex + 1 }`
  - Derive address: `accountManager.deriveAccount(mnemonic, fromIndex).address`
    _(note: `deriveAccount` is currently private — expose as package-internal or add a public `getAddressOnly(mnemonic, index)` wrapper)_
  - Query balances: `await balanceService.getWalletBalances(address, undefined, false)` (skip cache)
  - Add 1-second delay: `await new Promise(r => setTimeout(r, 1000))`
  - If `balances.some(b => parseFloat(b.amount) > 0)`:
    return `{ status: "found", index: fromIndex, address, balances }`
  - Else: return `{ status: "empty", nextIndex: fromIndex + 1 }`

- [x] 2.2 Add `wallet:import-recovered-account` handler
  - Signature: `ipcMain.handle("wallet:import-recovered-account", async (_, index: number, nickname?: string)`
  - Guard: throw if locked
  - Call `accountManager.importAccountAtIndex(mnemonic, index, nickname)`
  - Call `balanceService.clearCache()`
  - Call `relayBridge?.refreshChannels()`
  - Return `listWalletAccountsForRenderer()`

## 3. Preload

- [x] 3.1 Add to `desktop/src/preload/index.ts`:
  ```ts
  recoverScanNext: (fromIndex: number) =>
    ipcRenderer.invoke("wallet:recover-scan-next", fromIndex),
  importRecoveredAccount: (index: number, nickname?: string) =>
    ipcRenderer.invoke("wallet:import-recovered-account", index, nickname),
  ```
- [x] 3.2 Add types for `ScanResult` to the `WalletAPI` interface

## 4. Frontend: Add Account modal entry point

- [x] 4.1 In `desktop/src/renderer/app.js`, find the "Add account" modal HTML template (search for `wallet:create-sub-account` usage or the modal render function)
- [x] 4.2 Add a styled link below the nickname input
- [x] 4.3 Add click handler on `#btn-open-recover` that closes the add-account modal and opens the scanning modal (starting at index 1)

## 5. Frontend: Scanning modal

- [x] 5.1 Add `showScanningModal(currentIndex)` function that renders the scanning state:
  - Title: "Scanning for sub-accounts"
  - Progress bar: `(currentIndex / 10) * 100%` width, accent color
  - Counter: `Scanning account #${currentIndex}  ·  ${currentIndex} / 10`
  - Hint: "Only accounts with balance will be shown"
  - Cancel button → sets `recoveryCancelled = true`, closes modal
- [x] 5.2 Add `startRecovery(fromIndex)` async function:
  ```js
  async function startRecovery(fromIndex) {
    recoveryCancelled = false;
    let idx = fromIndex;
    while (idx <= 9 && !recoveryCancelled) {
      showScanningModal(idx);
      const result = await window.walletAPI.recoverScanNext(idx);
      if (recoveryCancelled) break;
      if (result.status === "done") { showRecoveryDone(); break; }
      if (result.status === "found") { showFoundAccountModal(result); return; }
      // empty or already-registered: advance
      idx = result.nextIndex;
    }
    if (!recoveryCancelled && idx > 9) showRecoveryDone();
  }
  ```

## 6. Frontend: Found account modal

- [x] 6.1 Add `showFoundAccountModal(result)` function:
  - Title: "Sub-account found"
  - Index label: `Account #${result.index} (index ${result.index})`
  - Address chip: truncated `result.address`
  - Balance card: list each `b` where `parseFloat(b.amount) > 0` → network name + `${b.amount} ${b.symbol}`
  - "Import this account" button → calls `importRecoveredAccount(result.index)` then closes modal and refreshes account list
  - "Skip, find next account" button → calls `startRecovery(result.index + 1)`

## 7. Verification

- [x] 7.1 `npm run build` in `desktop/` passes (TypeScript + bundler)
- [ ] 7.2 Unlock wallet → open Add Account modal → "Or → Recover" link is visible and clickable
- [ ] 7.3 Scanning modal appears and advances through indices
- [ ] 7.4 Cancel button stops the scan
- [ ] 7.5 With a test wallet that has a funded sub-account at index 2: found-account modal appears correctly
- [ ] 7.6 "Import this account" registers the account and it appears in the account switcher
- [ ] 7.7 "Skip, find next account" resumes scanning from index 3
- [ ] 7.8 All indices with zero balance are skipped silently
- [ ] 7.9 Already-registered indices are skipped silently
- [ ] 7.10 When all 9 indices are exhausted: "No more sub-accounts found" message shown
