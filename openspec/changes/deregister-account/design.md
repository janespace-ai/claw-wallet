## Context

The Electron desktop wallet stores all sensitive data under `{userData}/wallet-data/`:
- `keystore.enc.json` — scrypt-encrypted mnemonic + derived private key
- `wallet.db` — SQLite database (signing history, contacts, account metadata)
- `bio-credential.enc` — OS-encrypted password for biometric unlock (optional)
- Security event files managed by `SecurityMonitor`

The main process exposes wallet operations via IPC through a `contextBridge` preload. The renderer is vanilla JS with no framework. Pencil design is the source of truth for UI — all screens are designed in Pencil before code is written.

**Design workflow followed:** Pencil frames designed and approved first (settings 账户 section, frame "19 Deregister Modal"), then code implemented.

## Goals / Non-Goals

**Goals:**
- Password-confirm before any deletion (wrong password → inline error, no deletion)
- Delete all files under `dataDir` to satisfy "delete all info" requirement
- Return renderer to welcome/setup screen after successful deregister
- Work correctly in the same session (no restart required for the welcome flow)
- Danger UI pattern: light-red warning card + red-labeled action row + red modal title

**Non-Goals:**
- Multi-profile / selective account deletion (future work)
- Remote wipe or cross-device deregister
- Syncing deregister with Relay server (device pairing records on server are not deleted)
- Guaranteeing new-wallet creation in the same session works perfectly (DB connection may be stale after deletion; users should restart before creating a new wallet)

## Decisions

### Decision 1: Password validation via `exportMnemonic`

**Choice:** Call `keyManager.exportMnemonic(password)` to validate — throws if wrong.

**Rationale:** This is the existing password-check primitive used by the export flow. Re-using it avoids duplicating decryption logic and keeps KeyManager as the single authority on password correctness.

**Alternatives considered:**
- Add a dedicated `verifyPassword()` method to KeyManager: cleaner interface but extra code for no additional benefit.
- Attempt `unlock()`: would also unlock the wallet as a side-effect, unnecessary here.

### Decision 2: Delete entire `dataDir` with `fs.rm({ recursive: true })`

**Choice:** `rm(dataDir, { recursive: true, force: true })` then `mkdir(dataDir, { recursive: true })`.

**Rationale:** User explicitly requires "删除所有的信息". Deleting by directory is simpler and more complete than enumerating individual files, especially as new files may be added in the future.

**Trade-off:** The `DatabaseService` singleton keeps its SQLite connection open after the file is deleted. On macOS/Linux the open file descriptor keeps the inode alive — reads/writes still work for the current process session but the file is gone from the filesystem. On Windows, `rm` would fail on the open DB file.

**Mitigation for Windows:** The current app targets macOS primarily. For a future Windows fix, call `DatabaseService.resetInstanceForTests()` before deletion and re-create the service — but this requires updating module-level `const` references in `main/index.ts`, which is a larger refactor deferred to a follow-up.

### Decision 3: Reinitialize `KeyManager` after deletion, no full process restart

**Choice:** Call `await keyManager.initialize()` after deleting `dataDir`. This sets `store = null` → `hasWallet() = false`. Then send `wallet:deregistered` to the renderer.

**Rationale:** Avoids `app.relaunch() + app.exit()` which would close the window and reopen it — jarring UX. The renderer simply transitions to the setup screen within the same window.

**Alternatives considered:**
- `app.relaunch() + setTimeout(app.exit, 200)`: Clean process state but visible app close/reopen. Rejected for UX reasons.
- Reload renderer only (`mainWindow.webContents.reload()`): Renderer reinits but main process services still hold stale references.

### Decision 4: Danger UI pattern

**Choice:** Light-red warning card (`#FEF2F2` bg, `#DC2626` text) above the settings row; modal title also in `#DC2626`; confirm button uses existing `.btn-danger` class.

**Rationale:** Matches the Pencil design (frame "19 Deregister Modal") approved before implementation. Reuses existing danger color tokens and button classes established in the security-modal refactor.

## Risks / Trade-offs

- **Stale DB connection after deletion (macOS)**: New wallet creation in the same session uses the orphaned in-memory DB. Data is lost on next restart but the session works. → Mitigation: document that users should restart after deregister before creating a new wallet.
- **Windows DB deletion failure**: `fs.rm` on an open SQLite file fails on Windows. → Mitigation: not a target platform currently; fix in follow-up.
- **Relay server retains pairing records**: After deregister, the server still has the device's pairing data. Agents attempting to reconnect will get errors until they re-pair. → Acceptable: the wallet-side key is gone; the server record is effectively orphaned and harmless.

## Open Questions

- Should we also call `relayBridge.revokeAllPairings()` before shutdown to clean up server-side records? Deferred — requires network access which may fail, and orphaned server records are harmless.
