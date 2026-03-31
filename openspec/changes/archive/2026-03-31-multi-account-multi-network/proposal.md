# Multi-Account & Multi-Network Support

## Summary

Enable Desktop Wallet to manage multiple derived accounts (up to 10) and support multiple EVM networks beyond the current Ethereum + Base setup. Each account operates independently with its own WebSocket connection, pairing code, security policies, and contact list. Users can view aggregated balances across all networks with detailed breakdowns per network.

## Motivation

### Current Limitations

**Single Account**:
- Users can only use one address from their mnemonic
- No way to separate funds for different purposes (personal, trading, savings)
- All Agent interactions tied to a single address

**Limited Network Support**:
- Only Ethereum and Base are supported
- Users miss opportunities on other L2s (Optimism, Arbitrum, Polygon, etc.)
- No aggregated view of assets across chains
- No RPC failover when providers go down

### User Value

**Multi-Account Benefits**:
- **Compartmentalization**: Separate accounts for different use cases (trading bot, savings, daily spending)
- **Risk Management**: Isolate high-risk Agent operations to specific accounts
- **Organizational Clarity**: Each Agent can have its dedicated account
- **Simultaneous Operations**: Multiple Agents can work concurrently on different accounts

**Multi-Network Benefits**:
- **Cost Optimization**: Choose cheapest network for transactions (Base gas << Ethereum gas)
- **Broader Asset Access**: Access tokens only available on specific L2s
- **Network Resilience**: Automatic RPC failover ensures continuous operation
- **Unified Portfolio View**: See total assets across all chains in one place

### Business Value

- **Increased Adoption**: Power users need multi-account and multi-chain support
- **Competitive Advantage**: Most AI wallets lack sophisticated account management
- **Future-Proof**: Architecture ready for any new EVM chain
- **Reduced Support Load**: Users can self-service network issues via RPC failover

## Goals

### Primary Goals

**Multi-Account System**:
1. ✅ Support up to 10 derived accounts from one mnemonic (BIP-44: m/44'/60'/0'/0/0 - m/44'/60'/0'/0/9)
2. ✅ Each account maintains its own persistent WebSocket connection to Relay
3. ✅ Fast account switching without password re-entry
4. ✅ Cross-account notification system (see approval requests from all accounts)
5. ✅ Per-account isolation: policies, contacts, signing history, transaction records

**Multi-Network Support**:
1. ✅ Support major EVM networks: Ethereum, Base, Optimism, Arbitrum, Polygon, zkSync Era, Linea, Scroll
2. ✅ Aggregated balance view with per-network breakdown (collapsible/expandable)
3. ✅ Network-specific RPC provider pools with health checking
4. ✅ Automatic RPC failover (Primary → Secondary → Fallback)
5. ✅ User-configurable custom RPC endpoints

**Agent Integration**:
1. ✅ Agent pairs to specific account via pairing code
2. ✅ Agent specifies network in transaction requests
3. ✅ Smart network selection when user doesn't specify network

### Non-Goals

- **Cross-chain transfers** (Phase 1): No automatic bridging between networks
- **Non-EVM chains**: Bitcoin, Solana, Cosmos support not included
- **Account groups**: No hierarchical account organization (flat list only)
- **Network auto-detect**: Agent must explicitly choose or prompt user for network

## Scope

### In Scope

**Desktop Wallet**:
- Account derivation and management (0-9)
- WebSocket connection pool (10 simultaneous connections)
- Account switcher UI component
- Network filter UI component
- Cross-account message router
- RPC Provider Manager with health checks
- SQLite schema changes for account isolation
- Network configuration system

**Relay Server**:
- IP-based connection limit (10 WS per IP)
- No changes to routing logic (Pair ID already handles multiple connections)

**Agent**:
- Updated tool signatures (`chain` parameter)
- Network balance aggregation queries
- Multi-network contact resolution

**UI/UX**:
- Account selector in Header
- Network filter dropdown
- Hybrid balance view (aggregated + expandable details)
- Cross-account approval notifications
- Account nickname/label support

### Out of Scope (Future Enhancements)

