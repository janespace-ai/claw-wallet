## MODIFIED Requirements

### Requirement: Balance caching per account

The system SHALL persist balance data per account to disk (userData directory) and use the persisted cache as the primary data source on home page load, falling back to on-chain fetch only when no cache exists or the cache is unreadable.

#### Scenario: Persistent cache hit on page load
- **WHEN** user navigates to home page and a disk cache exists for the active address
- **THEN** system renders cached balances immediately without waiting for RPC queries

#### Scenario: No cache on first load
- **WHEN** user opens home page and no disk cache exists for the active address
- **THEN** system performs full on-chain fetch (existing behavior) and writes result to disk cache on completion

#### Scenario: Balance cache invalidation
- **WHEN** user clicks "Refresh" button
- **THEN** system invalidates in-memory state, performs full on-chain fetch, and overwrites disk cache with fresh data

#### Scenario: Cache survives app restart
- **WHEN** user closes and reopens the app
- **THEN** previously cached balances are immediately available without waiting for on-chain queries

#### Scenario: Account switch uses account-specific cache
- **WHEN** user switches from Account A to Account B
- **THEN** system loads Account B's disk cache (if exists) and starts background refresh for Account B's assets
