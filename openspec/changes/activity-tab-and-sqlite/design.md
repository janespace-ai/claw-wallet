## Context

Desktop currently stores signing history in JSON files and mixes transaction history with security alerts in the Security tab. This change migrates to SQLite for better query capabilities and adds a dedicated Activity tab for transaction management.

**Current Architecture:**
- JSON file storage: `~/.claw-wallet/signing-history.json`
- Security tab contains both security events and signing history
- No transaction status tracking (pending/success/failed)
- Balance display lacks token unit price visibility

**Target Architecture:**
- SQLite database: `~/.claw-wallet/wallet.db`
- Dedicated Activity tab for transactions
- Automatic transaction status sync every 30s
- Enhanced balance display with token prices

## Goals / Non-Goals

**Goals:**
- Migrate signing history storage to SQLite
- Add Activity tab separate from Security tab
- Sync transaction status from blockchain automatically
- Display token unit prices in balance view
- Support filtering by transaction status (all/auto/manual/rejected/pending)
- Display recent 50 transactions with infinite scroll capability

**Non-Goals:**
- Migrate existing JSON data (fresh start)
- Search functionality (future enhancement)
- Historical balance tracking
- Transaction export features
- Multi-account support

## Decisions

### Decision 1: SQLite with better-sqlite3

**Choice:** Use `better-sqlite3` for database management

**Rationale:**
- Synchronous API simplifies code (no callback/promise complexity)
- Excellent performance with native bindings
- Widely used in Electron apps (VSCode, Discord, etc.)
- Built-in transaction support

**Alternatives Considered:**
- `sql.js`: Pure JS, but slower and memory-intensive
- `node-sqlite3`: Async API adds complexity, maintenance concerns
- Keep JSON: Limited query capabilities, doesn't scale

### Decision 2: Database Schema

**Choice:** Single database with versioned migrations

```sql
-- signing_history table
CREATE TABLE signing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT UNIQUE NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT CHECK(type IN ('auto', 'manual', 'rejected')),
  method TEXT NOT NULL,
  tx_to TEXT,
  tx_value TEXT,
  tx_token TEXT DEFAULT 'ETH',
  tx_chain TEXT NOT NULL,
  estimated_usd REAL NOT NULL,
  tx_hash TEXT,
  tx_status TEXT CHECK(tx_status IN ('pending', 'success', 'failed')),
  block_number INTEGER,
  block_timestamp INTEGER,
  gas_used INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_signing_timestamp ON signing_history(timestamp DESC);
CREATE INDEX idx_signing_tx_hash ON signing_history(tx_hash);
CREATE INDEX idx_signing_status ON signing_history(tx_status);
```

**Rationale:**
- Single table sufficient for current needs
- Indexes optimize common queries (recent records, by status)
- Timestamps in milliseconds match JavaScript convention
- Check constraints ensure data integrity

### Decision 3: No Data Migration

**Choice:** Start fresh, don't migrate JSON data

**Rationale:**
- User explicitly approved data loss
- Simplifies implementation (no migration logic needed)
- Clean slate for new schema
- Old data in JSON backup if needed for manual recovery

### Decision 4: Transaction Sync Strategy

**Choice:** Hybrid approach
- Immediate sync: After signing, query once
- Periodic sync: Every 30s for all pending transactions

**Rationale:**
- Immediate sync provides fast feedback for new transactions
- Periodic sync catches status changes (pending → success/failed)
- 30s interval balances freshness vs RPC load
- 100ms delay between requests prevents rate limiting

**Implementation:**
```typescript
// After signing
signingEngine.sign() → txHash
  → txSyncService.syncImmediately(txHash)

// Every 30s
setInterval(() => {
  pending = db.query("SELECT * WHERE tx_status = 'pending'")
  for (tx of pending) {
    await syncTxStatus(tx)
    await sleep(100) // Rate limit protection
  }
}, 30000)
```

### Decision 5: Activity Tab UI Structure

**Choice:** Tab-level separation with filter bar

```
┌─────────────────────────────────────────────────┐
│ [Home] [Pairing] [Settings] [Security] [Activity] │
└─────────────────────────────────────────────────┘
                                    ↓
                          Activity Tab
    ┌───────────────────────────────────────┐
    │ Filters: [All] [Auto] [Manual]        │
    │          [Rejected] [Pending] [Failed]│
    ├───────────────────────────────────────┤
    │ ✅ Success - 2h ago                   │
    │ 1.5 ETH ($2,000/ETH) = $3,000        │
    │ To: 0x7099...79C8                    │
    │ [Details ▼]                           │
    ├───────────────────────────────────────┤
    │ ⏳ Pending - 5m ago                   │
    │ 0.1 ETH ($2,000/ETH) = $200          │
    │ To: 0xabcd...5678                    │
    └───────────────────────────────────────┘
```

**Rationale:**
- Clear separation from Security alerts
- Filters at top for easy access
- Expandable details prevent clutter
- Most recent 50 records loaded by default

### Decision 6: Enhanced Balance Display

**Choice:** Inline price display

```
Before:  73.000000 ETH
         $146,000.00

After:   73.000000 ETH
         $146,000.00 ($2,000/ETH)
```

**Rationale:**
- Minimal UI change
- Price verification at a glance
- Parentheses indicate unit price clearly

## Risks / Trade-offs

### Risk: SQLite File Corruption
**[Risk]** Power loss or crash during write could corrupt database

**[Mitigation]**
- Use WAL (Write-Ahead Logging) mode for crash safety
- Atomic transactions ensure consistency
- Database auto-repair on corruption detection

### Risk: Main Process Blocking
**[Risk]** Synchronous SQLite calls could block Electron main process

**[Trade-off]**
- Accepted: Data volume is small (< 10K records expected)
- better-sqlite3 is extremely fast (~1ms per query)
- Batch operations use transactions for efficiency

### Risk: RPC Rate Limiting
**[Risk]** Syncing many pending transactions may exceed RPC limits

**[Mitigation]**
- 100ms delay between transaction queries
- Limit sync to 50 transactions per cycle
- Exponential backoff on RPC errors

### Risk: Missed Transaction Status Updates
**[Risk]** If app is closed, pending transactions won't update

**[Trade-off]**
- Accepted: Sync resumes on next app launch
- Pending transactions eventually update
- No critical data loss, just delayed status

## Open Questions

_None - all decisions finalized per user requirements._
