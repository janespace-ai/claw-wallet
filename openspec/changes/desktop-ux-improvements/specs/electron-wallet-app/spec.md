## MODIFIED Requirements

### Requirement: Home tab displays wallet address and status
The Electron App SHALL display the wallet address on the Home tab with connection status indicator and wallet balance information.

#### Scenario: Display wallet address
- **WHEN** user opens the Home tab
- **THEN** the App SHALL display the wallet Ethereum address in checksummed format

#### Scenario: Display connection status
- **WHEN** the App is connected to the Relay Server
- **THEN** the Home tab SHALL show a connected indicator (green dot) and when disconnected it SHALL show a disconnected indicator (red dot)

#### Scenario: Display token balances with USD values
- **WHEN** user views the Home tab
- **THEN** the App SHALL display each token balance (amount and symbol) alongside its USD equivalent value

#### Scenario: Display total portfolio value
- **WHEN** wallet holds multiple tokens
- **THEN** the Home tab SHALL display the total portfolio value in USD at the top of the balance section

#### Scenario: Loading state for balances
- **WHEN** balances are being fetched
- **THEN** the Home tab SHALL display loading indicators for balance cards

#### Scenario: Error state for balance fetch failure
- **WHEN** balance fetching fails
- **THEN** the Home tab SHALL display an error message with retry option
