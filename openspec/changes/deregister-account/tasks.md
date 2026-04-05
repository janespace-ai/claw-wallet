## 1. Pencil Design

- [x] 1.1 Update Settings frame in `docs/design/desktop-redesign.pen` — add "账户" section header, light-red warning card (⚠ triangle-alert icon, "危险操作" title, body text), and "注销账户" row in #DC2626
- [x] 1.2 Create frame "19 Deregister Modal" — semi-transparent overlay, modal box with red "注销账户？" title, body text, password input field, "永久注销" (red filled) / "取消" (outlined) buttons side by side
- [x] 1.3 Get design screenshot and confirm with user before writing any code

## 2. Locale Keys

- [x] 2.1 Add `settings.deregister.*` keys to `desktop/locales/en/settings.json` (sectionHeader, warningTitle, warningBody, button, modalTitle, modalBody, passwordPlaceholder, confirmButton, cancelButton, wrongPassword)
- [x] 2.2 Add matching keys to `desktop/locales/zh-CN/settings.json`

## 3. Main Process — IPC Handler

- [x] 3.1 Add `rm` and `mkdir` to `node:fs/promises` import in `desktop/src/main/index.ts`
- [x] 3.2 Implement `wallet:deregister` IPC handler: validate password via `keyManager.exportMnemonic(password)`, shut down relay, lock, delete `dataDir`, recreate empty `dataDir`, call `keyManager.initialize()`, send `wallet:deregistered` to renderer

## 4. Preload Bridge

- [x] 4.1 Add `deregisterWallet(password: string): Promise<void>` to `WalletAPI` interface in `desktop/src/preload/index.ts`
- [x] 4.2 Add `onDeregistered(callback: () => void): () => void` to `WalletAPI` interface
- [x] 4.3 Implement both methods in the `api` object (invoke + listener pattern)

## 5. Renderer — HTML

- [x] 5.1 Add "账户" `settings-section-header` after the lock wallet div in Settings tab
- [x] 5.2 Add `.deregister-warning-card` with triangle-alert SVG icon, "危险操作" title, and body text
- [x] 5.3 Add `settings-group` with `#btn-deregister-row` using `.deregister-row-label` and `.deregister-row-chevron`
- [x] 5.4 Add `#modal-deregister` with red title, body, `#input-deregister-password`, `#deregister-error`, "永久注销" (`#btn-deregister-confirm`) and "取消" (`#btn-deregister-cancel`) buttons

## 6. Renderer — CSS

- [x] 6.1 Add `.deregister-warning-card` styles (light red bg `#FEF2F2`, border `#FECACA`, text `#DC2626`, flex layout)
- [x] 6.2 Add dark mode overrides for warning card
- [x] 6.3 Add `.deregister-row-label` and `.deregister-row-chevron` danger color styles (with dark mode variants)
- [x] 6.4 Add `.deregister-modal-title` red color style (with dark mode variant)
- [x] 6.5 Add `.deregister-modal-body` secondary text style

## 7. Renderer — JavaScript

- [x] 7.1 Wire `#btn-deregister-row` click: clear password field and error, open `#modal-deregister`, focus input
- [x] 7.2 Wire `#btn-deregister-cancel` click: close modal
- [x] 7.3 Wire `#btn-deregister-confirm` click: guard empty password, disable button, call `wapi().deregisterWallet(password)`, on success close modal and call `showScreen("setup")`, on error show inline message (wrong password vs generic), re-enable button
- [x] 7.4 Subscribe to `wapi().onDeregistered()` as a fallback: close modal and navigate to setup screen
