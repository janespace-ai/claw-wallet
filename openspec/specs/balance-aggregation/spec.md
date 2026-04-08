# balance-aggregation Specification

## Purpose
TBD - created by archiving change multi-account-multi-network. Update Purpose after archive.
## Requirements
### Requirement: Aggregate balances across multiple networks

The system SHALL query and aggregate token balances across all supported networks for the active account.

#### Scenario: Multi-network balance query
- **WHEN** user views Home tab with Account 0 active
- **THEN** system queries ETH and token balances on Ethereum, Base, Optimism, Arbitrum, Polygon, zkSync Era, Linea, and Scroll simultaneously

#### Scenario: Balance aggregation by token symbol
- **WHEN** user has 1 ETH on Ethereum, 1.2 ETH on Base, 0.3 ETH on Optimism
- **THEN** system displays aggregated total: "ETH: 2.5 ETH"

#### Scenario: Same token different chains
- **WHEN** user has USDC on multiple chains (Ethereum: 500, Base: 1000, Optimism: 200)
- **THEN** system aggregates to "USDC: 1,700 USDC" with expandable breakdown

### Requirement: Expandable per-network breakdown

The system SHALL provide expandable UI component showing per-network balance details for each token.

#### Scenario: Collapsed balance view
- **WHEN** balance row is collapsed (default state)
- **THEN** system shows only: "ETH 2.5 ETH $4,500 [▶]"

#### Scenario: Expanded balance view
- **WHEN** user clicks expand arrow [▶] on ETH balance
- **THEN** system shows breakdown: "Ethereum: 1.0 ETH ($1,800)", "Base: 1.2 ETH ($2,160)", "Optimism: 0.3 ETH ($540)"

#### Scenario: Network badge display
- **WHEN** displaying per-network balances
- **THEN** system shows network icon/badge: 🟦 Ethereum, 🔵 Base, 🔴 Optimism, 🟣 Arbitrum, etc.

### Requirement: Real-time price conversion

The system SHALL convert all token balances to USD using real-time price data with 5-minute cache.

#### Scenario: Balance with USD value
- **WHEN** system displays balance
- **THEN** shows both native amount and USD value: "1.5 ETH $2,700"

#### Scenario: Total portfolio value
- **WHEN** user views Home tab
- **THEN** system displays total portfolio value across all tokens and networks at top: "Total Portfolio: $5,432.18"

#### Scenario: Price cache expiration
- **WHEN** cached price data is older than 5 minutes
- **THEN** system fetches fresh prices from PriceService

#### Scenario: Price unavailable handling
- **WHEN** price data unavailable for token
- **THEN** system displays amount without USD value: "100 CUSTOM_TOKEN"

### Requirement: Network filtering

The system SHALL allow users to filter balance view to specific network or view all networks.

#### Scenario: Filter to single network
- **WHEN** user selects "Base" from network filter dropdown
- **THEN** system displays only balances for tokens on Base network for active account

#### Scenario: View all networks
- **WHEN** user selects "All Networks" (default)
- **THEN** system displays aggregated balances across all supported networks

#### Scenario: Filter persistence
- **WHEN** user selects network filter and switches accounts
- **THEN** filter selection persists across account switches

#### Scenario: Zero balance hiding
- **WHEN** user enables "Hide zero balances" toggle and filters to Optimism
- **THEN** system shows only tokens with non-zero balance on Optimism

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

### Requirement: Balance query parallelization

The system SHALL query balances across multiple networks in parallel to minimize total query time.

#### Scenario: Parallel network queries
- **WHEN** system fetches balances for 8 networks
- **THEN** all 8 queries execute in parallel, completing in < 3 seconds total

#### Scenario: Single network failure resilience
- **WHEN** Optimism RPC query fails but other networks succeed
- **THEN** system displays balances from successful networks and shows "Optimism: Query failed" for failed network

#### Scenario: Query timeout
- **WHEN** RPC query takes longer than 5 seconds
- **THEN** system cancels query and displays "Network: Timeout" instead of blocking UI

### Requirement: Token contract detection

The system SHALL automatically detect ERC-20 token contracts and fetch balances for known tokens.

#### Scenario: Standard token detection
- **WHEN** querying balances on Ethereum
- **THEN** system fetches balances for: USDC, USDT, DAI, WETH, and other tokens from default token list

#### Scenario: Custom token addition
- **WHEN** user adds custom ERC-20 token contract address
- **THEN** system adds token to query list and fetches balance on specified network

#### Scenario: Multi-chain token contracts
- **WHEN** token exists on multiple chains (e.g., USDC)
- **THEN** system uses correct contract address per network: Ethereum (0xA0b...), Base (0xd9a...)

