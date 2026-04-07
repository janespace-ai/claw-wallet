## 1. New Branch

- [x] 1.1 Create branch `feat/wallet-call-contract` from latest `main`

## 2. New Tool: `wallet_call_contract`

- [x] 2.1 Create `agent/src/tools/wallet-call-contract.ts`
  - Export `createWalletCallContractTool(deps: ToolDependencies): ToolDefinition`
  - Parameters: `to`, `functionSignature`, `args` (JSON array string), `value?`, `chain?`
  - Parse `args` with `JSON.parse`, validate it is an array
  - Use `ethers.Interface([`function ${functionSignature}`])` to encode calldata
  - Extract function name from signature (split on `(`)
  - Call `iface.encodeFunctionData(fnName, parsedArgs)` to get `data` hex
  - Send via `walletConnection.sendToWallet("wallet_send", { to, data, value, chain })`
  - Return result (txHash, status, message) or throw on error
  - Handle JSON parse errors, ethers encode errors with clear messages

- [x] 2.2 Add `ethers` import (already available as dependency in `agent/package.json`)

- [x] 2.3 Register in `agent/src/tool-registry.ts`
  - Import `createWalletCallContractTool`
  - Add call in `createAllTools()` alongside other tools

## 3. Skill Update: `skills/claw-wallet/SKILL.md`

- [x] 3.1 Add `wallet_call_contract` row to the Tools table
  - Description: Call any smart contract function
  - Key params: `to`, `functionSignature`, `args`, `value?`, `chain?`

- [x] 3.2 Add **"DeFi & Contract Interactions"** section after "Common Flows"
  - Explain when to use `wallet_call_contract` vs `wallet_send`
  - Document the two-step approve + call pattern
  - Include known Arbitrum contract addresses table (USDC, WETH, Uniswap V3 Router, Aave V3 Pool)
  - Add example flow: Uniswap swap (USDC → ETH)
  - Add example flow: ERC-20 approve only

- [x] 3.3 Add error entries to the Error → User Response table
  - `ABI_ENCODE_ERROR`: "合约参数编码失败，请检查 functionSignature 和 args 格式"
  - `CALL_EXCEPTION`: "合约调用失败（交易 reverted），请检查参数是否正确"

## 4. TypeScript / Build Validation

- [x] 4.1 Run `tsc --noEmit` in `agent/` to confirm no type errors
- [x] 4.2 Verify the new tool appears in the tools list when `createAllTools()` is called

## 5. Manual Smoke Test

- [ ] 5.1 Test ERC-20 approve call
  - Call `wallet_call_contract` with USDC approve on Arbitrum
  - Confirm desktop shows approval dialog with correct recipient + USD estimate
  - Confirm txHash returned on success

- [ ] 5.2 Test a two-step Uniswap swap (USDC → ETH on Arbitrum)
  - Step 1: approve Uniswap Router to spend USDC
  - Step 2: call `exactInputSingle` on SwapRouter
  - Confirm both transactions succeed on-chain

- [ ] 5.3 Test error handling
  - Bad JSON in `args` → should return clear error, not crash
  - Wrong argument count → ethers encodeError should surface clearly
  - Unsupported chain → should return "Unsupported chain" error

## 6. Commit and Push

- [ ] 6.1 Commit: `feat: add wallet_call_contract tool for arbitrary contract interactions`
- [ ] 6.2 Push branch `feat/wallet-call-contract` to remote
