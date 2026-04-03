## Why

The current pairing tab is a separate, isolated screen that users must navigate to manually. New users don't know they need to pair with an Agent, and returning users have no persistent awareness of whether their Agent is connected. The connection status indicator also conflates two different states — wallet-to-server connectivity and agent-to-wallet pairing — causing confusion (green dot when server is reachable but no Agent is active).

## What Changes

- **Remove Pairing tab** from bottom nav; replace with **Contacts tab** (contacts currently hidden in Settings sub-page)
- **Agent status button** in home header (top-right): a state-aware pill showing pairing/connection state
- **Inline pairing code card** below the home header: appears on demand when user taps the agent button, no separate screen needed
- **True agent-online detection**: distinguish wallet↔server connected from agent actively online via `peer_disconnected` relay message

## Capabilities

### Modified Capabilities
- `electron-wallet-app`: Home tab gains agent status button + inline pairing code panel; Pairing tab removed; Contacts tab added
- `relay-bridge`: Emit distinct `wallet:agent-status` IPC event tracking `{ paired, online }` separately from generic connection status

### New Capabilities
- `agent-status-tracking`: Per-account state tracking of whether a paired agent is actively online

## Impact

**Code Changes:**
- `desktop/src/main/relay-account-channel.ts`: Handle `peer_disconnected` relay message; emit `agentOnline` flag in connection status
- `desktop/src/main/relay-bridge.ts`: Aggregate per-account agent status; emit `wallet:agent-status` IPC event
- `desktop/src/main/index.ts`: Wire up `wallet:agent-status` IPC send
- `desktop/src/preload/index.ts`: Expose `onAgentStatus()` subscription; update `WalletAPI` interface
- `desktop/src/renderer/index.html`: Replace Pairing tab with Contacts tab in nav; add agent status button + pairing code card to home header; add Contacts sub-page content
- `desktop/src/renderer/app.js`: Handle agent status events; pairing code generation on header button click; contacts tab logic
- `desktop/src/renderer/styles.css`: Agent button styles (3 states); pairing code card styles
- `desktop/locales/*/`: i18n keys for new UI strings

**Non-goals:**
- Contacts CRUD (add/edit/delete contacts) — contacts page is read-only display in this change
- Multi-agent support — wallet still pairs with one agent at a time
