# Proposal: Product Landing Page (janespace-ai.github.io)

## What

Build a bilingual (English + Chinese) product landing page hosted on GitHub Pages at `janespace-ai.github.io`. The site lives in the `web/` directory of the `janespace-ai.github.io` repo (separate from this codebase), structured as:

```
web/
  en/
    index.html     ← English landing page
  zh/
    index.html     ← Chinese landing page
  index.html       ← Root redirect (auto-detects browser language)
  assets/
    screenshots/   ← Pencil design exports (PNG)
    logo.svg
```

## Why

- The existing README is developer-facing. Regular users (Web3 + AI Agent users) have no friendly entry point.
- GitHub Pages at `janespace-ai.github.io` is free, fast to deploy, and requires no infrastructure.
- Bilingual (EN + ZH) covers the core audience.

## Target Audience

Non-developer users who:
- Use AI agents (Claude Code, OpenClaw, Cursor, Cline)
- Have some Web3 familiarity (understand wallets, tokens, DeFi basics)
- Want to use natural language to manage crypto / interact with DeFi protocols

## Scope

**In scope:**
- Single-page static HTML for each language (no framework, Tailwind via CDN)
- Dark theme matching desktop app aesthetic
- Four-step onboarding flow section (with screenshots from Pencil designs)
- Features section
- Security architecture section
- Desktop app download CTA (link placeholder — to be filled when Releases exist)
- GitHub Actions deployment workflow (Static HTML)

**Out of scope:**
- Blog / article system
- Docs / API reference
- Analytics
- Contact forms
- Custom domain (deferred to later)

## Success Criteria

- Site live at `https://janespace-ai.github.io/`
- English and Chinese versions accessible at `/en/` and `/zh/`
- Four-step user flow clearly communicated with screenshots
- Passes Core Web Vitals (no heavy JS, fast load)
- Desktop download link placeholder clearly marked for future fill-in
