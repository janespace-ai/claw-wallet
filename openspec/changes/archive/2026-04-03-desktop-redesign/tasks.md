## 0. Branch Setup

- [x] 0.1 Create branch `feature/desktop-redesign` from `main`
- [x] 0.2 Confirm `desktop/assets/icon.png` and `src/renderer/favicon.png` are already committed

---

## 1. CSS Token System

- [x] 1.1 Replace all contents of `styles.css` — remove existing dark-only rules
- [x] 1.2 Define `:root` with full light-theme token set (`--bg`, `--surface`, `--surface2`, `--accent`, `--accent-light`, `--text-primary`, `--text-secondary`, `--text-on-accent`, `--border`, `--success`, `--danger`, `--warning`)
- [x] 1.3 Define `[data-theme="dark"]` override block with dark token values (see design.md Token System table)
- [x] 1.4 Add base reset (`* { box-sizing: border-box; margin: 0; padding: 0 }`) and `body` base styles using tokens
- [x] 1.5 Add typography scale: heading sizes, body, caption — all using `Inter` font family and token colors

---

## 2. Bottom Tab Bar

- [x] 2.1 Add `.tab-bar-bottom` HTML inside `#screen-main` (fixed bottom, full width)
- [x] 2.2 Structure: outer container → pill wrapper (62px, radius 36) → 4 tab items
- [x] 2.3 Each tab item: vertical stack, icon (`icon_font` lucide, 18px) + label (10px, uppercase, weight 600)
- [x] 2.4 CSS: active tab = `--accent` fill + `--text-on-accent`; inactive = transparent + `--text-secondary`
- [x] 2.5 Update `app.js` `switchTab()` to reference new tab IDs: `home`, `activity`, `pairing`, `settings`
- [x] 2.6 Remove old `<nav class="tab-bar">` from `index.html`

---

## 3. Global Header Component

- [x] 3.1 Define `.app-header` CSS: 48px height, `--surface` bg, horizontal padding 20px, bottom border `--border`
- [x] 3.2 Define `.logo-box` CSS: 26×26, `--accent` fill, radius 7, centered flex
- [x] 3.3 Define `.connection-dot` CSS: 8px circle, `--success`/`--danger` fill + label text
- [x] 3.4 Apply header styles to setup/unlock screens (logo box + app name + connection dot)
- [x] 3.5 Define `.account-header` variant for Home screen (avatar pill + account name + edit icon)

---

## 4. Screen: Welcome (01)

- [x] 4.1 Rewrite `#screen-setup` HTML: header + hero section + button group
- [x] 4.2 Hero: logo box (80×80, radius 24) with single paw image, "Welcome to Claw Wallet" h2, subtitle p
- [x] 4.3 CSS: `.btn-primary` — `--accent` fill, white text, 52px height, full width, radius pill
- [x] 4.4 CSS: `.btn-outline` — transparent fill, `--border` stroke, `--text-primary` text, same size
- [x] 4.5 Logo box in hero: use `image_paw_single_white.png` centered via CSS background-image

---

## 5. Screen: Unlock (02)

- [x] 5.1 Rewrite `#screen-unlock` HTML: header + body (avatar + name + address + input + buttons)
- [x] 5.2 Avatar: 64×64 circle, `--accent-light` bg, initials or lock icon centered
- [x] 5.3 CSS: `.input-field` — `--surface` bg, `--border` stroke, radius 12, 52px height, full width
- [x] 5.4 "Use Touch ID" ghost button: no border, `--accent` text

---

## 6. Screen: Home — Portfolio & Balances (03)

- [x] 6.1 Rewrite `#tab-home` HTML: portfolio section + network chips + balance list + hide-zero toggle
- [x] 6.2 Portfolio section: "Total Portfolio Value" label + large USD value (`--text-primary`, 32px bold) + daily change row
- [x] 6.3 Daily change: up arrow + amount in `--success`; down arrow in `--danger`
- [x] 6.4 Network chips: `.chip` pill buttons, active = `--accent` fill, inactive = `--surface2` + `--text-secondary`
- [x] 6.5 CSS: `.balance-row` — horizontal flex, 60px height, token icon (40×40 circle) + name/network + amount/USD
- [x] 6.6 "Hide zero balances" toggle row: label left + `<input type="checkbox" role="switch">` right, styled as iOS toggle
- [x] 6.7 Refresh link: `--accent` color, right-aligned in BALANCES section header

---

## 7. Screen: Activity (04)

