# Tasks: Product Landing Page

> **Repo**: `janespace-ai/janespace-ai.github.io` (separate from claw-wallet repo)
> **Branch**: `feat/landing-page`

## 1. Repository & Branch Setup

- [ ] 1.1 Clone or open `janespace-ai/janespace-ai.github.io` locally
- [ ] 1.2 Create branch `feat/landing-page` from main
- [ ] 1.3 Create directory structure:
  ```
  web/en/
  web/zh/
  assets/screenshots/
  assets/  (for logo.svg)
  ```

## 2. Screenshot Assets

- [ ] 2.1 Export Pencil screenshots from `docs/design/desktop-redesign.pen` (in claw-wallet repo):
  - `nuKWU` → `assets/screenshots/welcome-dark.png`
  - `j2xlg` → `assets/screenshots/home-dark.png`
  - `MknpX` → `assets/screenshots/pair-code-dark.png`
  - `fD7L8` → `assets/screenshots/tx-approval-dark.png`
- [ ] 2.2 Optimize images (target < 200KB each, use `pngquant` or similar)

## 3. Root Redirect (`index.html`)

- [ ] 3.1 Create `index.html` at repo root with browser language detection:
  - Detects `navigator.language` — if starts with `zh` → redirect to `/web/zh/`
  - Otherwise → redirect to `/web/en/`
  - Fallback: English
  - No flash of content (redirect in `<head>`)

## 4. English Landing Page (`web/en/index.html`)

- [ ] 4.1 Navbar — logo + EN | 中文 switcher (links to `/web/zh/`)
- [ ] 4.2 Hero section
  - Title, subtitle, two CTA buttons
  - Download button: `href="#"` placeholder with `<!-- TODO: add GitHub Releases URL -->`
  - GitHub button: links to `https://github.com/janespace-ai/claw-wallet`
  - Right side: `home-dark.png` screenshot with shadow + slight tilt
- [ ] 4.3 "How It Works" — 4-step section
  - Step 1: Install desktop app — `welcome-dark.png` + download link placeholder
  - Step 2: Install Skill — code block `npx skills add janespace-ai/claw-wallet`
  - Step 3: Generate pairing code — `pair-code-dark.png`
  - Step 4: Start using — `tx-approval-dark.png`
- [ ] 4.4 Features grid — 6 cards (3×2 layout)
- [ ] 4.5 Security section — architecture diagram + copy
- [ ] 4.6 Footer — GitHub link, MIT license, language switcher

## 5. Chinese Landing Page (`web/zh/index.html`)

- [ ] 5.1 Duplicate structure from English, translate all copy to Chinese
  - Navbar: 中文 | English (links to `/web/en/`)
  - All section titles, descriptions, and CTA labels in Chinese
  - Same screenshots (no language-specific images needed)
- [ ] 5.2 Verify Chinese font rendering (system fonts cover CJK on all platforms)

## 6. Visual QA

- [ ] 6.1 Check on desktop (Chrome, Safari) — both languages
- [ ] 6.2 Check on mobile (375px viewport) — hero, steps, features
- [ ] 6.3 Verify all screenshot images load correctly
- [ ] 6.4 Verify language switcher works (EN ↔ ZH)
- [ ] 6.5 Verify root redirect works for both zh and non-zh browser languages
- [ ] 6.6 Check that download button placeholder is visible (not broken-looking)

## 7. README Update (claw-wallet repo)

- [ ] 7.1 Add a "For Users" section near the top of the main `README.md` linking to `https://janespace-ai.github.io`
- [ ] 7.2 Keep existing developer content below — do not replace it

## 8. Commit & Deploy

- [ ] 8.1 Commit all files: `feat: add bilingual product landing page`
- [ ] 8.2 Push `feat/landing-page` to remote
- [ ] 8.3 Open PR → merge to main → GitHub Actions deploys automatically
- [ ] 8.4 Visit `https://janespace-ai.github.io/` and verify live site

## 9. Post-launch (deferred)

- [ ] 9.1 Fill in desktop app download link once GitHub Releases are set up
- [ ] 9.2 Add real product screenshots once desktop app build is stable
- [ ] 9.3 Consider adding Open Graph meta tags for social sharing
