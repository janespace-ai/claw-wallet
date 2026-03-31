# network-management Specification

## Purpose
TBD - created by archiving change multi-account-multi-network. Update Purpose after archive.
## Requirements
### Requirement: Support 8+ EVM networks

The system SHALL support Ethereum, Base, Optimism, Arbitrum, Polygon, zkSync Era, Linea, and Scroll networks with extensible configuration for additional networks.

#### Scenario: Default networks available
- **WHEN** application starts
- **THEN** system loads configuration for: Ethereum (1), Base (8453), Optimism (10), Arbitrum (42161), Polygon (137), zkSync Era (324), Linea (59144), Scroll (534352)

#### Scenario: Network metadata retrieval
- **WHEN** system queries network by chainId
- **THEN** system returns: name, chainId, nativeCurrency (name, symbol, decimals), RPC pool, block explorers

#### Scenario: Add new network
- **WHEN** developer adds new network to `network-config.json`
- **THEN** system automatically loads and makes network available without code changes

### Requirement: Configure RPC providers per network

The system SHALL maintain 3 RPC providers per network (Primary priority=1, Secondary priority=2, Fallback priority=3) with support for user-defined custom RPCs.

#### Scenario: Default RPC pool configuration
- **WHEN** network is initialized
- **THEN** system loads 3 default RPCs with priorities: 1 (LlamaRPC), 2 (AnkR/Alchemy), 3 (PublicNode)

#### Scenario: User adds custom RPC
- **WHEN** user adds custom RPC "https://my-node.example.com" to Ethereum
- **THEN** system adds RPC with priority=1 and custom=true, making it the primary provider

#### Scenario: Custom RPC removal
- **WHEN** user removes custom RPC
- **THEN** system falls back to default RPC pool for that network

### Requirement: Filter UI by network

The system SHALL provide network filter dropdown allowing users to view balances and transactions for specific network or all networks (default).

#### Scenario: Default view all networks
- **WHEN** user opens Home tab
- **THEN** system displays aggregated balances from all 8+ networks

#### Scenario: Filter to single network
- **WHEN** user selects "Base" from network filter dropdown
- **THEN** system displays only Base balances and transactions for active account

#### Scenario: Filter persistence
- **WHEN** user selects "Optimism" filter and restarts application
- **THEN** system remembers "Optimism" filter selection and applies it on startup

#### Scenario: Clear network filter
- **WHEN** user selects "All Networks" option
- **THEN** system displays aggregated balances from all supported networks

### Requirement: Network-specific block explorers

The system SHALL provide links to network-specific block explorers for transactions and addresses.

#### Scenario: Transaction explorer link
- **WHEN** user clicks transaction hash in Activity tab
- **THEN** system opens appropriate block explorer: Ethereum→Etherscan, Base→BaseScan, Optimism→Optimistic Etherscan, etc.

#### Scenario: Address explorer link
- **WHEN** user clicks "View on Explorer" for address
- **THEN** system opens address page on correct network's block explorer

### Requirement: Detect network for incoming transactions

The system SHALL automatically detect which network a transaction occurred on based on chainId in transaction receipt.

#### Scenario: Multi-network transaction display
- **WHEN** user has transactions on Ethereum and Base
- **THEN** Activity tab displays each transaction with network badge: "🟦 Ethereum", "🔵 Base"

#### Scenario: Unknown network handling
- **WHEN** transaction receipt has unsupported chainId
- **THEN** system displays transaction with "Unknown Network (ChainId: {id})" label

### Requirement: Network selection in Agent tools

The system SHALL require Agent to specify network in transfer requests or query user for network selection.

#### Scenario: Agent specifies network
- **WHEN** Agent calls `wallet_send({ to, amount, token, chain: "base" })`
- **THEN** system executes transfer on Base network without user prompt

#### Scenario: Agent omits network parameter
- **WHEN** Agent calls `wallet_send({ to, amount: "100", token: "USDC" })` without `chain`
- **THEN** system queries balances across all networks and prompts user to select network

#### Scenario: Network selection prompt
- **WHEN** user has USDC on Ethereum (500), Base (1000), Optimism (200)
- **THEN** system displays: "You have USDC on multiple networks: Ethereum (gas: ~$5), Base (gas: ~$0.05) ✨ Recommended, Optimism (gas: ~$0.10). Which should I use?"

#### Scenario: Insufficient balance on requested network
- **WHEN** Agent requests send 100 USDC on Base but user only has 50 USDC on Base
- **THEN** system shows error "Insufficient USDC on Base. You have 50 USDC on Base, 500 USDC on Ethereum. Would you like to bridge from Ethereum to Base first?"

