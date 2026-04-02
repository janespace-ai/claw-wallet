## Why

The current desktop UI was built for functional completeness, not visual quality. It uses a dark theme with flat tab navigation, generic typography, and no design system — resulting in an app that feels like an internal tool rather than a polished product. Meanwhile, `docs/design/desktop-redesign.pen` now contains a complete, validated design for both light and dark themes across all 7 screens. This change implements that design faithfully.

## What Changes

- **Full visual redesign**: Light theme as default, dark theme as alternative, both driven by a CSS token system
- **Navigation overhaul**: Top tab bar removed, replaced with a bottom pill-style tab bar (HOME / ACTIVITY / PAIRING / SETTINGS)
- **Screen layout rewrites**: All 7 screens rebuilt to match the Pencil design — new typography, spacing, components, and interaction patterns
- **Theme switching**: Light/dark toggle moved to Settings; preference persisted in localStorage
- **Consolidated navigation**: Security Events and Contacts promoted as sub-pages under Settings (no longer top-level tabs)
- **Language selector**: Moved from header into Settings

## Capabilities

### Modified Capabilities
- `electron-wallet-app`: Complete renderer overhaul (`index.html`, `styles.css`, `app.js`)

### No New Backend Capabilities
All IPC, main-process services, and preload APIs remain unchanged. This is a pure frontend change.

## Impact

**Files changed:**
- `desktop/src/renderer/index.html` — structural rewrite (screens + bottom tab bar)
- `desktop/src/renderer/styles.css` — complete rewrite (token system + both themes + all components)
- `desktop/src/renderer/app.js` — navigation logic, theme switching, screen transition updates
- `desktop/assets/icon.png` — already updated (paw icon)
- `desktop/src/renderer/favicon.png` — already updated

**Branch:** `feature/desktop-redesign`

## Non-Goals

- No changes to main process, IPC, or preload layer
- No new data sources or services
- No animation or transition system (static states only)
- No responsive/desktop-wide layout (app remains fixed 480px width)