- Account import from other wallets
- Hardware wallet integration
- Multi-signature accounts
- Account templates/presets
- Network performance analytics dashboard
- Automatic cross-chain routing

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                  Multi-Account × Multi-Network                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Desktop Wallet                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Account Manager (max 10 accounts)                      │ │
│  │  ├─ Account 0: m/44'/60'/0'/0/0                        │ │
│  │  │   ├─ Address: 0xAAA...                              │ │
│  │  │   ├─ WebSocket: WS1 → Pair ID abc123               │ │
│  │  │   ├─ Policies: { dailyLimit, perTxLimit, ... }     │ │
│  │  │   └─ Contacts: [Bob, Alice, ...]                   │ │
│  │  ├─ Account 1: m/44'/60'/0'/0/1                        │ │
│  │  │   └─ ...                                            │ │
│  │  └─ Account 9: m/44'/60'/0'/0/9                        │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Network Manager                                         │ │
│  │  ├─ Ethereum (Chain ID: 1)                             │ │
│  │  │   ├─ RPC Pool: [Primary, Secondary, Fallback]      │ │
│  │  │   └─ Health Monitor: every 10s                     │ │
│  │  ├─ Base (8453)                                        │ │
│  │  ├─ Optimism (10)                                      │ │
│  │  ├─ Arbitrum (42161)                                   │ │
│  │  ├─ Polygon (137)                                      │ │
│  │  └─ ... (extensible)                                   │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Global Message Router                                   │ │
│  │  └─ Forwards all account approval requests to UI       │ │
│  └────────────────────────────────────────────────────────┘ │
│       │                                                      │
│       ▼                                                      │
│  UI: Account 1 active, but can receive Account 0/2 alerts  │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Relay Server (Go)                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  IP-based Connection Limiter                                 │
│  ├─ Track connections per source IP                         │
│  ├─ Max 10 WebSockets per IP                                │
│  └─ Reject 11th connection attempt                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Agent (TypeScript)                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tool Updates:                                               │
│  ├─ wallet_send({ to, amount, token, chain })              │
│  ├─ wallet_balance({ chain?: string })                     │
│  └─ wallet_pair({ shortCode }) → uses paired account       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## User Experience

### Account Management Flow

```
User opens Desktop → Unlocked with Account 0 active

┌────────────────────────────────────┐
│ Claw Wallet    [Account 0 ▼]  🌐   │
├────────────────────────────────────┤
│ Address: 0x1234...5678             │
│                                    │
│ Account Selector Dropdown:         │
│  ✓ Account 0 (Main) 0x1234...     │
│    Account 1 (Trading) 0x5678...   │
│    Account 2 (未配对)               │
│    [+ Create New Account]          │
└────────────────────────────────────┘

User clicks "Account 1" → UI instantly switches
- All balances, history, contacts update
- WebSocket for Account 1 already connected
- Account 0 WebSocket remains active in background
```

### Cross-Account Notification

```
User viewing Account 1
         ↓
Agent A sends signing request to Account 0
         ↓
┌────────────────────────────────────┐
│  📢 Approval Request                │
├────────────────────────────────────┤
│  From: Account 0 (Main)             │
│  Agent: Laptop AI                   │
│  Action: Send 0.1 ETH to Bob        │
│  Network: Ethereum                  │
│                                    │
│  [Approve] [Reject] [Switch & View]│
└────────────────────────────────────┘

User clicks "Approve" → stays on Account 1
User clicks "Switch & View" → jumps to Account 0
```

### Multi-Network Balance View

```
┌────────────────────────────────────┐
│ Total Portfolio: $5,432.18          │
│ [All Networks ▼]                    │
├────────────────────────────────────┤
│ ETH              2.5 ETH   [▼]     │
│   ├─ Ethereum    1.0  $1,800       │
│   ├─ Base        1.2  $2,160       │
│   └─ Optimism    0.3  $540         │
├────────────────────────────────────┤
│ USDC           1,700 USDC  [▼]     │
│   ├─ Ethereum     500  $500        │
│   ├─ Base       1,000  $1,000      │
│   └─ Optimism     200  $200        │
└────────────────────────────────────┘

User clicks network filter → "Base Only"
Shows only Base assets for current account
```

### Agent Transfer Flow (No Network Specified)

```
User → Agent: "Send 100 USDC to Bob"

Agent detects missing network parameter
    ↓
Agent calls: wallet_balance({ token: "USDC" })
    ↓
Desktop returns:
{
  "ethereum": { "USDC": 500 },
  "base": { "USDC": 1000 },
  "optimism": { "USDC": 200 }
}
    ↓
Agent → User:
"You have USDC on multiple networks:
 - Ethereum: 500 USDC (gas: ~$5)
 - Base: 1000 USDC (gas: ~$0.05) ✨ Recommended
 - Optimism: 200 USDC (gas: ~$0.10)

Which network should I use?"
    ↓
User: "Use Base"
    ↓
Agent executes: wallet_send({
  to: "0x742d...",
  amount: 100,
  token: "USDC",
  chain: "base"
})
```

