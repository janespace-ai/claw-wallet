## Why

The desktop wallet has no way to remove wallet data from a device — locking only pauses access, leaving all encrypted keys and history on disk. Users who want to wipe the device, transfer ownership, or simply unlink their wallet need a secure, deliberate deletion flow with danger prompts and password confirmation.

## What Changes

- **Settings → 账户 section**: Light-red warning card (⚠ icon, "危险操作" title, backup reminder) above a "注销账户" row.
- **Deregister confirmation modal**: Shows risk description, requires password entry, confirms with "永久注销" — rejects with wrong password error.
- **Main-process deletion**: Validates password, shuts down Relay, deletes all of `{userData}/wallet-data/` (keystore, DB, bio-credential, security events), reinitializes `KeyManager` to a no-wallet state.
- **Post-deregister navigation**: Renderer receives `wallet:deregistered` event and navigates to the welcome/setup screen.

## Capabilities

### New Capabilities
- `deregister-account`: Password-confirmed wipe of all wallet data on the current device, returning the app to the welcome screen.

### Modified Capabilities
- `electron-wallet-app`: Settings tab gains an "账户" danger section — no requirement-level behavior change to existing settings flows.

## Impact

**Design (Pencil):**
- `docs/design/desktop-redesign.pen`: Settings frame updated with 账户 section + warning card; new frame "19 Deregister Modal".

**Code:**
- `desktop/src/main/index.ts`: `wallet:deregister` IPC handler
- `desktop/src/preload/index.ts`: `deregisterWallet` + `onDeregistered` in `WalletAPI`
- `desktop/src/renderer/index.html`: Settings 账户 section + `#modal-deregister`
- `desktop/src/renderer/app.js`: Modal open/close, IPC call, error display, navigation
- `desktop/src/renderer/styles.css`: `.deregister-warning-card`, `.deregister-modal-title`, danger row styles
- `desktop/locales/*/settings.json`: `settings.deregister.*` keys (en + zh-CN)
