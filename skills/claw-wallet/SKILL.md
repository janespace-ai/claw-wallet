---
name: claw-wallet
description: Manage a Web3 wallet through natural language — check balances, send tokens, manage contacts and security policies. Use when the user asks about their wallet, crypto balances, sending tokens, or managing contacts.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - node
    # Relay URL is hardcoded to http://localhost:8080 (desktop app default) in the plugin entry.
    # When using as a standalone skill, set RELAY_URL env var to override.
    emoji: "🔐"
    homepage: https://github.com/janespace-ai/claw-wallet
---

# Claw Wallet

> ⚠️ **IMPORTANT — Installation instructions**
>
> **Recommended (OpenClaw plugin — tools registered natively):**
> ```
> openclaw plugins install @janespace-ai/claw-wallet
> ```
> This registers all 19 wallet tools directly into OpenClaw and loads this document as context. No code generation needed — tools are called via native `tool_use`.
>
> **Legacy (skill only — Claude generates code to call SDK):**
> ```
> openclaw skills install claw-wallet
> ```
>
> **Setup requirements:**
> 1. Ensure the **Claw Wallet desktop app** is running on the user's machine (starts relay at `http://localhost:8080` automatically)
> 2. Call `wallet_address` to check pairing state — if not paired, follow **First-time Setup** below

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

Most DeFi protocols require approving token spending before calling the protocol:

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

### Known contract addresses (Arbitrum)

| Protocol | Contract | Address |
|----------|----------|---------|
| USDC | Token | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| WETH | Token | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| Uniswap V3 | SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |
| Uniswap V3 | SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Aave V3 | Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |

---

## EIP-712 Typed Data Signing

Use `wallet_sign_typed_data` when a protocol requires a **signed message** rather than an on-chain transaction. Common use cases:

- **Hyperliquid**: order placement sends signed typed data to an HTTP API — no gas required
- **Permit2**: gasless ERC-20 approvals bundled into a single signed message
- **CoW Protocol / 1inch Fusion**: off-chain order intents signed and submitted to solvers

### Hyperliquid limit order flow

```
1. wallet_sign_typed_data {
     domain: { name: "Exchange", chainId: 42161, verifyingContract: "0x..." },
     types:  { Order: [
       { name: "asset", type: "uint32" },
       { name: "isBuy", type: "bool" },
       { name: "limitPx", type: "uint64" },
       { name: "sz", type: "uint64" },
       { name: "reduceOnly", type: "bool" },
       { name: "cloid", type: "bytes16" }
     ]},
     value: { asset: 0, isBuy: true, limitPx: 96420, sz: 4000, reduceOnly: false, cloid: "0x..." }
   }
   → get signature

2. POST https://api.hyperliquid.xyz/exchange
   { action: { type: "order", ... }, signature: { r, s, v }, nonce: ... }
```

### Known EIP-712 domains

| Protocol | domain.name | chainId | verifyingContract |
|----------|-------------|---------|-------------------|
| Hyperliquid | `"Exchange"` | 42161 | see HL docs |
| Permit2 (Arbitrum) | `"Permit2"` | 42161 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Permit2 (Base) | `"Permit2"` | 8453 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

⚠️ Always verify `domain.chainId` matches the chain where the protocol operates.
⚠️ Do NOT include `EIP712Domain` in the `types` object — it is derived automatically.

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
| `ABI_ENCODE_ERROR` | "合约参数编码失败，请检查 functionSignature 和 args 格式。" |
| `CALL_EXCEPTION` | "合约调用失败（交易 reverted），请检查参数是否正确。" |
| `INVALID_TYPED_DATA` | "EIP-712 数据结构无效，请检查 domain/types/value 格式。" |
