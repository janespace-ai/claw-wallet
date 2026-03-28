## 1. Dependencies and Setup

- [x] 1.1 Add `better-sqlite3` to desktop/package.json
- [x] 1.2 Add `@types/better-sqlite3` to desktop/package.json devDependencies
- [x] 1.3 Configure better-sqlite3 for Electron (electron-rebuild if needed)
- [x] 1.4 Test SQLite import and basic operations

## 2. Database Service Infrastructure

- [x] 2.1 Create `desktop/src/main/database-service.ts` with DatabaseService class
- [x] 2.2 Implement singleton pattern for database connection
- [x] 2.3 Add WAL mode configuration for crash safety
- [x] 2.4 Implement schema migration system with version tracking
- [x] 2.5 Create initial migration (v1) with signing_history table
- [x] 2.6 Add indexes for timestamp, tx_hash, tx_status
- [ ] 2.7 Implement database initialization in main/index.ts
- [x] 2.8 Add error handling and logging for database operations

## 3. Signing History SQLite Implementation

- [x] 3.1 Rewrite `desktop/src/main/signing-history.ts` to use SQLite
- [x] 3.2 Implement `addRecord()` with prepared statements
- [x] 3.3 Implement `updateTxHash()` to add transaction hash after signing
- [x] 3.4 Implement `updateTxStatus()` to update status/block info from chain
- [x] 3.5 Implement `getRecords(limit, offset)` for pagination
- [x] 3.6 Implement `getRecordsByType(type)` for filtering
- [x] 3.7 Implement `getPendingTransactions()` for sync service
- [x] 3.8 Implement `getRecordByRequestId()` for updates
- [x] 3.9 Add transaction support for batch operations
- [x] 3.10 Remove old JSON file handling code

## 4. Transaction Sync Service

- [x] 4.1 Create `desktop/src/main/tx-sync-service.ts` with TxSyncService class
- [x] 4.2 Inject SigningHistory and ChainAdapter dependencies
- [x] 4.3 Implement `syncImmediately(txHash, chain)` for post-sign sync
- [x] 4.4 Implement `syncPendingTransactions()` for periodic sync
- [x] 4.5 Add `startPeriodicSync(intervalMs)` with 30s default
- [x] 4.6 Add `stopPeriodicSync()` for cleanup
- [x] 4.7 Add 100ms delay between transaction queries
- [x] 4.8 Implement exponential backoff on RPC errors
- [x] 4.9 Add logging for sync operations
- [x] 4.10 Handle RPC timeout and network errors gracefully

## 5. ChainAdapter Extensions

- [x] 5.1 Add `getTransactionReceipt(txHash, chain)` method to ChainAdapter
- [x] 5.2 Implement receipt parsing (status, blockNumber, gasUsed, timestamp)
- [x] 5.3 Handle pending transactions (return null if not mined)
- [x] 5.4 Add error handling for invalid tx hashes
- [x] 5.5 Add timeout handling for slow RPC responses

## 6. SigningEngine Integration

- [ ] 6.1 Update SigningEngine to use new SQLite-based SigningHistory
- [ ] 6.2 Inject TxSyncService into SigningEngine or RelayBridge
- [ ] 6.3 Call `txSyncService.syncImmediately()` after transaction broadcast
- [ ] 6.4 Pass txHash to SigningHistory.updateTxHash() in relay-bridge
- [ ] 6.5 Ensure requestId is tracked for txHash association

## 7. Main Process Initialization

- [ ] 7.1 Initialize DatabaseService in main/index.ts
- [ ] 7.2 Initialize SigningHistory with DatabaseService
- [ ] 7.3 Initialize TxSyncService with dependencies
- [ ] 7.4 Start periodic sync on app ready
- [ ] 7.5 Stop periodic sync on app quit
- [ ] 7.6 Add IPC handler for `wallet:get-activity-records`
- [ ] 7.7 Add IPC handler for `wallet:get-activity-by-type`
- [ ] 7.8 Update existing `wallet:get-signing-history` to use new implementation

## 8. Preload API Extensions

