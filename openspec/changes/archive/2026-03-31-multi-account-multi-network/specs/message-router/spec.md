# Message Router Specification

## ADDED Requirements

### Requirement: Route messages from all accounts to UI

The system SHALL receive messages from all active account WebSocket connections and route them to appropriate UI handlers regardless of currently active account.

#### Scenario: Message from active account
- **WHEN** signing request arrives from Account 1 (currently active)
- **THEN** system decrypts message using Account 1's key and displays approval dialog immediately

#### Scenario: Message from inactive account
- **WHEN** signing request arrives from Account 0 while Account 2 is active
- **THEN** system displays notification "From: Account 0 (Main) - Approval Request" with option to approve or switch to Account 0

#### Scenario: Multiple simultaneous requests
- **WHEN** signing requests arrive from Account 0 and Account 3 simultaneously
- **THEN** system displays both approval dialogs with clear account identifiers, allowing user to handle each independently

### Requirement: Message type prioritization

The system SHALL prioritize critical messages (signing requests) over informational messages (balance updates).

#### Scenario: Signing request prioritization
- **WHEN** signing request and balance update arrive simultaneously
- **THEN** system processes signing request first, displays dialog immediately, and queues balance update

#### Scenario: Balance update deduplication
- **WHEN** balance updates arrive from Account 1 while Account 2 is active
- **THEN** system caches update but does not trigger UI refresh until user switches to Account 1

### Requirement: Message decryption per account

The system SHALL decrypt messages using the correct account's encryption key based on which WebSocket connection received the message.

#### Scenario: Correct key selection
- **WHEN** encrypted message arrives on Account 3's WebSocket
- **THEN** system uses Account 3's derived encryption key (from Pair ID) for decryption, not other accounts' keys

#### Scenario: Decryption failure handling
- **WHEN** message decryption fails
- **THEN** system logs error "Failed to decrypt message from Account {index}" and does not display corrupt data to user

### Requirement: Cross-account notification UI

The system SHALL display approval requests from any account with clear source account identification.

#### Scenario: Approval dialog with account badge
- **WHEN** approval request from Account 0 arrives while viewing Account 1
- **THEN** dialog shows: "From: Main (0x1234...5678)", "Agent: Laptop AI", "Action: Send 0.1 ETH", with [Approve] [Reject] [Switch & View] buttons

#### Scenario: Switch and view action
- **WHEN** user clicks "Switch & View" on cross-account approval
- **THEN** system switches active account to requesting account (e.g., Account 0) and keeps approval dialog open

#### Scenario: Approve without switching
- **WHEN** user clicks "Approve" on cross-account approval while viewing Account 1
- **THEN** system signs transaction with Account 0's key, sends response, and keeps UI on Account 1 (no automatic switch)

### Requirement: Message routing resilience

The system SHALL handle message routing failures gracefully without affecting other accounts' message delivery.

#### Scenario: Routing error isolation
- **WHEN** Account 2's message handler throws error
- **THEN** system logs error, shows user notification "Error processing message from Account 2", and continues processing messages from other accounts

#### Scenario: Dead letter queue
- **WHEN** message routing fails 3 times
- **THEN** system moves message to dead letter queue and alerts user "Failed to process message from Account {index}. Check logs for details."
