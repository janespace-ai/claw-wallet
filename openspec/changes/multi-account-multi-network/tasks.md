# Multi-Account & Multi-Network Implementation Tasks

## 1. Phase 1: Network Configuration & RPC Management (Week 1)

- [x] 1.1 Create `desktop/network-config.json` with 8+ network configurations (Ethereum, Base, Optimism, Arbitrum, Polygon, zkSync Era, Linea, Scroll)
- [x] 1.2 Implement `NetworkConfigService` class to load and validate network configuration
- [x] 1.3 Create `RPCProviderManager` class with provider pool management
- [x] 1.4 Implement RPC health check system with `eth_blockNumber` ping every 10 seconds
- [x] 1.5 Add health metrics tracking (latency, consecutive failures, last check timestamp)
- [x] 1.6 Implement automatic RPC failover logic (Primary → Secondary → Fallback)
- [x] 1.7 Add "All providers failed" notification system
- [x] 1.8 Create `RPCHealthMonitor` background service with interval timer
- [x] 1.9 Add unit tests for RPCProviderManager failover logic
- [x] 1.10 Add integration tests for health check system with mock RPC endpoints

## 2. Phase 1: Multi-Network Balance Aggregation (Week 1-2)

- [x] 2.1 Extend `BalanceService` to support multiple networks
- [x] 2.2 Implement parallel balance querying across 8 networks with Promise.all
- [x] 2.3 Add per-network balance caching (10-second TTL)
- [x] 2.4 Implement balance aggregation by token symbol across networks
- [x] 2.5 Add token contract address mapping per network (USDC, USDT, DAI, etc.)
- [x] 2.6 Implement balance query timeout (5 seconds per network)
- [x] 2.7 Add error handling for individual network query failures
- [x] 2.8 Create `TokenRegistry` to manage ERC-20 token contracts per network
- [x] 2.9 Add support for custom ERC-20 token addition by user
- [x] 2.10 Add unit tests for balance aggregation logic

## 3. Phase 1: UI - Network Filter & Balance Display (Week 2)

- [x] 3.1 Add network filter dropdown component to Home tab header
- [x] 3.2 Implement "All Networks" default option in filter dropdown
- [x] 3.3 Add individual network options to dropdown (with icons/badges)
- [x] 3.4 Implement filter state persistence in localStorage
- [x] 3.5 Create expandable balance row component (collapsed by default)
- [x] 3.6 Add expand/collapse toggle button to balance rows
- [x] 3.7 Implement per-network balance breakdown display (with network badges)
- [x] 3.8 Add total portfolio value calculation and display at top
- [x] 3.9 Implement "Hide zero balances" toggle feature
- [x] 3.10 Add CSS styling for network badges and expandable rows
- [x] 3.11 Add manual "Refresh Balances" button
- [ ] 3.12 Test UI responsiveness with 20+ tokens across 8 networks

## 4. Phase 2: Account Derivation & Management (Week 3)

- [x] 4.1 Create `AccountManager` class in `desktop/src/main/account-manager.ts`
- [x] 4.2 Implement BIP-44 account derivation using ethers.js (`m/44'/60'/0'/0/{index}`)
- [x] 4.3 Add account index validation (0-9 only)
- [x] 4.4 Implement account creation with automatic index assignment
- [x] 4.5 Add "Maximum 10 accounts" limit enforcement
- [x] 4.6 Create `accounts` SQLite table with schema (account_index, nickname, created_at, last_used_at)
- [x] 4.7 Implement account metadata storage (insert, update, query)
- [x] 4.8 Add default account (Account 0) creation on first wallet setup
- [x] 4.9 Implement `listAccounts()` API to retrieve all created accounts
- [x] 4.10 Implement `switchAccount(accountIndex)` API with state update
- [x] 4.11 Add account nickname update functionality
- [x] 4.12 Implement last_used_at timestamp tracking on account switch
- [x] 4.13 Add unit tests for account derivation and validation
- [x] 4.14 Add integration tests for account metadata persistence

## 5. Phase 2: SQLite Schema Migration for Account Isolation (Week 3)

- [x] 5.1 Create migration script `20240325_add_account_index.sql`
- [x] 5.2 Add `account_index INTEGER DEFAULT 0` column to `signing_history` table
- [x] 5.3 Add `account_index INTEGER DEFAULT 0` column to `security_events` table
- [x] 5.4 Add `account_index INTEGER DEFAULT 0` column to `desktop_contacts` table
- [x] 5.5 Add `account_index INTEGER DEFAULT 0` column to `transaction_sync` table
- [x] 5.6 Create indexes: `idx_signing_history_account`, `idx_security_events_account`, `idx_contacts_account`
- [x] 5.7 Insert migration record for Account 0 in `accounts` table (for existing users)
- [x] 5.8 Update `DatabaseService` to execute migration on startup
- [x] 5.9 Add database backup before migration
- [ ] 5.10 Add migration rollback script
- [ ] 5.11 Test migration on copy of production database with 100+ records
- [x] 5.12 Update all database queries to include `account_index` in WHERE clause

