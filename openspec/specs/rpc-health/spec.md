# rpc-health Specification

## Purpose
TBD - created by archiving change multi-account-multi-network. Update Purpose after archive.
## Requirements
### Requirement: Health check RPC providers every 10 seconds

The system SHALL perform health checks on all configured RPC providers every 10 seconds using eth_blockNumber calls.

#### Scenario: Successful health check
- **WHEN** RPC provider responds to eth_blockNumber within 1 second
- **THEN** system marks provider as healthy with recorded latency

#### Scenario: Slow response health check
- **WHEN** RPC provider responds between 1-3 seconds
- **THEN** system marks provider as degraded but still usable

#### Scenario: Failed health check
- **WHEN** RPC provider fails to respond within 3 seconds or returns error
- **THEN** system increments consecutive failure counter and marks unhealthy after 3 failures

#### Scenario: Health check interval
- **WHEN** system runs health checks
- **THEN** checks occur every 10 seconds for all RPC providers across all networks

### Requirement: RPC provider failover

The system SHALL automatically failover to secondary RPC provider when primary provider fails health checks.

#### Scenario: Primary to secondary failover
- **WHEN** primary RPC fails 3 consecutive health checks
- **THEN** system switches to secondary RPC for all new requests

#### Scenario: Secondary to fallback failover
- **WHEN** both primary and secondary RPCs are unhealthy
- **THEN** system switches to fallback RPC

#### Scenario: All providers failed notification
- **WHEN** all 3 RPC providers for Ethereum fail
- **THEN** system shows user notification about RPC failures

#### Scenario: Provider recovery
- **WHEN** failed primary RPC becomes healthy again
- **THEN** system switches back to primary RPC as preferred provider

### Requirement: Custom RPC priority

The system SHALL prioritize user-added custom RPCs over default RPCs.

#### Scenario: Custom RPC as primary
- **WHEN** user adds custom RPC for Ethereum
- **THEN** system sets high priority for custom RPC

#### Scenario: Custom RPC failure
- **WHEN** custom RPC fails health checks
- **THEN** system fails over to default RPC providers

#### Scenario: Multiple custom RPCs
- **WHEN** user adds 2 custom RPCs
- **THEN** system assigns priorities appropriately

### Requirement: RPC latency tracking

The system SHALL track and display RPC provider latency for user transparency.

#### Scenario: Latency measurement
- **WHEN** RPC provider responds to health check
- **THEN** system records latency in milliseconds

#### Scenario: Average latency calculation
- **WHEN** user views RPC provider status
- **THEN** system displays average latency over recent checks

#### Scenario: Latency-based provider selection
- **WHEN** multiple healthy providers exist at same priority
- **THEN** system selects provider with lowest average latency

### Requirement: Health status persistence

The system SHALL persist RPC health status across application restarts for 5 minutes.

#### Scenario: Health status cache
- **WHEN** application restarts within 5 minutes
- **THEN** system loads cached health status

#### Scenario: Stale health data
- **WHEN** application restarts after 5+ minutes
- **THEN** system discards cached health status and performs fresh checks

### Requirement: Manual RPC health override

The system SHALL allow users to manually trigger health checks or disable specific RPC providers.

#### Scenario: Manual health check trigger
- **WHEN** user clicks test button in settings
- **THEN** system immediately performs health check and displays result

#### Scenario: Disable RPC provider
- **WHEN** user disables specific RPC provider
- **THEN** system removes provider from rotation

#### Scenario: Re-enable RPC provider
- **WHEN** user re-enables previously disabled provider
- **THEN** system performs health check and adds provider back

