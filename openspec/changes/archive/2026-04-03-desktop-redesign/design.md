## Context

The Pencil design file (`docs/design/desktop-redesign.pen`) is the authoritative source of truth. It contains 14 screens: 7 light-theme and 7 dark-theme, all finalized. Implementation should match these screens pixel-faithfully.

**Current renderer stack:**
- `index.html` — vanilla HTML, screens toggled via `display: none/block`
- `styles.css` — monolithic, dark-only, no token system
- `app.js` — ~1560 lines, handles all UI logic, no framework

**Constraints:**
- CSP blocks external resources; all assets must be local
- No build tooling — plain CSS and JS only
- App window is fixed at 480×720px; no responsive breakpoints needed

---

## Token System

Two theme layers defined on `:root` (light default) and `[data-theme="dark"]`:

### Light Theme
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#F2F3F7` | Page background |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--surface2` | `#F7F8FA` | Row alternates, subtle fills |
| `--accent` | `#5B6EF5` | Buttons, active states, brand |
| `--accent-light` | `#EEF0FE` | Chip backgrounds, tinted fills |
| `--text-primary` | `#1A1A2E` | Headings, body |
| `--text-secondary` | `#6B7280` | Labels, captions |
| `--text-on-accent` | `#FFFFFF` | Text on accent fills |
| `--border` | `#E5E7EB` | Dividers, input borders |
| `--success` | `#10B981` | Connected, positive values |
| `--danger` | `#EF4444` | Rejected, errors |
| `--warning` | `#F59E0B` | Alerts |

### Dark Theme (`[data-theme="dark"]`)
| Token | Value |
|-------|-------|
| `--bg` | `#0F0F1A` |
| `--surface` | `#1A1A2E` |
| `--surface2` | `#1E1E30` |
| `--accent` | `#8B96F8` |
| `--accent-light` | `#2D2D62` |
| `--text-primary` | `#EEEEFF` |
| `--text-secondary` | `#8888AA` |
| `--text-on-accent` | `#FFFFFF` |
| `--border` | `#2A2A3E` |
| `--success`, `--danger`, `--warning` | unchanged |

Theme is applied by setting `data-theme="dark"` on `<html>`. Preference persisted in `localStorage` under key `claw-theme`.

---

## Navigation Architecture

### Current (removed)
```
<nav class="tab-bar">   ← top, always visible
  Home | Pairing | Settings | Security | Activity | Contacts
```

### New
```
Screen stack (full height, mutually exclusive):
  #screen-setup      ← wallet creation flow (no tab bar)
  #screen-password   ← password/mnemonic flow (no tab bar)
  #screen-mnemonic   ← backup (no tab bar)
  #screen-unlock     ← unlock (no tab bar)
  #screen-main       ← main app (shows bottom tab bar)

Bottom tab bar (inside #screen-main, fixed bottom):
  HOME | ACTIVITY | PAIRING | SETTINGS
  — pill container, 62px tall, 36px radius
  — active tab: solid --accent fill, white icon+label
  — inactive: transparent, --text-secondary
```

Tabs removed: **Security** (→ Settings sub-page), **Contacts** (→ Settings sub-page).

---

## Screen Designs

### 01 Welcome
- Full-screen `--bg` background
- Header: 48px, logo box (26×26, `--accent`, radius 7) + "Claw Wallet" + connection dot
- Hero: logo box (80×80, `--accent`, radius 24) centered + title + subtitle
- Buttons: "Create New Wallet" (primary, full-width) + "Import Existing Wallet" (outline, full-width)

### 02 Unlock
- Header: same as Welcome
- Body: avatar circle (64×64) + account name + address + password input + "Unlock" button + "Use Touch ID" ghost button

### 03 Home (default tab)
- Header: account picker (avatar + name + edit icon) + connection dot
- Portfolio section: "Total Portfolio Value" label + large USD value + daily change (↑ green / ↓ red)
- Network chips: All / Ethereum / Base / Arbitrum — pill style, `--accent` active
- Balance list: rows with token icon (40×40 circle) + name/network + amount/USD value
- "Hide zero balances" toggle row
- Bottom: tab bar

