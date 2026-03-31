# Account Management Specification

## ADDED Requirements

### Requirement: Derive up to 10 accounts from mnemonic

The system SHALL derive up to 10 accounts from a single BIP-39 mnemonic using BIP-44 derivation path `m/44'/60'/0'/0/{accountIndex}` where accountIndex ranges from 0 to 9.

#### Scenario: First account creation
- **WHEN** user creates a new wallet with mnemonic
- **THEN** system automatically creates Account 0 at path `m/44'/60'/0'/0/0`

#### Scenario: Additional account creation
- **WHEN** user requests to create a new account and fewer than 10 accounts exist
- **THEN** system derives next account at `m/44'/60'/0'/0/{nextIndex}` and stores metadata

#### Scenario: Maximum accounts reached
- **WHEN** user attempts to create 11th account
- **THEN** system SHALL reject with error "Maximum 10 accounts allowed"

#### Scenario: Account index validation
- **WHEN** system attempts to derive account with index < 0 or > 9
- **THEN** system SHALL throw error "Account index must be 0-9"

### Requirement: Store account metadata

The system SHALL persist account metadata in SQLite including account index, address, nickname, creation timestamp, and last used timestamp.

#### Scenario: New account metadata storage
- **WHEN** account is created
- **THEN** system stores record in `accounts` table with: account_index (0-9), address (checksummed), nickname (default "Account {index}"), created_at (Unix ms), last_used_at (NULL)

#### Scenario: Account nickname update
- **WHEN** user changes account nickname to "Trading Bot"
- **THEN** system updates `nickname` field in `accounts` table and reflects change in UI

#### Scenario: Last used timestamp update
- **WHEN** user switches to an account
- **THEN** system updates `last_used_at` to current Unix timestamp in milliseconds

### Requirement: List all accounts

The system SHALL provide API to list all created accounts sorted by account index.

#### Scenario: Retrieve all accounts
- **WHEN** UI requests account list
- **THEN** system returns array of accounts ordered by account_index (0-9), each with: index, address, nickname, created_at, last_used_at

#### Scenario: Filter active accounts
- **WHEN** system needs accounts with active WebSocket connections
- **THEN** system returns only accounts where WebSocket connection exists

### Requirement: Switch active account

The system SHALL allow switching between accounts without password re-entry, completing within 200ms.

#### Scenario: Fast account switching
- **WHEN** user clicks "Account 1" in account selector
- **THEN** system switches active account to Account 1 in < 200ms and updates all UI balances, history, contacts, and policies

#### Scenario: Account switch with cached state
- **WHEN** user switches between previously-viewed accounts
- **THEN** system loads cached state (balances, contacts) without RPC re-query for 10 seconds

#### Scenario: Account switch persists selection
- **WHEN** user switches to Account 3 and restarts application
- **THEN** system opens with Account 3 as active account

### Requirement: Isolate account data

The system SHALL enforce strict data isolation between accounts for signing history, contacts, security events, and transaction records.

#### Scenario: Signing history isolation
- **WHEN** Account 0 signs transaction to 0xAAA and Account 1 signs transaction to 0xBBB
- **THEN** querying Account 0 history returns only transaction to 0xAAA, querying Account 1 history returns only transaction to 0xBBB

#### Scenario: Contact list isolation
- **WHEN** Account 0 adds contact "Bob (0x111)" and Account 1 adds contact "Alice (0x222)"
- **THEN** Account 0 contact list shows only Bob, Account 1 contact list shows only Alice

#### Scenario: Security policy isolation
- **WHEN** Account 0 sets daily limit $1000 and Account 1 sets daily limit $5000
- **THEN** each account enforces its own daily limit independently

#### Scenario: Database query isolation enforcement
- **WHEN** system queries any account-scoped table (signing_history, desktop_contacts, security_events, transaction_sync)
- **THEN** query MUST include `WHERE account_index = ?` clause with active account index

### Requirement: Compute unique Pair ID per account

The system SHALL generate a unique Pair ID for each account to enable Agent pairing to specific accounts.

#### Scenario: Pair ID generation
- **WHEN** account is created
- **THEN** system computes Pair ID = BLAKE3(mnemonic + account_index) and stores for WebSocket connection

#### Scenario: Pair ID uniqueness
- **WHEN** two accounts (0 and 1) exist from same mnemonic
- **THEN** each account has distinct Pair ID, enabling separate Agent pairings

#### Scenario: Pairing code display
- **WHEN** user views pairing screen for Account 2
- **THEN** system displays 6-digit pairing code derived from Account 2's unique Pair ID

### Requirement: Display account identifier in UI

The system SHALL display account address (truncated) or user-set nickname in account selector and all approval dialogs.

#### Scenario: Account selector display
- **WHEN** user opens account selector dropdown
- **THEN** system shows list: "Main (0x1234...5678)", "Trading (0x5678...90ab)", "Account 2 (0x90ab...cdef)"

#### Scenario: Cross-account notification display
- **WHEN** approval request arrives from Account 0 while viewing Account 1
- **THEN** notification shows "From: Main (0x1234...5678)" with Agent name and request details

#### Scenario: Address truncation format
- **WHEN** displaying account address in UI
- **THEN** system shows first 6 and last 4 characters: `0x1234...5678` (checksum format)
