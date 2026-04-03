## Agent Status States

Three distinct states drive all UI changes:

```
State A — Unpaired (no devices ever paired)
  paired: false, online: false

State B — Paired but Agent offline
  paired: true, online: false

State C — Paired and Agent online
  paired: true, online: true
```

## Home Header Layout

Account group shifts left (padding-left: 72px, near macOS traffic lights).
Agent status button is right-aligned (margin-left: auto).

```
┌─────────────────────────────────────────┐
│      ⌄ Main Account  +      [agentBtn] →│
├─────────────────────────────────────────┤
│  (pairing code card — shown on demand)  │
├─────────────────────────────────────────┤
│  Total Portfolio Value                  │
│  $12,345.67                             │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Agent Button Variants

```
State A:  [ 🔗  连接 Agent ]   — accent border + accent text, outline pill
State B:  [ ●  Agent 离线  ]   — danger border + danger text, outline pill
State C:  [ ●  已连接      ]   — success dot + secondary text, no border
```

State C is still tappable (triggers re-pair confirmation).

## Pairing Code Card

Appears inline below the header (pushes content down) when user taps button in State A or B, or confirms re-pair in State C. Disappears when: countdown expires, agent successfully pairs, or user dismisses.

```
┌─────────────────────────────────────────┐
│  🔗  发送给你的 Agent                   │
│       ABC-DEF-12345                     │
│  剩余 4:32              [ 📋 复制 ]    │
└─────────────────────────────────────────┘
```

## Click Interaction Flow

```
State A tap → generatePairCode() → show card
State B tap → generatePairCode() → show card
State C tap → show confirm dialog
              "重新配对会断开当前 Agent 连接"
              [取消]  [确认配对]
              → confirm → generatePairCode() → show card
```

## Backend: Agent Online Detection

Current: `connected` = WebSocket to relay is OPEN (wallet↔server only).

New: Two separate signals:
- `connected` (existing) = wallet↔relay WebSocket open
- `agentOnline` (new) = a paired agent is actively present on the relay

### How agentOnline is set/cleared

**Set to true:** When `relay-account-channel` receives a `handshake` message from a known device (reconnect=true) or completes new pairing (`pair_complete`).

**Set to false:** When relay sends `{ type: "peer_disconnected" }` — the relay already implements this (confirmed in server-e2e-tests spec: "client B receives peer_disconnected when client A disconnects").

### IPC Event

New event `wallet:agent-status` emitted alongside existing `wallet:connection-status`:

```typescript
interface AgentStatusInfo {
  paired: boolean;      // has at least one device record
  online: boolean;      // agent sent handshake and peer_disconnected not received
}
```

`relay-bridge` aggregates per-account: `online = any channel has agentOnline`.

### Preload API

```typescript
onAgentStatus(cb: (status: AgentStatusInfo) => void): () => void
```

## Bottom Navigation

Replace Pairing tab (link icon) with Contacts tab (book-user icon).

```
[ 🏠 首页 ] [ 📈 活动 ] [ 👤 联系人 ] [ ⚙ 设置 ]
```

Existing `tab-pairing` div and its content are removed from `index.html`.
Existing Contacts sub-page (currently inside Settings) is promoted to a top-level tab.

## Contacts Tab

Reuses existing `#subpage-contacts` content and `loadDesktopContacts()` logic, lifted into a proper tab. No new backend needed — contacts data already available via `wapi().getContacts()`.

## CSS Token Mapping

Agent button uses existing CSS custom properties:
- `var(--accent)` — State A border/text/icon
- `var(--danger)` — State B border/dot/text
- `var(--success)` — State C dot
- `var(--text-secondary)` — State C text

Pairing code card uses `var(--surface2)` background with `var(--border)` bottom stroke.
