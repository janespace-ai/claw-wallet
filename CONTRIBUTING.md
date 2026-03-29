# Contributing to claw-wallet

## Desktop wallet i18n

Translation source files live under [`desktop/locales/`](desktop/locales/) (`en/`, `zh-CN/`, plus any new language directories). Each namespace is one JSON file (for example `common.json`, `modals.json`).

- **Adding a string**: Prefer an existing namespace; use hierarchical keys such as `settings.lockMode.title`.
- **Adding a language**: Copy `desktop/locales/en/*.json` to `desktop/locales/<lang>/`, translate values, register the language in [`desktop/src/renderer/index.html`](desktop/src/renderer/index.html) (`#language-selector`), and load namespaces in [`desktop/src/renderer/i18n.js`](desktop/src/renderer/i18n.js) if you add new files.
- **Interpolation**: Keys use `{name}`-style placeholders (see `i18next` config in `i18n.js`).
- **Build**: `npm run build` copies `desktop/locales/` into `desktop/dist/renderer/locales/` so dynamic `import()` works in development and inside the packaged app (asar).

### Automated check

From `desktop/`:

```bash
npm test
```

Validates that all expected namespace files exist, parse as JSON, and that `en` and `zh-CN` share the same leaf keys (helps catch missing translations).

### Manual smoke checklist (i18n)

1. Run `cd desktop && npm run dev`.
2. Switch **English / 简体中文** from the header; confirm tabs, settings, pairing, activity, contacts, and modals update without restart.
3. Optional: clear `localStorage` key `claw-wallet-language`, relaunch, and confirm fallback follows the system locale (`zh*` → zh-CN).

For broader verification of the Agent + Relay + Desktop stack, see [`docs/AGENT_VERIFICATION.md`](docs/AGENT_VERIFICATION.md).
