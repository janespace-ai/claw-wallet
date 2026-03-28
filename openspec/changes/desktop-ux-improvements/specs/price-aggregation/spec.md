## ADDED Requirements

### Requirement: Multi-tier price fetching with fallback
Price service SHALL attempt to fetch token prices from Gate.com first, then fall back to CoinGecko if Gate.com is unavailable.

#### Scenario: Successful price fetch from Gate.com
- **WHEN** Gate.com API is accessible
- **THEN** system fetches ETH/USDT price from Gate.com

#### Scenario: Fallback to CoinGecko when Gate.com fails
- **WHEN** Gate.com API times out or returns error
- **THEN** system falls back to CoinGecko simple price API

#### Scenario: Both APIs fail
- **WHEN** both Gate.com and CoinGecko are unreachable
- **THEN** system returns cached prices if available, otherwise returns error

### Requirement: Price caching with TTL
Price service SHALL cache fetched prices for 5 minutes to minimize API calls and respect rate limits.

#### Scenario: Return cached price within TTL
- **WHEN** price was fetched 2 minutes ago
- **THEN** system returns cached price without new API call

#### Scenario: Refresh price after TTL expiry
- **WHEN** price was fetched 6 minutes ago
- **THEN** system makes new API call to refresh price

### Requirement: Batch price fetching
Price service SHALL fetch prices for multiple tokens in a single API call when possible.

#### Scenario: Batch fetch multiple token prices
- **WHEN** wallet needs prices for ETH, USDC, DAI
- **THEN** system makes one API call requesting all three prices

### Requirement: Support common tokens
Price service SHALL support fetching prices for ETH, USDC, USDT, DAI, WETH.

#### Scenario: Fetch supported token price
- **WHEN** requested token is ETH, USDC, USDT, DAI, or WETH
- **THEN** system returns USD price from API

#### Scenario: Handle unsupported token
- **WHEN** requested token is not in supported list
- **THEN** system returns null price without error
