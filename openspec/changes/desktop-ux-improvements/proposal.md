## Why

Desktop currently lacks core UX features that hinder user experience: users must manually copy pairing codes and explain them to the Agent, there's no visibility into wallet balances or asset values, and no audit trail of signing decisions. These gaps make the wallet feel incomplete and reduce trust transparency.

## What Changes

- **Pairing UX**: Auto-copy pairing codes with Agent-friendly prompt that enables instant pairing
- **Balance Display**: Home tab shows token balances with USD values and total portfolio value
- **Price Fetching**: Multi-tier price service (Gate.com → CoinGecko) with caching
- **Signing History**: Persistent audit log of all signing decisions (auto-approved, manual, rejected)
- **Multi-chain Support**: Display balances across configured chains (Ethereum, Base)

## Capabilities

### New Capabilities
- `pairing-clipboard-guide`: Auto-copy pairing codes with Agent-recognizable prompt to clipboard
- `wallet-balance-display`: Show token holdings and USD values in Home tab
- `price-aggregation`: Multi-tier price fetching service with fallback and caching
- `signing-history`: Persistent database of all signing approvals/rejections with timestamps

### Modified Capabilities
- `electron-wallet-app`: Home tab UI modified to display balance data instead of just address

## Impact

**Code Changes:**
- `desktop/src/renderer/app.js`: Pairing button handler, Home tab balance rendering
- `desktop/src/renderer/index.html`: Home tab HTML structure for balance cards
- `desktop/src/main/`: New modules for price service, balance service, signing history
- `desktop/src/preload/index.ts`: New IPC methods for balances, prices, signing history

**Dependencies:**
- External APIs: Gate.com public ticker API, CoinGecko simple price API
- New npm packages: `node-fetch` (if not already present) for HTTP requests in main process

**Data Storage:**
- `~/.claw-wallet/signing-history.db`: SQLite or JSON file for signing records
- In-memory price cache (5-minute TTL) to reduce API calls