### 04 Activity
- Header: "Activity" title + "All Networks" dropdown (right)
- Filter chips: All / Auto / Manual / Rejected
- List: date-group headers ("Today · Apr 2, 2026") + transaction rows
- Row: type icon (32×32) + "Type · Token" + "Network · HH:MM" + amount + USD — amount color: red for sends, green for receives, `--danger` for rejected
- Bottom: tab bar

### 05 Pairing
- Header: "Pairing" title + connection dot
- Hero icon (48×48 accent-light bg) + "Pair with Agent" heading + description
- Code card: `--surface` card, monospace large font (ABC1 2345 format), expiry countdown
- "Generate New Code" primary button
- "CONNECTED AGENTS" section header + agent rows (icon + name + IP + time + chevron)
- Bottom: tab bar

### 06 Settings
- Header: "Settings" title (no tab bar header needed — tab bar at bottom)
- Grouped sections with section headers (`--text-secondary`, uppercase, small):
  - **ACCOUNTS**: account rows (avatar + name + address + chevron) + "Add Account" row
  - **SPENDING LIMITS**: "Daily Limit" + "Per-Transaction Limit" rows (value + chevron)
  - **SECURITY**: "Lock Mode" + "Touch ID / Biometrics" (toggle) + "Security Events" (badge + chevron) + "Signing History" (chevron)
  - **WALLET**: "Contacts & Address Book" + "Language" (current lang + chevron)
  - **APPEARANCE**: "Theme" row (Light / Dark toggle or picker)
- Bottom: tab bar

#### Settings Sub-pages (new)
- **Security Events**: full-screen list of security events, back button in header
- **Signing History**: full-screen list of signing records with type badges, back button

### 07 Tx Approval
- Overlay: semi-transparent `#00000066` full-screen
- Bottom sheet: `--surface`, radius 24 top corners, slides up from bottom
- "Request from Agent-X" chip (accent-light bg, accent text)
- Title "Transaction Request" + close ×
- Amount: large ETH value + USD equivalent
- Detail rows: To / Network / Est. Gas
- "Approve" primary button + "Reject" danger-outline button

---

## Decisions

### Decision 1: Theme switching mechanism
**Choice:** `data-theme` attribute on `<html>` + CSS custom properties

**Rationale:** No JS-in-CSS, no class toggling complexity. Instant switch, no flash. Works with plain CSS without build tools.

### Decision 2: Bottom tab bar placement
**Choice:** Fixed inside `#screen-main`, not `body`

**Rationale:** Only visible during main app state. Setup/unlock screens must not show tab bar.

### Decision 3: Security and Contacts navigation
**Choice:** Sub-pages within Settings tab using a simple show/hide stack

**Rationale:** Avoids adding new top-level screens to the screen stack. Keeps navigation shallow. Back button in sub-page header returns to Settings list.

### Decision 4: Language selector placement
**Choice:** Row in Settings → WALLET section

**Rationale:** Matches design spec. Removes clutter from header. Language changes are infrequent.

### Decision 5: app.js refactor scope
**Choice:** Minimal — update tab switching, theme logic, sub-page navigation. Preserve all IPC + data logic.

**Rationale:** The goal is a visual redesign, not an architectural refactor. All wallet, signing, pairing, balance logic stays as-is.

---

## Risks

### Risk: Existing E2E snapshots will break
Playwright baseline screenshots in `e2e/` will differ from the new UI.

**Mitigation:** Update baseline snapshots after implementation (`npx playwright test --update-snapshots`). Flag in tasks.

### Risk: app.js navigation assumptions
Current `app.js` assumes 6 tabs by name. Renaming/removing tabs may break `switchTab()` logic.

**Mitigation:** Search and update all `data-tab` references. Covered explicitly in tasks.

### Risk: CSP and inline styles
Some dynamic styling in `app.js` uses inline `element.style`. CSP allows inline styles (`unsafe-inline` in style-src).

**Mitigation:** No change needed — keep dynamic styles as inline where already used.