- [x] 7.1 Rewrite `#tab-activity` HTML: header with network dropdown + filter chips + date-grouped list
- [x] 7.2 CSS: `.filter-chips` — horizontal scroll row of pill chips, same style as network chips
- [x] 7.3 CSS: `.date-group-header` — `--text-secondary`, 12px, padding 8px 0
- [x] 7.4 CSS: `.activity-row` — 64px height, type icon (32×32 circle) + text stack + amount stack (right-aligned)
- [x] 7.5 Amount color: `--danger` for rejected/failed, `--success` for receives, `--text-primary` for sends
- [x] 7.6 Type icon backgrounds: Auto = `--accent-light`, Manual = `--surface2`, Rejected = danger-light (`#FEF2F2` / `#2A0D0D`)
- [x] 7.7 Update `app.js` activity rendering to use new row structure and color logic

---

## 8. Screen: Pairing (05)

- [x] 8.1 Rewrite `#tab-pairing` HTML: header + hero + code card + button + agents section
- [x] 8.2 Hero icon: 48×48, `--accent-light` bg, radius 14, link icon centered
- [x] 8.3 Code card: `--surface` card, radius 16, border `--border`, monospace font, large letter-spacing
- [x] 8.4 Countdown label: `--text-secondary`, 13px, below code
- [x] 8.5 CSS: `.agent-row` — 56px, avatar icon + name + IP/date + chevron
- [x] 8.6 "CONNECTED AGENTS" section header: uppercase, `--text-secondary`, 11px

---

## 9. Screen: Settings (06)

- [x] 9.1 Rewrite `#tab-settings` HTML with grouped sections: ACCOUNTS, SPENDING LIMITS, SECURITY, WALLET, APPEARANCE
- [x] 9.2 CSS: `.settings-section-header` — 11px, uppercase, `--text-secondary`, padding 16px 20px 8px
- [x] 9.3 CSS: `.settings-row` — 52px height, label + value/chevron, bottom border `--border`
- [x] 9.4 CSS: `.settings-toggle` — iOS-style toggle switch using checkbox hack
- [x] 9.5 Add APPEARANCE section with Theme row: "Light" / "Dark" toggle (calls `setTheme()`)
- [x] 9.6 Move language `<select>` from header into WALLET section as a styled settings row
- [x] 9.7 Add "Security Events" row (with red badge count) and "Signing History" row — both open sub-pages
- [x] 9.8 Add "Contacts & Address Book" row → opens contacts sub-page

---

## 10. Settings Sub-pages

- [x] 10.1 Add `#subpage-security-events` screen div (hidden by default): header with back button + events list
- [x] 10.2 Add `#subpage-signing-history` screen div: header with back button + signing records list
- [x] 10.3 Add `#subpage-contacts` screen div: header with back button + contacts list
- [x] 10.4 CSS: `.subpage-header` — back chevron + title, same 48px header style
- [x] 10.5 `app.js`: `openSubpage(id)` and `closeSubpage()` functions — show/hide with z-index overlay within `#screen-main`
- [x] 10.6 Move existing security events rendering logic into `#subpage-security-events`
- [x] 10.7 Move existing signing history rendering logic into `#subpage-signing-history`
- [x] 10.8 Move existing contacts rendering logic into `#subpage-contacts`

---

## 11. Screen: Tx Approval (07)

- [x] 11.1 Rewrite `#modal-tx` as a bottom-sheet: `position: fixed`, bottom 0, full width, radius 24px top corners
- [x] 11.2 Add semi-transparent overlay backdrop behind sheet (`#00000066`)
- [x] 11.3 "Request from Agent-X" chip: `--accent-light` bg, `--accent` text, radius pill, 13px
- [x] 11.4 Amount display: large token value + USD equivalent line
- [x] 11.5 Detail rows: To / Network / Est. Gas — label `--text-secondary` left, value `--text-primary` right
- [x] 11.6 "Approve" button: full-width primary; "Reject": full-width, `--danger` outline or ghost

---

## 12. Theme System — `app.js`

- [x] 12.1 Add `initTheme()`: read `localStorage.getItem('claw-theme')`, apply `data-theme` on `<html>` on load
- [x] 12.2 Add `setTheme(theme)`: set `data-theme`, persist to `localStorage`
- [x] 12.3 Wire Settings APPEARANCE toggle to `setTheme()`
- [x] 12.4 Ensure theme survives page reload (initTheme called before first render)

---

## 13. Cleanup & Polish

- [x] 13.1 Remove all old CSS classes no longer referenced in HTML
- [x] 13.2 Remove Security and Contacts top-level `data-tab` entries from `switchTab()` logic
- [x] 13.3 Remove old `#tab-security` and `#tab-contacts` HTML blocks (content moved to sub-pages)
- [x] 13.4 Verify all `data-i18n` keys still resolve correctly after HTML restructure
- [x] 13.5 Test both themes visually across all 7 screens
- [x] 13.6 Update Playwright E2E baseline snapshots: `npx playwright test --update-snapshots`
- [x] 13.7 Run full E2E suite and fix any selector breakages caused by HTML restructure
