## 1. Price Service Setup

- [x] 1.1 Create `desktop/src/main/price-service.ts` with PriceService class
- [x] 1.2 Implement Gate.com API client (`fetchFromGate()` method)
- [x] 1.3 Implement CoinGecko API client (`fetchFromCoinGecko()` method)
- [x] 1.4 Add in-memory cache with 5-minute TTL
- [x] 1.5 Implement multi-tier fallback logic in `getTokenPrices()`
- [x] 1.6 Add support for ETH, USDC, USDT, DAI, WETH tokens

## 2. Balance Service Setup

- [x] 2.1 Create `desktop/src/main/balance-service.ts` with BalanceService class
- [x] 2.2 Add viem dependency to Desktop package.json
- [x] 2.3 Implement RPC client creation from config.chains
- [x] 2.4 Implement `getETHBalance()` method using viem
- [x] 2.5 Implement `getERC20Balance()` method for known tokens
- [x] 2.6 Add `getWalletBalances()` method that queries all chains and tokens in parallel

## 3. Signing History Storage

- [x] 3.1 Create `desktop/src/main/signing-history.ts` with SigningHistory class
- [x] 3.2 Define SigningRecord interface with all required fields
- [x] 3.3 Implement JSON file storage at `~/.claw-wallet/signing-history.json`
- [x] 3.4 Add atomic write logic (write to .tmp, then rename)
- [x] 3.5 Implement `addRecord()` method with timestamp and type
- [x] 3.6 Implement `getRecords()` method returning sorted records (newest first)
- [x] 3.7 Add error handling for corrupted JSON files

## 4. IPC Handlers for New Services

- [x] 4.1 Add `wallet:get-token-prices` IPC handler in main/index.ts
- [x] 4.2 Add `wallet:get-wallet-balances` IPC handler in main/index.ts
- [x] 4.3 Add `wallet:get-signing-history` IPC handler in main/index.ts
- [x] 4.4 Initialize PriceService, BalanceService, SigningHistory instances in main process
- [x] 4.5 Pass SigningHistory instance to SigningEngine for recording

## 5. Preload API Extensions

- [x] 5.1 Add `getTokenPrices(tokens: string[]): Promise<Record<string, number>>` to WalletAPI interface
- [x] 5.2 Add `getWalletBalances(address: string): Promise<TokenBalance[]>` to WalletAPI interface
- [x] 5.3 Add `getSigningHistory(): Promise<SigningRecord[]>` to WalletAPI interface
- [x] 5.4 Define TokenBalance and SigningRecord TypeScript interfaces in preload/index.ts

## 6. SigningEngine Integration

- [x] 6.1 Inject SigningHistory instance into SigningEngine constructor
- [x] 6.2 Call `signingHistory.addRecord()` in `signDirectly()` after auto-approval
- [x] 6.3 Call `signingHistory.addRecord()` in `approve()` after manual approval
- [x] 6.4 Call `signingHistory.addRecord()` in `reject()` after rejection
- [ ] 6.5 Include txHash in record after transaction broadcast (update record if needed)

## 7. Pairing Clipboard Auto-Copy

- [x] 7.1 Update `btn-generate-code` click handler in renderer/app.js
- [x] 7.2 Construct Agent-friendly prompt: "My Claw Wallet pairing code is: {CODE}\nPlease pair with it using wallet_pair tool."
- [x] 7.3 Call `navigator.clipboard.writeText()` with formatted prompt
- [x] 7.4 Display "Copied to clipboard!" feedback message for 3 seconds
- [x] 7.5 Handle clipboard permission errors gracefully

## 8. Home Tab Balance Display

- [x] 8.1 Update `index.html` Home tab with balance section structure
- [x] 8.2 Add HTML for total portfolio value display at top
- [x] 8.3 Add HTML for token balance cards (token, amount, USD value)
- [x] 8.4 Add loading spinner placeholders for balance cards
- [x] 8.5 Update `app.js` to fetch balances when Home tab becomes active
- [x] 8.6 Implement `renderBalances()` function to display token cards
- [x] 8.7 Implement `calculateTotalValue()` function using prices and balances
- [x] 8.8 Add manual refresh button for balances
- [x] 8.9 Handle error states (API failures, price unavailable)

## 9. Security Tab Signing History Display

- [x] 9.1 Add new "Signing History" section in Security tab HTML
- [x] 9.2 Create `loadSigningHistory()` function in app.js
- [x] 9.3 Render signing records with visual indicators (🤖 auto, 👤 manual, ❌ rejected)
- [x] 9.4 Display timestamp, type, token, amount, recipient for each record
- [ ] 9.5 Add filter/search UI for history (optional enhancement)

## 10. CSS Styling

- [x] 10.1 Add CSS classes for balance cards in styles.css
- [x] 10.2 Add CSS for total portfolio value section
- [x] 10.3 Add CSS for signing history visual indicators
- [x] 10.4 Add CSS for loading spinners and error states
- [x] 10.5 Ensure responsive layout for balance display

## 11. Testing and Polish

- [x] 11.1 Test pairing clipboard copy on macOS, Linux, Windows
- [x] 11.2 Test balance display with multiple chains (Ethereum + Base)
- [x] 11.3 Test price fallback (Gate.com → CoinGecko)
- [x] 11.4 Test signing history with auto-approval, manual approval, rejection
- [x] 11.5 Test balance display with zero balances and missing prices
- [x] 11.6 Verify atomic writes for signing-history.json (simulate crashes)
- [x] 11.7 Add error logging for all external API calls
