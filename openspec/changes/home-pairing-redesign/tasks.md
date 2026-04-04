## 1. Backend: Agent Online Detection

- [x] 1.1 In `relay-account-channel.ts`, add `private agentOnline = false` instance field
- [x] 1.2 Set `agentOnline = true` in `handleHandshake()` when reconnect=true and device is found
- [x] 1.3 Set `agentOnline = true` in `completePairing()` after new pairing succeeds
- [x] 1.4 Handle `peer_disconnected` message type in `handleMessage()`: set `agentOnline = false` and call `emitConnectionStatus(this.isConnected())`
- [x] 1.5 Add `agentOnline()` getter: `return this.agentOnline`
- [x] 1.6 Include `agentOnline` flag in `emitConnectionStatus()` payload
- [x] 1.7 In `relay-bridge.ts`: add `AgentStatusInfo` interface `{ paired: boolean, online: boolean }`
- [x] 1.8 In `relay-bridge.ts`: add `emitAgentStatus()` method — aggregates `paired = any channel has devices.length > 0`, `online = any channel has agentOnline`
- [x] 1.9 Call `emitAgentStatus()` from `emitAggregatedConnectionStatus()`
- [x] 1.10 Add `onAgentStatus?: (status: AgentStatusInfo) => void` to `RelayBridgeOptions`

## 2. IPC & Preload

- [x] 2.1 In `main/index.ts`: add `onAgentStatus` handler in RelayBridge options → `sendToRenderer("wallet:agent-status", status)`
- [x] 2.2 In `preload/index.ts`: add `AgentStatusInfo` interface
- [x] 2.3 In `preload/index.ts`: add `onAgentStatus(cb)` to WalletAPI interface and implementation (wraps `ipcRenderer.on("wallet:agent-status", ...)`, returns unsubscribe fn)

## 3. CSS — Agent Button & Code Card

- [x] 3.1 In `styles.css`: add `.agent-status-btn` base styles (outline pill, flex, gap, padding, border-radius, font-size, cursor, `-webkit-app-region: no-drag`)
- [x] 3.2 Add `.agent-status-btn.unpaired` — `border: 1.5px solid var(--accent); color: var(--accent)`
- [x] 3.3 Add `.agent-status-btn.offline` — `border: 1px solid var(--danger); color: var(--danger)`
- [x] 3.4 Add `.agent-status-btn.online` — no border, `color: var(--text-secondary)`, dot via `::before` with `var(--success)`
- [x] 3.5 Add `.pair-code-card` styles — `background: var(--surface2); border-bottom: 1px solid var(--border); padding: 10px 16px; display: flex; flex-direction: column; gap: 4px`
- [x] 3.6 Add `.pair-code-value` — large monospace code display (font-size 20px, font-weight 700, letter-spacing 3px)
- [x] 3.7 Add `.pair-code-footer` — flex row, space-between, for countdown + copy button
- [x] 3.8 Update `.home-account-group` — change from `position: absolute; left: 50%; transform: translateX(-50%)` to `padding-left: 72px` with `justify-content: flex-start`

## 4. HTML — Home Header & Code Card

- [x] 4.1 In `index.html`: update `.home-account-group` — add `padding-left` approach (remove absolute centering)
- [x] 4.2 Replace `#connection-indicator-home` with `<button id="btn-agent-status" class="agent-status-btn unpaired">` containing icon + text span
- [x] 4.3 After the home header, add `<div id="pair-code-card" class="pair-code-card" style="display:none">` with title row, code value, footer (countdown + copy button)

## 5. HTML — Replace Pairing Tab with Contacts Tab

- [x] 5.1 Remove entire `<div id="tab-pairing" class="tab-content">` block
- [x] 5.2 Add `<div id="tab-contacts" class="tab-content">` with header and scrollable contacts list `<div id="contacts-list-main"></div>`
- [x] 5.3 In the bottom tab bar: replace Pairing tab button (link icon) with Contacts tab button (book icon, `data-tab="contacts"`)
- [x] 5.4 Remove Contacts sub-page from inside Settings tab (`#subpage-contacts`, `#btn-open-contacts`, `#btn-close-contacts`)
- [x] 5.5 Remove `#btn-open-contacts` row from Settings WALLET section

## 6. app.js — Agent Status Logic

- [x] 6.1 Add `let agentStatus = { paired: false, online: false }` module-level state
- [x] 6.2 Subscribe to `wapi().onAgentStatus()` in init: update `agentStatus`; call `renderAgentStatusBtn()`
- [x] 6.3 Write `renderAgentStatusBtn()`: sets class (`unpaired`/`offline`/`online`) and inner text/icon on `#btn-agent-status` based on `agentStatus`
- [x] 6.4 Add click handler for `#btn-agent-status`: State A/B immediate, State C confirmation dialog
- [x] 6.5 Write `generateAndShowPairCode()`: calls `wapi().generatePairCode()`, populates `#pair-code-card`, shows card
- [x] 6.6 Write `hidePairCodeCard()`: clears countdown timer, hides `#pair-code-card`
- [x] 6.7 Hide pair code card when agent comes online (`onAgentStatus` with `online: true`)
- [x] 6.8 Add copy button handler: `navigator.clipboard.writeText(code + agentPrompt)` + feedback
- [x] 6.9 Update `startCountdown()` for new card element IDs; call `hidePairCodeCard()` on expiry

## 7. app.js — Contacts Tab

- [x] 7.1 Add `contacts` to the tab switch handler (load contacts when tab becomes active)
- [x] 7.2 Write `loadContactsTab()`: calls `wapi().listDesktopContacts()`, renders into `#contacts-list-main`
- [x] 7.3 Remove old `subpageBtn` wiring for contacts (no longer a sub-page)
- [x] 7.4 Remove `btn-new-sub-account` references that delegated to old pairing tab flows

## 8. app.js — Remove Old Pairing Tab Logic

- [x] 8.1 Remove tab switch handler branch for `tab === "pairing"`
- [x] 8.2 Remove `loadPairedDevices()` calls tied to pairing tab and account switch
- [x] 8.3 Remove `refreshPairingCodeFromMain()` calls from tab switch and init
- [x] 8.4 Remove `btn-generate-code` click handler (replaced by agent button handler)

## 9. i18n

- [x] 9.1 Add keys to `en/` locales: `home.agent.unpaired`, `home.agent.offline`, `home.agent.online`, `home.agent.pairCode.title`, `home.agent.pairCode.copy`, `home.agent.repairConfirm`
- [x] 9.2 Add corresponding keys to `zh-CN/` locales with Chinese translations
- [x] 9.3 `common.tabs.contacts` already existed in both locales — no change needed

## 10. Cleanup & Polish

- [x] 10.1 Remove `#connection-indicator-home` CSS rules that are now replaced
- [x] 10.2 Verify old pairing tab CSS (`.pairing-hero`, `.code-card`, `.code-display`, `.code-countdown`) can be removed
- [ ] 10.3 Test all three agent status states visually (unpaired / offline / online)
- [ ] 10.4 Test pairing code card: generates immediately, countdown works, copy works, hides on agent connect
- [ ] 10.5 Test re-pair confirmation dialog flow (State C)
- [ ] 10.6 Test Contacts tab loads and displays correctly
- [ ] 10.7 Verify dark mode renders correctly for all new components