## Technical Approach

### Account Derivation

```typescript
// BIP-44 path: m/44'/60'/0'/0/{accountIndex}
const accounts = [];
for (let i = 0; i < 10; i++) {
  const wallet = ethers.Wallet.fromPhrase(mnemonic, `m/44'/60'/0'/0/${i}`);
  accounts.push({
    index: i,
    address: wallet.address,
    privateKey: wallet.privateKey // encrypted at rest
  });
}
```

### WebSocket Connection Pool

```typescript
class ConnectionPool {
  private connections: Map<number, WebSocket> = new Map();
  
  async connectAccount(accountIndex: number): Promise<void> {
    if (this.connections.has(accountIndex)) return;
    
    const pairId = await this.computePairId(accountIndex);
    const ws = await this.relayBridge.connect(pairId);
    this.connections.set(accountIndex, ws);
    
    // Route messages to Global Message Router
    ws.on('message', (msg) => {
      this.messageRouter.route(accountIndex, msg);
    });
  }
  
  async connectAllAccounts(): Promise<void> {
    const accounts = await this.accountManager.listAccounts();
    await Promise.all(accounts.map(acc => this.connectAccount(acc.index)));
  }
}
```

### RPC Provider Manager

```typescript
interface RPCProvider {
  url: string;
  priority: number; // 1=Primary, 2=Secondary, 3=Fallback
  custom: boolean;
}

class RPCProviderManager {
  private healthStatus: Map<string, HealthMetrics> = new Map();
  
  async getProvider(chainId: number): Promise<ethers.JsonRpcProvider> {
    const providers = this.config.networks[chainId].rpcs;
    
    // Try in priority order
    for (const rpc of providers.sort((a, b) => a.priority - b.priority)) {
      if (this.isHealthy(rpc.url)) {
        return new ethers.JsonRpcProvider(rpc.url);
      }
    }
    
    // All failed - notify user
    throw new Error(`All RPC providers for chain ${chainId} are down`);
  }
  
  startHealthChecks(): void {
    setInterval(() => {
      for (const [url, _] of this.healthStatus) {
        this.checkHealth(url);
      }
    }, 10000); // Every 10 seconds
  }
  
  private async checkHealth(url: string): Promise<void> {
    const start = Date.now();
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      const latency = Date.now() - start;
      
      this.healthStatus.set(url, {
        healthy: latency < 1000,
        latency,
        lastCheck: Date.now()
      });
    } catch (err) {
      this.healthStatus.set(url, {
        healthy: false,
        lastCheck: Date.now()
      });
    }
  }
}
```

### SQLite Schema Changes

```sql
-- Add account_index to all tables
ALTER TABLE signing_history ADD COLUMN account_index INTEGER DEFAULT 0;
ALTER TABLE security_events ADD COLUMN account_index INTEGER DEFAULT 0;
ALTER TABLE desktop_contacts ADD COLUMN account_index INTEGER DEFAULT 0;
ALTER TABLE transaction_sync ADD COLUMN account_index INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX idx_signing_history_account ON signing_history(account_index);
CREATE INDEX idx_security_events_account ON security_events(account_index);
CREATE INDEX idx_contacts_account ON desktop_contacts(account_index);

