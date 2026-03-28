## ADDED Requirements

### Requirement: Display token balances with USD values
Desktop SHALL display each token balance (amount and symbol) alongside its USD equivalent value on the Home tab.

#### Scenario: Show ETH balance with USD value
- **WHEN** wallet holds 1.5 ETH and ETH price is $2500
- **THEN** Home tab displays "ETH    1.5    $3,750.00"

#### Scenario: Show multiple token balances
- **WHEN** wallet holds ETH, USDC, and DAI
- **THEN** Home tab displays separate rows for each token with amounts and USD values

### Requirement: Display total portfolio value
Desktop SHALL calculate and display the total portfolio value in USD at the top of the balance section.

#### Scenario: Calculate total from multiple tokens
- **WHEN** wallet holds 1 ETH ($2500) and 500 USDC ($500)
- **THEN** total portfolio displays "$3,000.00 USD"

### Requirement: Support multi-chain balance aggregation
Desktop SHALL query and display balances from all configured chains (Ethereum, Base) defined in config.json.

#### Scenario: Display balances from multiple chains
- **WHEN** config.json defines both Ethereum and Base chains
- **THEN** balance display aggregates tokens from both chains

### Requirement: Handle missing or zero balances
Desktop SHALL display "0" for tokens with zero balance and handle missing price data gracefully.

#### Scenario: Display zero balance token
- **WHEN** wallet has 0 USDC
- **THEN** display shows "USDC    0    $0.00"

#### Scenario: Handle missing price data
- **WHEN** price service fails to fetch ETH price
- **THEN** display shows "ETH    1.5    Price unavailable" without crashing