- [ ] 8.1 Add `getActivityRecords(limit?, offset?)` to WalletAPI
- [ ] 8.2 Add `getActivityByType(type)` to WalletAPI
- [ ] 8.3 Define ActivityRecord TypeScript interface (extends SigningRecord)
- [ ] 8.4 Expose IPC methods via contextBridge

## 9. Activity Tab HTML Structure

- [ ] 9.1 Add Activity tab button to main navigation in index.html
- [ ] 9.2 Create `<div id="tab-activity" class="tab-content">` structure
- [ ] 9.3 Add filter bar with buttons (All, Auto, Manual, Rejected, Pending, Failed)
- [ ] 9.4 Add `<div id="activity-list">` container
- [ ] 9.5 Add loading spinner placeholder
- [ ] 9.6 Add empty state message
- [ ] 9.7 Add "Load More" button for pagination

## 10. Activity Tab JavaScript Logic

- [ ] 10.1 Add tab click handler for Activity tab in app.js
- [ ] 10.2 Implement `loadActivityRecords(filter)` function
- [ ] 10.3 Implement `renderActivityRecord(record)` function
- [ ] 10.4 Add status icons (✅ success, ⏳ pending, ❌ failed/rejected, 🤖 auto, 👤 manual)
- [ ] 10.5 Implement filter button click handlers
- [ ] 10.6 Implement "Load More" button for pagination
- [ ] 10.7 Add expandable details view for each record
- [ ] 10.8 Format timestamps with relative time (2h ago, 5m ago)
- [ ] 10.9 Add "Copy" buttons for addresses and tx hashes
- [ ] 10.10 Add Etherscan/Block explorer links
- [ ] 10.11 Handle loading and error states
- [ ] 10.12 Auto-refresh every 30s when Activity tab is active

## 11. Enhanced Balance Display

- [ ] 11.1 Update `renderBalances()` in app.js to include unit price
- [ ] 11.2 Modify balance card template to show `$X,XXX ($Y/TOKEN)`
- [ ] 11.3 Handle missing price data (show "Price unavailable")
- [ ] 11.4 Format unit prices with 2 decimal places

## 12. Activity Tab CSS Styling

- [ ] 12.1 Add CSS for Activity tab layout in styles.css
- [ ] 12.2 Style filter bar and filter buttons
- [ ] 12.3 Style activity record cards with status indicators
- [ ] 12.4 Add color coding (green=success, yellow=pending, red=failed/rejected)
- [ ] 12.5 Style expandable details section
- [ ] 12.6 Style Copy buttons and external links
- [ ] 12.7 Add hover effects for interactive elements
- [ ] 12.8 Style loading spinner and empty state
- [ ] 12.9 Ensure responsive layout for narrow windows
- [ ] 12.10 Add transition animations for expand/collapse

## 13. Remove Old JSON Implementation

- [ ] 13.1 Remove JSON file reading logic from old signing-history.ts (if not replaced)
- [ ] 13.2 Add migration warning in README or CHANGELOG
- [ ] 13.3 Update desktop/config.example.json if needed

## 14. Testing and Validation

- [ ] 14.1 Test database creation and migration on first run
- [ ] 14.2 Test signing record creation for auto/manual/rejected
- [ ] 14.3 Test immediate tx sync after signing
- [ ] 14.4 Test periodic sync updates pending → success
- [ ] 14.5 Test periodic sync updates pending → failed
- [ ] 14.6 Test Activity tab rendering with various filter states
- [ ] 14.7 Test pagination (Load More button)
- [ ] 14.8 Test enhanced balance display with real prices
- [ ] 14.9 Test RPC error handling and retry logic
- [ ] 14.10 Test database corruption recovery (simulate)
- [ ] 14.11 Test with 0 records (empty state)
- [ ] 14.12 Test with 100+ records (performance)
- [ ] 14.13 Verify no memory leaks in periodic sync

## 15. Documentation and Polish

- [ ] 15.1 Add JSDoc comments to DatabaseService
- [ ] 15.2 Add JSDoc comments to TxSyncService
- [ ] 15.3 Update README with SQLite dependency note
- [ ] 15.4 Add database backup instructions to docs
- [ ] 15.5 Document breaking change (no JSON migration) in CHANGELOG
- [ ] 15.6 Add error logging for all database operations
- [ ] 15.7 Add performance metrics logging (optional)