-- Account metadata table
CREATE TABLE accounts (
  account_index INTEGER PRIMARY KEY,
  nickname TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
```

## Implementation Phases

### Phase 1: Multi-Network Foundation (Week 1-2)

**Goal**: Extend network support and add RPC health checking

- [ ] Network configuration system
- [ ] RPC Provider Manager with health checks
- [ ] Multi-network balance aggregation
- [ ] UI: Network filter dropdown
- [ ] UI: Hybrid balance view (aggregated + expandable)
- [ ] Agent: Add `chain` parameter to tools

### Phase 2: Multi-Account Core (Week 3-4)

**Goal**: Enable multiple account derivation and management

- [ ] Account derivation (BIP-44 paths)
- [ ] Account metadata storage (SQLite)
- [ ] WebSocket connection pool
- [ ] UI: Account selector component
- [ ] SQLite schema migration (add account_index columns)
- [ ] Per-account data isolation

### Phase 3: Cross-Account Features (Week 5)

**Goal**: Enable cross-account notifications and seamless switching

- [ ] Global Message Router
- [ ] Cross-account approval notifications
- [ ] Fast account switching (with caching)
- [ ] Account nickname/label management
- [ ] UI: Account management settings

### Phase 4: Relay Server Updates (Week 6)

**Goal**: Add IP-based connection limits

- [ ] Connection tracking per IP
- [ ] 10 WebSocket limit enforcement
- [ ] Connection rejection with error message
- [ ] Monitoring and logging

### Phase 5: Agent Integration & Testing (Week 7)

**Goal**: Complete Agent-side integration and comprehensive testing

- [ ] Agent tool signature updates
- [ ] Network selection intelligence
- [ ] Cross-network balance queries
- [ ] Integration testing
- [ ] Performance optimization

## Success Metrics

### Functional Requirements

- ✅ Users can create and switch between up to 10 accounts
- ✅ Each account maintains independent WebSocket connection
- ✅ Users can view balances across 8+ EVM networks
- ✅ RPC failover occurs automatically without user intervention
- ✅ Cross-account notifications work from any account view
- ✅ Agent tools accept and respect `chain` parameter

### Performance Metrics

- ✅ Account switching completes in < 200ms
- ✅ RPC health check adds < 10ms overhead
- ✅ 10 simultaneous WebSocket connections stable for 24+ hours
- ✅ Balance aggregation across 8 networks completes in < 3 seconds

### Quality Metrics

- ✅ Zero data leakage between accounts
- ✅ All RPC failures handled gracefully
- ✅ Network filter state persists across sessions
- ✅ Account nicknames stored and displayed correctly

## Risks and Mitigations

### Risk: WebSocket Connection Stability

**Impact**: 10 concurrent connections may strain Relay Server  
**Likelihood**: Medium  
**Mitigation**:
- Load test Relay with 100+ connections before rollout
- Implement connection keepalive/ping mechanism
- Add automatic reconnection with exponential backoff
- Monitor connection health in production

### Risk: RPC Provider Rate Limiting

**Impact**: Aggregating balances across 8 networks may hit rate limits  
**Likelihood**: High  
**Mitigation**:
- Implement request batching where possible
- Cache balance results for 10 seconds
- Use multiple RPC providers per network
- Add user-configurable custom RPCs

### Risk: Account Isolation Bugs

**Impact**: Data leaks between accounts (critical security issue)  
**Likelihood**: Low  
**Mitigation**:
- Comprehensive unit tests for all account-scoped queries
- Integration tests verifying isolation
- Code review with security focus
- Add account_index to ALL database queries

### Risk: UI Complexity

**Impact**: Users confused by too many options  
**Likelihood**: Medium  
**Mitigation**:
- Default to "All Accounts" and "All Networks" views
- Progressive disclosure (advanced features hidden initially)
- Tooltips and onboarding guide
- User testing with 5+ participants

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Cross-Chain Bridging Integration**
   - Integrate with Across, Stargate, or Wormhole
   - One-click bridge from high-balance to low-balance network
   - Automatic bridging when needed for transactions

2. **Network Analytics Dashboard**
   - Real-time gas price comparison across networks
   - Historical transaction cost analysis
   - Optimal network recommendations

3. **Account Templates**
   - Predefined account setups (Trading, Savings, DeFi, etc.)
   - Bulk account creation with templates
   - Template marketplace (community templates)

4. **Hardware Wallet Integration**
   - Import accounts from Ledger/Trezor
   - Mixed software/hardware account management
   - Per-account security settings

5. **Advanced RPC Management**
   - RPC performance benchmarking
   - Automatic RPC discovery and testing
   - Community-maintained RPC lists

## Dependencies

### External

- `ethers@^6.16.0` - Multi-network provider management
- Relay Server Go codebase - IP connection limiting

### Internal

- Desktop Wallet architecture (Electron + TypeScript)
- SQLite database (better-sqlite3)
- Existing WebSocket bridge (relay-bridge.ts)
- Key Manager (key-manager.ts)

## Open Questions

None - all design decisions finalized through exploration phase.

## References

- [BIP-44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [EVM Chains List](https://chainlist.org/)
- [ethers.js Multi-Provider](https://docs.ethers.org/v6/api/providers/)