## 6. Phase 2: WebSocket Connection Pool (Week 4)

- [x] 6.1 Create `ConnectionPool` class in `desktop/src/main/connection-pool.ts`
- [x] 6.2 Implement unique Pair ID computation per account (BLAKE3(mnemonic + account_index))
- [x] 6.3 Implement `connectAccount(accountIndex)` method with WebSocket establishment
- [x] 6.4 Add connection state tracking (Map<accountIndex, WebSocketConnection>)
- [x] 6.5 Implement `connectAllAccounts()` to establish all connections in parallel
- [x] 6.6 Add connection health monitoring with ping/pong every 30 seconds
- [x] 6.7 Implement automatic reconnection with exponential backoff (5s, 10s, 30s, 60s)
- [x] 6.8 Add reconnection success handler with backoff reset
- [x] 6.9 Implement graceful connection cleanup on application exit
- [x] 6.10 Add connection timeout handling (3-second limit for close)
- [x] 6.11 Implement connection error handling and logging
- [ ] 6.12 Add unit tests for connection pool management
- [ ] 6.13 Add integration tests with mock WebSocket server (10 simultaneous connections)

## 7. Phase 3: Global Message Router (Week 5)

- [x] 7.1 Create `MessageRouter` class in `desktop/src/main/message-router.ts`
- [x] 7.2 Implement `route(fromAccountIndex, encryptedMessage)` method
- [x] 7.3 Add per-account message decryption using correct account's encryption key
- [x] 7.4 Implement message type detection (SIGN_REQUEST, BALANCE_UPDATE, PAIRING_STATUS)
- [x] 7.5 Add priority handling: signing requests processed before balance updates
- [x] 7.6 Implement cross-account notification system for signing requests
- [x] 7.7 Add message routing to appropriate UI handlers (IPC to renderer)
- [x] 7.8 Implement balance update deduplication for inactive accounts
- [x] 7.9 Add error handling with account isolation (one account's error doesn't affect others)
- [x] 7.10 Implement dead letter queue for failed messages (3 retries)
- [x] 7.11 Add unit tests for message routing logic
- [ ] 7.12 Add integration tests for cross-account message delivery

## 8. Phase 3: UI - Account Selector & Cross-Account Notifications (Week 5)

- [x] 8.1 Add account selector dropdown component to Header (right of title)
- [x] 8.2 Implement account list display with nickname and truncated address
- [x] 8.3 Add "Create New Account" button to account selector (disabled at 10 accounts)
- [x] 8.4 Implement account switch handler with UI state update
- [x] 8.5 Add active account indicator (checkmark) in dropdown
- [x] 8.6 Implement fast account switching with cached state loading
- [x] 8.7 Create cross-account approval notification modal
- [x] 8.8 Add "From Account" badge to approval notifications (nickname + address)
- [x] 8.9 Implement three-button approval UI: [Approve] [Reject] [Switch & View]
- [x] 8.10 Add "Switch & View" action handler (switch account, keep dialog open)
- [x] 8.11 Add "Approve without switching" handler (sign, stay on current account)
- [x] 8.12 Implement account nickname edit functionality in Settings
- [x] 8.13 Add CSS styling for account selector and cross-account notifications
- [ ] 8.14 Test UI with 10 accounts and simultaneous approval requests from multiple accounts

## 9. Phase 3: Account-Scoped Data Isolation (Week 5)

- [x] 9.1 Update `SigningHistory.get()` to include `account_index` parameter
- [x] 9.2 Update `SigningHistory.add()` to include `account_index` parameter
- [x] 9.3 Update `ContactsService` queries to filter by `account_index`
- [x] 9.4 Update `SecurityEventsService` queries to filter by `account_index`
- [x] 9.5 Update `TransactionSyncService` queries to filter by `account_index`
- [x] 9.6 Update `WalletAuthorityStore` to scope policies by `account_index`
- [x] 9.7 Add account_index parameter to all IPC handlers (sign, send, contacts, etc.)
- [x] 9.8 Implement account-scoped state management in renderer process
- [x] 9.9 Add defensive checks: verify account_index present in all database queries
- [ ] 9.10 Add unit tests for data isolation (create 2 accounts, verify no cross-contamination)
- [ ] 9.11 Add integration tests for account-scoped queries

## 10. Phase 4: Relay Server - IP-Based Connection Limiting (Week 6)

- [ ] 10.1 Create `ConnectionLimiter` struct in Go: `relay/server/connection_limiter.go`
- [ ] 10.2 Implement IP extraction from HTTP request headers (handle X-Forwarded-For)
- [ ] 10.3 Add connection tracking map: `map[string]int` (IP → connection count)
- [ ] 10.4 Implement `AllowConnection(ip string) bool` method with 10-connection limit
- [ ] 10.5 Implement `ReleaseConnection(ip string)` method for cleanup
- [ ] 10.6 Add mutex for thread-safe connection map access
- [ ] 10.7 Integrate ConnectionLimiter into WebSocket handler
- [ ] 10.8 Add HTTP 429 "Too many connections from this IP" error response
- [ ] 10.9 Implement connection cleanup on WebSocket close
- [ ] 10.10 Add connection count logging and monitoring metrics
- [ ] 10.11 Add unit tests for ConnectionLimiter logic
- [ ] 10.12 Add integration tests with 11 connection attempts from same IP
- [ ] 10.13 Load test Relay Server with 100 Desktop clients (1000 total connections)

