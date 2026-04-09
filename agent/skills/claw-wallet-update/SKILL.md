---
name: claw-wallet-update
description: Check for updates to Claw Wallet tools and install the latest version. Use when the user asks to update, upgrade, or refresh their Claw Wallet tools.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
    emoji: "🔄"
    homepage: https://github.com/janespace-ai/claw-wallet
---

# Claw Wallet — Update Tools

Use this skill when the user asks to update, upgrade, or refresh their Claw Wallet tools.

## Trigger Phrases

Activate this skill when the user says things like:
- "更新钱包工具" / "Update my wallet tools"
- "检查钱包更新" / "Check for wallet updates"
- "升级 claw-wallet" / "Upgrade claw-wallet"
- "wallet tools 有新版本吗" / "Is there a new version?"

## Update Workflow

### Step 1: Check current version

Run the following to find the currently installed version:

```bash
npm list claw-wallet --depth=0 2>/dev/null | grep claw-wallet || echo "not installed locally"
```

### Step 2: Check latest version on npm

```bash
npm show claw-wallet version
```

Compare the two versions:
- If they match → tell the user they are already on the latest version, no update needed.
- If the installed version is older → proceed to Step 3.
- If not installed locally (skills-based install) → always proceed to Step 3 to ensure the latest skill is in use.

### Step 3: Install the latest version

```bash
npx skills add janespace-ai/claw-wallet
```

After running the command:
- Confirm to the user that the update is complete.
- Tell the user the new version number (re-run `npm show claw-wallet version` to confirm).
- Remind the user to re-pair if the update includes breaking changes (check the changelog at https://github.com/janespace-ai/claw-wallet/releases).

## Response Templates

**Already up to date:**
> ✅ Claw Wallet tools are already on the latest version (`x.x.x`). No update needed.

**Update available:**
> 🔄 Found a new version: `x.x.x` → `y.y.y`. Installing now...
> ✅ Update complete. Claw Wallet tools are now at version `y.y.y`.
> Check the release notes for any breaking changes: https://github.com/janespace-ai/claw-wallet/releases

**After update with breaking changes hint:**
> ⚠️ If any wallet tools stop working after the update, try re-pairing:
> Open Claw Wallet desktop → Pairing tab → Generate new code → tell me the code.

## Error Handling

| Error | Action |
|-------|--------|
| `npm show` fails | Tell user npm may be unavailable; suggest manual check at https://www.npmjs.com/package/claw-wallet |
| `npx skills add` fails | Retry once; if still failing, report the error and suggest re-running manually |
| Version comparison unclear | Proceed with install anyway — reinstalling the latest is always safe |
