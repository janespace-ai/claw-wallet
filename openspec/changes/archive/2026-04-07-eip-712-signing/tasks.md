## 1. Desktop — SigningEngine (`signing-engine.ts`)

- [x] 1.1 Add `sanitizeTypedDataParams(params)` private method
  - Validate `params.domain` is a plain object with at least one field
  - Validate `params.types` is a `Record<string, Array<{name, type}>>` — check structure not just existence
  - Strip `EIP712Domain` key from `types` if present (ethers derives it from domain)
  - Validate `params.value` is a plain object
  - Validate `domain.chainId` if present is a positive integer
  - Throw descriptive error on invalid input

- [x] 1.2 Add `sign_typed_data` case in `signDirectly()`
  - Call `this.sanitizeTypedDataParams(params)` → `{ domain, types, value }`
  - Call `await wallet.signTypedData(domain, types, value)`
  - Add a signing history record: `method: "sign_typed_data"`, `to: domain.verifyingContract ?? ""`, `value: "0"`, `token: "N/A"`, `estimatedUSD: 0`
  - Return `{ signature, address: wallet.address }`

- [x] 1.3 Update budget / auto-approve logic
  - In `isWithinBudget()` (or equivalent allowance check), return `{ withinBudget: false }` for `sign_typed_data`
  - This forces the approval dialog to always show for typed data requests

- [x] 1.4 TypeScript: import `TypedDataDomain`, `TypedDataField` from ethers (already a dependency)

## 2. Desktop — Relay Channel (`relay-account-channel.ts`)

- [x] 2.1 Add typed data extraction branch in `handleSignRequest()`
  - When `method === "sign_typed_data"`, build `requestInfo` from `params.domain`:
    - `to` ← `domain.verifyingContract ?? "unknown"`
    - `displayLabel` ← `domain.name ?? "Unknown Protocol"`
    - `chain` ← `String(domain.chainId ?? chain ?? "unknown")`
    - `estimatedUSD` ← `0`
    - `value` ← `"0"`, `token` ← `"N/A"`
  - Attach truncated `rawData: JSON.stringify(params.value).slice(0, 500)` for display

- [x] 2.2 Ensure the approval dialog renderer receives `displayLabel` and `rawData`
  - Check `app.js` / `index.html` approval dialog — add display for protocol name
  - If approval dialog currently only renders `to`, `value`, `token`: add a conditional block for typed data

## 3. Agent — New Tool (`wallet-sign-typed-data.ts`)

- [x] 3.1 Create `agent/src/tools/wallet-sign-typed-data.ts`
  - Export `createWalletSignTypedDataTool(walletConnection, getAddress)`
  - Parameters: `domain` (object), `types` (object), `value` (object), `chain?` (string)
  - Parameter schema must include `required: ["domain", "types", "value"]`
  - Description must cover: Hyperliquid orders, Permit2, off-chain intents
  - Include note: "Do NOT include EIP712Domain in the types object"
  - Execute: check `getAddress()` → if null return `{ error: "No wallet paired" }`
  - Call `walletConnection.sendToWallet("sign_typed_data", { domain, types, value, chain })`
  - Return result `{ signature: string }` or propagate error

- [x] 3.2 Register in `agent/src/tool-registry.ts`
  - Import `createWalletSignTypedDataTool`
  - Add to `createAllTools()` with required dependencies (`walletConnection`, `getAddress`)

## 4. Skill Update (`skills/claw-wallet/SKILL.md`)

- [x] 4.1 Add `wallet_sign_typed_data` row to the Tools table
  - Key params: `domain`, `types`, `value`, `chain?`
  - Description: "Sign EIP-712 typed data for DeFi protocol interactions"

- [x] 4.2 Add **"EIP-712 Typed Data Signing"** section after "DeFi & Contract Interactions"
  - Explain when to use `wallet_sign_typed_data` vs `wallet_call_contract`
  - Hyperliquid order signing flow (step-by-step with typed data structure)
  - Permit2 gasless approval flow
  - Known EIP-712 domains table (Hyperliquid, Permit2 on Arbitrum/Base)
  - Warning: always verify `domain.chainId` matches the target protocol's chain

- [x] 4.3 Add error entries to Error → User Response table
  - `INVALID_TYPED_DATA`: "EIP-712 数据结构无效，请检查 domain/types/value 格式"
  - `USER_REJECTED` (typed data context): "您在桌面应用中拒绝了该签名请求"

## 5. TypeScript / Build Validation

- [x] 5.1 Run `tsc --noEmit` in `desktop/` — confirm no type errors
- [x] 5.2 Run `tsc --noEmit` in `agent/` — confirm no type errors

## 6. Manual Smoke Tests

- [ ] 6.1 Test basic EIP-712 signing
  - Construct a minimal typed data (e.g. `Transfer(address to, uint256 amount)`)
  - Call `wallet_sign_typed_data` from agent
  - Confirm desktop shows approval dialog with correct domain name
  - Confirm signature returned is 65 bytes (130 hex chars + "0x" = 132 chars total)

- [ ] 6.2 Test error handling
  - `types` containing `EIP712Domain` → should be stripped, not error
  - Missing `domain` → should return clear validation error
  - `domain.chainId` as string `"42161"` (not number) → should coerce or error clearly
  - Malformed `types` (not array of {name, type}) → should error before signing

- [ ] 6.3 Test Permit2 structure (real-world schema)
  - Use actual Permit2 `PermitSingle` type definition
  - Confirm ethers encodes correctly and produces a recoverable signature

## 7. Commit and Push

- [ ] 7.1 Commit: `feat: add EIP-712 typed data signing (wallet_sign_typed_data)`
- [ ] 7.2 Push branch `feat/wallet-call-contract` (can commit to same branch, both are on-chain interaction capabilities)
