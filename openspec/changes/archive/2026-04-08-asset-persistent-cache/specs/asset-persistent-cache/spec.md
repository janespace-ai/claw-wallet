## ADDED Requirements

### Requirement: Persist asset snapshot to disk

The system SHALL write the user's asset snapshot (balances + prices) to a per-address JSON file in Electron's userData directory after each successful fetch.

#### Scenario: Cache written after first load
- **WHEN** user opens the app for the first time and balances are fetched from chain
- **THEN** system writes `asset-cache-{address}.json` to userData directory containing all fetched balances and their USD prices

#### Scenario: Cache updated after background refresh
- **WHEN** background refresh completes for existing or newly discovered assets
- **THEN** system upserts updated entries into the cache file, preserving entries not touched in this refresh

#### Scenario: Cache file format
- **WHEN** cache file is written
- **THEN** file contains `version`, `address`, `assets` array, and `lastFullScanAt` timestamp; each asset entry includes `token`, `symbol`, `amount`, `rawAmount`, `chainId`, `chainName`, `decimals`, `price`, and `updatedAt`

#### Scenario: Cache survives app restart
- **WHEN** user closes and reopens the Electron app
- **THEN** previously persisted cache file is readable and used to populate the home page immediately

### Requirement: Instant home page load from cache

The system SHALL render cached assets immediately on home page open when a valid cache file exists for the active address.

#### Scenario: Cache hit on page load
- **WHEN** user navigates to home page and a cache file exists for the active address
- **THEN** system renders cached asset list within 200ms, before any RPC or price API calls complete

#### Scenario: No cache on first load
- **WHEN** user opens home page for the first time (no cache file)
- **THEN** system proceeds with full on-chain fetch (existing behavior) then writes cache on completion

#### Scenario: Cache read failure
- **WHEN** cache file is corrupt or unreadable (e.g., disk error, invalid JSON)
- **THEN** system falls back to full on-chain fetch and overwrites the bad cache file on success

### Requirement: Two-phase background refresh

After rendering from cache, the system SHALL perform a two-phase background refresh without blocking the UI.

#### Scenario: Phase 1 — refresh existing assets
- **WHEN** home page renders from cache
- **THEN** system immediately starts background refresh of prices and on-chain balances for all assets already present in the cache

#### Scenario: Phase 1 completes — UI updates
- **WHEN** phase 1 refresh finishes for a subset of assets
- **THEN** renderer receives updated data via IPC event and merges changes into the displayed list without full re-render

#### Scenario: Phase 2 — scan for new assets
- **WHEN** phase 1 refresh completes
- **THEN** system scans the full common-token whitelist for any tokens not already in the cache (new asset discovery)

#### Scenario: Phase 2 finds new asset
- **WHEN** phase 2 discovers a token with non-zero balance not previously in cache
- **THEN** new asset is appended to the cache file and pushed to the renderer for display

#### Scenario: Phase 2 finds no new assets
- **WHEN** phase 2 scan completes with no new non-zero balances
- **THEN** `lastFullScanAt` is updated in the cache file; no UI change

### Requirement: Agent query reads from persistent cache

When the agent queries wallet balances without specifying a token or chain, the system SHALL return the persistent cache directly without issuing on-chain queries.

#### Scenario: Agent unfiltered query uses cache
- **WHEN** agent calls `wallet_get_balances` without `tokens` or `chain` parameters
- **THEN** system returns all entries from the disk cache for the active address without RPC calls

#### Scenario: Agent unfiltered query — no cache
- **WHEN** agent calls `wallet_get_balances` without filters and no cache file exists
- **THEN** system falls back to on-chain fetch and writes result to cache before returning

### Requirement: Agent query upserts result into persistent cache

When the agent queries wallet balances for a specific token or chain, the system SHALL fetch on-chain and write the result back into the persistent cache.

#### Scenario: Agent filtered query upserts to cache
- **WHEN** agent calls `wallet_get_balances` with a specific `token` or `chain`
- **THEN** system fetches balance on-chain, upserts the result into the disk cache by `(symbol, chainId)` key, and returns the result to the agent

#### Scenario: Upserted asset appears on next home page open
- **WHEN** user queried a specific token via agent in a previous session
- **THEN** that token appears in the home page asset list immediately on next launch (from cache), even before background refresh

#### Scenario: Upsert updates existing entry
- **WHEN** agent queries a token already present in the cache
- **THEN** the existing cache entry's `amount`, `price`, and `updatedAt` are updated; no duplicate entry is created

### Requirement: Concurrent write safety

The system SHALL serialize cache file writes to prevent data corruption when background refresh and agent upsert occur simultaneously.

#### Scenario: Concurrent write serialization
- **WHEN** background refresh and an agent upsert attempt to write the cache file at the same time
- **THEN** writes are queued and executed sequentially; neither write is lost

#### Scenario: Read during write
- **WHEN** a cache read occurs while a write is in progress
- **THEN** the read returns the last successfully committed state (not partial data)