## 11. Phase 5: Agent Tool API Updates (Week 7)

- [ ] 11.1 Update `agent/tools/wallet_send.ts` to add optional `chain` parameter
- [ ] 11.2 Update `agent/tools/wallet_balance.ts` to add optional `chain` parameter
- [ ] 11.3 Implement multi-network balance query when `chain` parameter omitted
- [ ] 11.4 Add network selection prompt generation for Agent when multiple networks detected
- [ ] 11.5 Implement insufficient balance error with cross-chain suggestion
- [ ] 11.6 Update Agent tool signatures in documentation
- [ ] 11.7 Create Agent migration guide for new `chain` parameter
- [ ] 11.8 Add backward compatibility handling (no `chain` = prompt user)
- [ ] 11.9 Implement gas price estimation display in network selection prompt
- [ ] 11.10 Add unit tests for Agent tool parameter validation
- [ ] 11.11 Add integration tests for Agent multi-network interactions

## 12. Phase 5: Network-Specific Transaction Handling (Week 7)

- [ ] 12.1 Update `ChainAdapter.sendTransaction()` to accept `chainId` parameter
- [ ] 12.2 Implement network-specific gas price estimation
- [ ] 12.3 Add network-specific transaction broadcasting
- [ ] 12.4 Implement network badge display in transaction confirmation dialog
- [ ] 12.5 Add network selection validation (ensure sufficient balance on target network)
- [ ] 12.6 Update Activity tab to display network badge per transaction
- [ ] 12.7 Add network-specific block explorer links to transactions
- [ ] 12.8 Implement transaction history filtering by network
- [ ] 12.9 Add unit tests for network-specific transaction sending
- [ ] 12.10 Add integration tests for multi-network transaction flows

## 13. Testing & Quality Assurance (Week 7)

- [ ] 13.1 Run full test suite: unit tests (AccountManager, RPCProviderManager, ConnectionPool, MessageRouter)
- [ ] 13.2 Run integration tests: multi-account signing isolation, cross-account notifications
- [ ] 13.3 Run integration tests: multi-network balance aggregation, RPC failover
- [ ] 13.4 Perform manual testing: create 10 accounts, switch between them, verify data isolation
- [ ] 13.5 Test WebSocket stability: maintain 10 connections for 24+ hours
- [ ] 13.6 Test RPC failover: disable primary RPC, verify automatic switch to secondary
- [ ] 13.7 Test cross-account approvals: send approval request from Account 0 while viewing Account 5
- [ ] 13.8 Test balance aggregation performance: measure query time across 8 networks
- [ ] 13.9 Test database migration: run on 10 test databases with varying record counts
- [ ] 13.10 Perform security audit: verify no account data leakage in all queries
- [ ] 13.11 Test UI with non-technical users: 5+ user testing sessions
- [ ] 13.12 Load test Relay Server: 100 Desktop clients with 10 accounts each (1000 connections)

## 14. Documentation & Deployment (Week 7)

- [ ] 14.1 Update `README.md` with multi-account and multi-network features
- [ ] 14.2 Create user guide: "How to Create and Manage Multiple Accounts"
- [ ] 14.3 Create user guide: "Understanding Multi-Network Balances"
- [ ] 14.4 Create developer guide: "Multi-Account Architecture Overview"
- [ ] 14.5 Update Agent SDK documentation with `chain` parameter examples
- [ ] 14.6 Create migration guide for Agent developers
- [ ] 14.7 Update database schema documentation
- [ ] 14.8 Create troubleshooting guide: "RPC Provider Issues"
- [ ] 14.9 Add feature flags configuration documentation
- [ ] 14.10 Create deployment checklist for Relay Server updates
- [ ] 14.11 Document rollback procedures for each deployment phase
- [ ] 14.12 Update CHANGELOG.md with new features

## 15. Deployment & Monitoring (Week 7)

- [ ] 15.1 Deploy Relay Server with connection limiting to staging environment
- [ ] 15.2 Enable feature flag: `ENABLE_MULTI_NETWORK=true` for 10% of Desktop users
- [ ] 15.3 Monitor RPC health metrics and failover occurrences
- [ ] 15.4 Enable feature flag: `ENABLE_MULTI_ACCOUNT=true` for beta users
- [ ] 15.5 Monitor WebSocket connection stability metrics
- [ ] 15.6 Collect user feedback from beta testers
- [ ] 15.7 Rollout multi-network feature to 50% of users
- [ ] 15.8 Rollout multi-network feature to 100% of users
- [ ] 15.9 Rollout multi-account feature to 50% of users
- [ ] 15.10 Rollout multi-account feature to 100% of users
- [ ] 15.11 Deploy Relay Server connection limiting to production
- [ ] 15.12 Monitor production metrics for 7 days: connection counts, RPC failures, account usage
