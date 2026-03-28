## Why

Desktop currently lacks a dedicated transaction history view and uses JSON files for data persistence, which limits querying capabilities and scalability. Users need:

1. **Activity Tab**: A dedicated view to see all signing decisions and transaction statuses (success/pending/failed) separate from Security events
2. **SQLite Storage**: Robust database storage for efficient queries, filtering, and future scalability
3. **Enhanced Balance Display**: Show individual token prices alongside total values to verify price accuracy

These improvements will provide better transaction audit capabilities and prepare the architecture for future features.

## What Changes

- **Activity Tab (New)**: Dedicated tab for transaction/signing history with status indicators
- **SQLite Migration**: Replace JSON-based signing history with SQLite database
- **Transaction Sync Service**: Automatically sync transaction status from blockchain every 30s
- **Enhanced Balance Display**: Show token unit prices inline with total values
- **UI Restructure**: Separate Activity (transactions) from Security (alerts/events)

## Capabilities

### New Capabilities
- `activity-tab`: New UI tab displaying signing history and transaction status
- `sqlite-database`: SQLite database for persistent transaction storage
- `tx-sync-service`: Service to sync transaction status from blockchain
- `enhanced-balance-display`: Display token unit prices in balance cards

### Modified Capabilities
- `signing-history`: Migrate from JSON to SQLite storage (breaking change, no data migration)
- `electron-wallet-app`: Add Activity tab to main navigation

## Impact

**Code Changes:**
- `desktop/src/main/database-service.ts`: New - SQLite connection management and migrations
- `desktop/src/main/signing-history.ts`: Rewrite - Use SQLite instead of JSON
- `desktop/src/main/tx-sync-service.ts`: New - Sync transaction status from blockchain
- `desktop/src/main/index.ts`: Initialize new services
- `desktop/src/renderer/index.html`: Add Activity tab structure
- `desktop/src/renderer/app.js`: Activity tab logic and enhanced balance display
- `desktop/src/renderer/styles.css`: Activity tab styling

**Dependencies:**
- Add: `better-sqlite3` - Native SQLite bindings for Node.js
- External: Blockchain RPC calls for transaction status (already available via ChainAdapter)

**Data Storage:**
- `~/.claw-wallet/wallet.db`: New SQLite database
- `~/.claw-wallet/signing-history.json`: **Removed** (no migration, fresh start)

**Breaking Changes:**
- Existing signing history in JSON format will not be migrated
- Users will start with empty history after upgrade

## Risks

**Risk: Data Loss**
- Old signing history will be lost (no migration)
- **Mitigation**: Document as breaking change, acceptable per user requirement

**Risk: SQLite Corruption**
- Database file corruption could lose all history
- **Mitigation**: Use WAL mode for reliability, atomic transactions

**Risk: Performance**
- Synchronous SQLite operations may block main process
- **Mitigation**: Use better-sqlite3's efficient native bindings, batch operations

**Risk: RPC Rate Limiting**
- Syncing many pending transactions may hit RPC limits
- **Mitigation**: Add 100ms delay between sync requests, limit to 50 transactions per cycle
