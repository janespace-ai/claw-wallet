---
name: claw-wallet
description: Manage a Web3 wallet through natural language — check balances, send tokens, manage contacts and security policies. Use when the user asks about their wallet, crypto balances, sending tokens, or managing contacts.
version: 1.0.0
primaryEnv: RELAY_URL
# RELAY_URL default: https://wallet.janespace.xyz/relay
# Open the Claw Wallet desktop app and the relay starts automatically.
metadata:
  openclaw:
    requires:
      bins:
        - node
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
| "Desktop wallet offline" | ⚠️ App not running | "Please open the Claw Wallet desktop app first" |
| "Wallet locked" | 🔒 Locked | "Please unlock your wallet in the desktop app" |

---

## First-time Setup

When not paired, guide the user through these steps in order:

**Step 1 — Do you have a wallet?**
- No wallet yet → `wallet_create` to create one on the desktop app
- Have a wallet elsewhere → `wallet_import` to import it

**Step 2 — Generate a pairing code**
> "Open the Claw Wallet desktop app → click 'Pair' → generate a pairing code, then share the code with me."

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
| `wallet_call_contract` | Call any smart contract function | `to`, `functionSignature`, `args`, `value?`, `chain?` |
| `wallet_sign_typed_data` | Sign EIP-712 typed data for DeFi protocol interactions | `domain`, `types`, `value`, `chain?` |

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

## DeFi & Contract Interactions

Use `wallet_call_contract` when you need to interact with any smart contract beyond simple token transfers — DEX swaps, staking, governance voting, protocol deposits.

### Two-step approve + swap (Uniswap example)

**Step 1 — Approve Uniswap Router to spend USDC:**
```
wallet_call_contract {
  to: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",   // USDC on Arbitrum
  functionSignature: "approve(address,uint256)",
  args: ["0xE592427A0AEce92De3Edee1F18E0157C05861564", "10000000"],  // 10 USDC (6 decimals)
  chain: "arbitrum"
}
```

**Step 2 — Swap 10 USDC → ETH via Uniswap V3:**
```
wallet_call_contract {
  to: "0xE592427A0AEce92De3Edee1F18E0157C05861564",   // Uniswap V3 SwapRouter
  functionSignature: "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
  args: [["0xaf88d065e77c8cC2239327C5EDb3A432268e5831","0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",500,"<wallet_address>","10000000","0","0"]],
  chain: "arbitrum"
}
```

---

## EIP-712 Typed Data Signing

Use `wallet_sign_typed_data` when a protocol requires a **signed message** rather than an on-chain transaction (Hyperliquid, Permit2, CoW Protocol, 1inch Fusion, etc.).

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
| No wallet paired | "You need to pair your wallet first. Open the desktop app → Pair → generate a pairing code and share it with me." |
| Desktop offline | "The desktop app is not running. Please open Claw Wallet first." |
| `WALLET_LOCKED` | "Your wallet is locked. Please unlock it in the desktop app." |
| `USER_REJECTED` | "You rejected the operation in the desktop app." |
| `APPROVAL_TIMEOUT` | "The operation timed out. Please retry and confirm promptly in the desktop app." |
| `SESSION_FROZEN` | "Session frozen (security policy triggered). You need to re-pair." |
| Relay unreachable | "Cannot connect to relay server. Check that RELAY_URL is correct (default: https://wallet.janespace.xyz/relay)." |
| Policy limit exceeded | "Over the spending limit — transaction queued for approval (ID: `<id>`). Use wallet_approval_approve to approve." |
| `ABI_ENCODE_ERROR` | "Contract parameter encoding failed. Check the functionSignature and args format." |
| `CALL_EXCEPTION` | "Contract call failed (transaction reverted). Check your parameters." |
| `INVALID_TYPED_DATA` | "Invalid EIP-712 data structure. Check the domain/types/value format." |
