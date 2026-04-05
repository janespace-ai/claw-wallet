---
name: claw-wallet
description: Manage a Web3 wallet through natural language — check balances, send tokens, manage contacts and security policies. Use when the user asks about their wallet, crypto balances, sending tokens, or managing contacts.
version: 1.0.0
metadata:
  openclaw:
    requires:
      env:
        - RELAY_URL
      bins:
        - node
    primaryEnv: RELAY_URL
    # Default: http://localhost:8080 (Claw Wallet desktop app starts relay automatically)
    emoji: "🔐"
    homepage: https://github.com/janespace-ai/claw-wallet
---

# Claw Wallet

Keys live in the **Claw Wallet desktop app** — never in this agent. Before any wallet operation, check pairing state.

## State Check (do this first)

Call `wallet_address` silently before any wallet request. Based on the result:

| Result | Meaning | What to tell the user |
|--------|---------|----------------------|
| Returns an address | ✅ Paired and ready | Proceed |
| "No wallet paired" | ❌ Not paired | → see **First-time Setup** below |
| "Desktop wallet offline" | ⚠️ App not running | "请先打开 Claw Wallet 桌面应用" |
| "Wallet locked" | 🔒 Locked | "请在桌面应用中解锁钱包" |

---

## First-time Setup

When not paired, guide the user through these steps in order:

**Step 1 — Do you have a wallet?**
- No wallet yet → `wallet_create` to create one on the desktop app
- Have a wallet elsewhere → `wallet_import` to import it

**Step 2 — Generate a pairing code**
> "请打开 Claw Wallet 桌面应用 → 点击「配对」→ 生成配对码，然后把配对码告诉我。"

**Step 3 — Pair**
```
wallet_pair { shortCode: "<8-char code>" }
```
On success: confirm pairing and show the wallet address.

---

## Tools

| Tool | What it does | Key params |
|------|-------------|------------|
| `wallet_create` | Create new wallet on desktop | — |
| `wallet_import` | Import existing wallet | — |
| `wallet_pair` | Pair with desktop via short code | `shortCode` |
| `wallet_address` | Get wallet address | — |
| `wallet_balance` | Check ETH / token balance | `token` (ETH·USDC·USDT), `chain` (base·ethereum) |
| `wallet_estimate_gas` | Estimate gas before sending | `to`, `amount`, `chain` |
| `wallet_send` | Send ETH or tokens | `to`, `amount`, `token`, `chain` |
| `wallet_history` | Transaction history | `limit`, `offset` |
| `wallet_contacts_list` | List contacts | — |
| `wallet_contacts_add` | Add contact (user confirms on desktop) | `name`, `address`, `chain` |
| `wallet_contacts_resolve` | Look up contact address by name | `name`, `chain` |
| `wallet_contacts_remove` | Remove contact | `name` |
| `wallet_policy_get` | View spending limits | — |
| `wallet_policy_set` | Update limits or mode | `per_transaction_limit_usd`, `daily_limit_usd`, `mode` |
| `wallet_approval_list` | List pending approvals | — |
| `wallet_approval_approve` | Approve a queued tx | `id` |
| `wallet_approval_reject` | Reject a queued tx | `id` |

---

## Common Flows

### Send tokens
```
1. wallet_contacts_resolve (if sending to a contact name)
2. wallet_balance            → confirm sufficient funds
3. wallet_estimate_gas       → show user the gas cost
4. [ask user to confirm]
5. wallet_send
```
Always confirm recipient + amount with the user before calling `wallet_send`.

### Add a contact
```
wallet_contacts_add { name, address, chain }
→ User sees a confirmation dialog on desktop (normal / trusted / reject)
```
Trusted contacts can be signed automatically within policy limits. This is set by the user on desktop, not via this agent.

### Manage spending policy
```
wallet_policy_get            → show current limits
wallet_policy_set { ... }    → update limits
```
If a send is blocked by policy, show the limit and the approval ID. The user can approve via `wallet_approval_approve`.

---

## Safety Rules

- **Confirm before sending** — always ask the user to confirm address + amount first.
- **No secrets** — never display private keys, mnemonics, or passwords.
- **Validate addresses** — must start with `0x` and be 42 characters.
- **Check balance first** — run `wallet_balance` before `wallet_send`.

---

## Error → User Response

| Error | Tell the user |
|-------|--------------|
| No wallet paired | "需要先配对钱包。请打开桌面应用 → 配对 → 生成配对码，把码告诉我。" |
| Desktop offline | "桌面应用未运行，请先打开 Claw Wallet。" |
| `WALLET_LOCKED` | "钱包已锁定，请在桌面应用中解锁。" |
| `USER_REJECTED` | "您在桌面应用中拒绝了该操作。" |
| `APPROVAL_TIMEOUT` | "操作超时，请重试并及时在桌面应用中确认。" |
| `SESSION_FROZEN` | "会话已冻结（安全策略触发），需要重新配对。" |
| Relay unreachable | "无法连接中继服务器，请检查 RELAY_URL 是否正确，默认值为 http://localhost:8080。" |
| Policy limit exceeded | "超出限额，交易已进入审批队列（ID: `<id>`）。可用 wallet_approval_approve 审批。" |
