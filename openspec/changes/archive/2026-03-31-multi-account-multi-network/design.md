# Multi-Account & Multi-Network Design

## Context

### Current Architecture

**Desktop Wallet (Electron)**:
- **Single Account**: One address derived from mnemonic at `m/44'/60'/0'/0/0`
- **Limited Networks**: Only Ethereum (ChainId 1) and Base (ChainId 8453) supported
- **Single WebSocket**: One connection to Relay Server per Desktop instance
- **Monolithic Key Manager**: `key-manager.ts` handles one private key
- **Simple Balance Service**: `balance-service.ts` queries one RPC per network

**Relay Server (Go)**:
- **No Connection Limits**: Unlimited WebSocket connections per IP
- **Pair ID Routing**: Routes messages based on Pair ID (already supports multiple Desktop connections per mnemonic)

**Agent (TypeScript)**:
- **Network-Unaware Tools**: `wallet_send` doesn't specify chain
- **Single-Address Assumption**: Assumes Desktop has one address

### Why Change?

**User Pain Points**:
1. **Account Isolation**: Users want separate accounts for different Agents (trading bot vs savings vs daily spending) but don't want multiple mnemonics
2. **Multi-Chain Assets**: Users have funds on Optimism, Arbitrum, Polygon but can't see or use them
3. **RPC Reliability**: When Infura goes down, Desktop becomes unusable
4. **Cost Optimization**: Transactions on Base cost $0.05 but Ethereum costs $5 - users want to choose

**Technical Constraints**:
- **No Breaking Changes**: Existing single-account + Ethereum/Base users must work unchanged
- **E2E Encryption**: All cross-account messages must maintain encryption
- **Desktop Performance**: 10 WebSocket connections must not slow down UI
- **Database Migration**: Existing signing history must be preserved

### Stakeholders

- **End Users**: Want simplicity despite increased power
- **Agent Developers**: Need clear network selection APIs
- **Infrastructure**: Relay Server must handle 10x connection load
- **Security Auditors**: Account isolation must be bulletproof

## Goals / Non-Goals

**Goals:**

1. ✅ **Multi-Account Support**: Up to 10 accounts from one mnemonic, each with independent state
2. ✅ **Multi-Network Coverage**: Support 8+ EVM chains with aggregated portfolio view
3. ✅ **Reliability**: RPC failover ensures continuous operation
4. ✅ **Performance**: Account switching < 200ms, balance aggregation < 3s
5. ✅ **Security**: Zero data leakage between accounts
6. ✅ **Backward Compatibility**: Existing users upgrade seamlessly

**Non-Goals:**

1. ❌ **Cross-Chain Bridging**: No automatic asset bridging (suggest only)
2. ❌ **Non-EVM Chains**: No Bitcoin, Solana, Cosmos support
3. ❌ **Account Hierarchies**: No account groups, folders, or nested structures
4. ❌ **Network Auto-Detection**: Agent must explicitly specify or query for network
5. ❌ **Hardware Wallet Integration**: Software-only key derivation

## Decisions

### Decision 1: BIP-44 Account Derivation

**Choice**: Use BIP-44 path `m/44'/60'/0'/0/{accountIndex}` for indices 0-9

**Rationale**:
- **Standard Compliance**: BIP-44 is the industry standard for HD wallets
- **Compatibility**: Matches MetaMask, Ledger, Trezor derivation paths
- **User Recovery**: Users can recover all accounts in any BIP-44 wallet
- **Security**: Each account has separate private key (not just addresses)

**Alternatives Considered**:
- ❌ **Different Account Levels** (`m/44'/60'/{accountIndex}'/0/0`): Non-standard, recovery issues
- ❌ **Custom Derivation**: Would break compatibility with hardware wallets
- ❌ **Address-Only Accounts**: Insecure, all accounts share one private key

**Implementation**:
```typescript
// desktop/src/main/account-manager.ts
import { ethers } from 'ethers';

class AccountManager {
  deriveAccount(mnemonic: string, accountIndex: number): Account {
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error('Account index must be 0-9');
    }
    
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const wallet = ethers.Wallet.fromPhrase(mnemonic, path);
    
    return {
      index: accountIndex,
      address: wallet.address,
      privateKey: wallet.privateKey, // Encrypted at rest
      nickname: `Account ${accountIndex}`,
      createdAt: Date.now()
    };
  }
}
```

### Decision 2: Persistent WebSocket Connection Pool

**Choice**: Maintain all active accounts' WebSocket connections simultaneously (up to 10)

**Rationale**:
- **Cross-Account Notifications**: User must receive approval requests from non-active accounts
- **Fast Switching**: No reconnection delay when switching accounts
- **Agent Availability**: Each Agent can operate on its account without interfering with others
- **Encryption Preservation**: Each connection maintains its own encryption session

**Alternatives Considered**:
- ❌ **Single Connection with Multiplexing**: Would require Relay Server redesign, breaks encryption per-account
- ❌ **Reconnect on Switch**: 2-5 second delay unacceptable for UX
- ❌ **Lazy Connection**: Would miss messages to inactive accounts

**Implementation**:
```typescript
// desktop/src/main/connection-pool.ts
class ConnectionPool {
  private connections: Map<number, {
    ws: WebSocket,
    pairId: string,
    lastActivity: number
  }> = new Map();
  
  async connectAccount(accountIndex: number): Promise<void> {
    if (this.connections.has(accountIndex)) {
      console.log(`Account ${accountIndex} already connected`);
      return;
    }
    
    const pairId = await this.computePairId(accountIndex);
    const ws = await this.relayBridge.connect(pairId);
    
    this.connections.set(accountIndex, {
      ws,
      pairId,
      lastActivity: Date.now()
    });
    
    // Route all messages to MessageRouter
    ws.on('message', (msg) => {
      this.messageRouter.route(accountIndex, msg);
    });
    
    ws.on('close', () => {
      this.connections.delete(accountIndex);
      // Attempt reconnection
      setTimeout(() => this.connectAccount(accountIndex), 5000);
    });
  }
  
  async connectAll(): Promise<void> {
    const accounts = await this.accountManager.listAccounts();
    await Promise.all(
      accounts.map(acc => this.connectAccount(acc.index))
    );
  }
}
```

**Risks**:
- **Memory**: 10 WebSocket connections ~10MB RAM (acceptable)
- **CPU**: Message handling overhead (mitigated by async routing)
- **Network**: 10 keepalive pings every 30s (negligible bandwidth)

### Decision 3: Global Message Router for Cross-Account Notifications

**Choice**: Centralized router receives messages from all accounts, forwards to UI regardless of active account

**Rationale**:
- **User Requirement**: "User must see approval requests from Account 0 even when viewing Account 1"
- **Decoupling**: UI doesn't need to know which accounts are connected
- **Filtering**: Router can prioritize critical messages (signing requests) over informational (balance updates)

**Alternatives Considered**:
- ❌ **UI Polls All Connections**: High complexity, tight coupling
- ❌ **Only Active Account Receives**: Misses cross-account messages (user requirement violation)
- ❌ **Relay Server Routes**: Would require server-side changes, breaks E2E encryption

**Implementation**:
```typescript
// desktop/src/main/message-router.ts
class MessageRouter {
  private activeAccountIndex: number = 0;
  
  route(fromAccountIndex: number, message: EncryptedMessage): void {
    const decrypted = this.decrypt(fromAccountIndex, message);
    
    switch (decrypted.type) {
      case 'SIGN_REQUEST':
        // Always show, even if not active account
        this.showApprovalDialog(fromAccountIndex, decrypted);
        break;
        
      case 'BALANCE_UPDATE':
        // Only process if active account (avoid redundant updates)
        if (fromAccountIndex === this.activeAccountIndex) {
          this.updateBalances(decrypted);
        }
        break;
        
      case 'PAIRING_STATUS':
        // Always process (affects account metadata)
        this.updatePairingStatus(fromAccountIndex, decrypted);
        break;
    }
  }
  
  private showApprovalDialog(accountIndex: number, request: SignRequest): void {
    // Show modal with account indicator
    ipcMain.emit('show-approval', {
      fromAccount: accountIndex,
      fromAccountAddress: this.accountManager.getAddress(accountIndex),
      fromAccountNickname: this.accountManager.getNickname(accountIndex),
      ...request
    });
  }
}
```

### Decision 4: RPC Provider Manager with Health Checking

**Choice**: Pool of 3 RPC providers per network (Primary, Secondary, Fallback) with 10-second health checks

**Rationale**:
- **Reliability**: If Infura fails, automatically use Alchemy
- **User Control**: Allow custom RPC endpoints for advanced users
- **Transparency**: Only notify when ALL providers fail (user requirement)
- **Performance**: Health check adds < 10ms overhead (acceptable)

**Alternatives Considered**:
- ❌ **Single RPC per Network**: Unreliable (real-world outages common)
- ❌ **Round-Robin**: Slow providers degrade experience
- ❌ **User-Managed Only**: Too complex for average users

**Implementation**:
```typescript
// desktop/src/main/rpc-provider-manager.ts
interface RPCProvider {
  url: string;
  priority: 1 | 2 | 3; // 1=Primary, 2=Secondary, 3=Fallback
  custom: boolean; // User-added?
  chainId: number;
}

interface HealthMetrics {
  healthy: boolean;
  latency: number; // milliseconds
  lastCheck: number; // timestamp
  consecutiveFailures: number;
}

class RPCProviderManager {
  private healthStatus: Map<string, HealthMetrics> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  async getProvider(chainId: number): Promise<ethers.JsonRpcProvider> {
    const providers = this.config.getProviders(chainId);
    
    // Sort by priority, then by health
    const sorted = providers
      .filter(p => this.isHealthy(p.url))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return this.getLatency(a.url) - this.getLatency(b.url);
      });
    
    if (sorted.length === 0) {
      // All providers failed - notify user
      this.notifyAllProvidersFailed(chainId);
      throw new Error(`All RPC providers for chain ${chainId} are down`);
    }
    
    return new ethers.JsonRpcProvider(sorted[0].url);
  }
  
  startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks();
    }, 10000); // Every 10 seconds
  }
  
  private async runHealthChecks(): Promise<void> {
    const allProviders = this.config.getAllProviders();
    
    await Promise.all(
      allProviders.map(provider => this.checkHealth(provider.url))
    );
  }
  
  private async checkHealth(url: string): Promise<void> {
    const start = Date.now();
    
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // Quick check
      const latency = Date.now() - start;
      
      this.healthStatus.set(url, {
        healthy: latency < 1000, // < 1s is healthy
        latency,
        lastCheck: Date.now(),
        consecutiveFailures: 0
      });
    } catch (error) {
      const prev = this.healthStatus.get(url);
      this.healthStatus.set(url, {
        healthy: false,
        latency: 0,
        lastCheck: Date.now(),
        consecutiveFailures: (prev?.consecutiveFailures || 0) + 1
      });
    }
  }
  
  private isHealthy(url: string): boolean {
    const status = this.healthStatus.get(url);
    if (!status) return false;
    
    // Allow 3 consecutive failures before marking unhealthy
    return status.healthy && status.consecutiveFailures < 3;
  }
}
```

**Health Check Strategy**:
- **Interval**: 10 seconds (balance between responsiveness and overhead)
- **Test**: `eth_blockNumber` call (fast, universal)
- **Threshold**: < 1000ms latency = healthy
- **Grace Period**: 3 consecutive failures before marking down (avoid flapping)

### Decision 5: Network Configuration System

**Choice**: JSON config file with default + user-overridable RPC endpoints

**Config Structure**:
```json
{
  "networks": {
    "1": {
      "name": "Ethereum",
      "chainId": 1,
      "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
      "rpcs": [
        { "url": "https://eth.llamarpc.com", "priority": 1, "custom": false },
        { "url": "https://rpc.ankr.com/eth", "priority": 2, "custom": false },
        { "url": "https://ethereum.publicnode.com", "priority": 3, "custom": false }
      ],
      "explorers": ["https://etherscan.io"]
    },
    "8453": {
      "name": "Base",
      "chainId": 8453,
      "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
      "rpcs": [
        { "url": "https://mainnet.base.org", "priority": 1, "custom": false },
        { "url": "https://base.llamarpc.com", "priority": 2, "custom": false },
        { "url": "https://base.publicnode.com", "priority": 3, "custom": false }
      ],
      "explorers": ["https://basescan.org"]
    },
    "10": {
      "name": "Optimism",
      "chainId": 10,
      "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
      "rpcs": [
        { "url": "https://mainnet.optimism.io", "priority": 1, "custom": false },
        { "url": "https://optimism.llamarpc.com", "priority": 2, "custom": false },
        { "url": "https://optimism.publicnode.com", "priority": 3, "custom": false }
      ],
      "explorers": ["https://optimistic.etherscan.io"]
    }
    // ... Arbitrum, Polygon, zkSync Era, Linea, Scroll
  }
}
```

**Rationale**:
- **Extensibility**: Easy to add new networks without code changes
- **User Control**: Advanced users can add custom RPCs via Settings UI
- **Defaults**: Pre-configured reliable providers (LlamaRPC, AnkR, PublicNode)
- **Versioning**: Config can be updated via app updates

### Decision 6: Hybrid Balance View (Aggregated + Expandable)

**Choice**: Show total balance per token with expandable per-network breakdown (Option C from exploration)

**UI Mockup**:
```
Total Portfolio: $5,432.18  [All Networks ▼]

┌────────────────────────────────────┐
│ ETH              2.5 ETH   [▼]     │
│   ├─ Ethereum    1.0  $1,800       │
│   ├─ Base        1.2  $2,160       │
│   └─ Optimism    0.3  $540         │
├────────────────────────────────────┤
│ USDC           1,700 USDC  [▶]     │  ← Collapsed
└────────────────────────────────────┘

Click [▶] to expand USDC details
Click network filter → show only Base balances
```

**Rationale**:
- **Simplicity**: Default view shows total (what most users care about)
- **Detail on Demand**: Power users can drill down
- **Performance**: Expandable UI avoids rendering 8 rows per token initially
- **User Requirement**: Explicitly requested "hybrid view" in Q&A

**Alternatives Considered**:
- ❌ **Always Expanded**: Too cluttered, poor UX for many tokens
- ❌ **Always Aggregated**: Power users can't see network distribution
- ❌ **Separate Tab per Network**: Requires too many clicks to compare

### Decision 7: SQLite Schema Evolution (Add `account_index`)

**Choice**: Add `account_index INTEGER` column to all tables, default 0 for backward compatibility

**Migration Script**:
```sql
-- Migration: 20240325_add_account_index.sql

-- Add account_index to existing tables
ALTER TABLE signing_history ADD COLUMN account_index INTEGER DEFAULT 0;
ALTER TABLE security_events ADD COLUMN account_index INTEGER DEFAULT 0;
ALTER TABLE desktop_contacts ADD COLUMN account_index INTEGER DEFAULT 0;
ALTER TABLE transaction_sync ADD COLUMN account_index INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX idx_signing_history_account ON signing_history(account_index);
CREATE INDEX idx_security_events_account ON security_events(account_index);
CREATE INDEX idx_contacts_account ON desktop_contacts(account_index);
CREATE INDEX idx_tx_sync_account ON transaction_sync(account_index);

-- New table: Account metadata
CREATE TABLE accounts (
  account_index INTEGER PRIMARY KEY,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

-- Insert default account (migration for existing users)
INSERT INTO accounts (account_index, nickname, created_at)
VALUES (0, 'Main Account', strftime('%s', 'now') * 1000);
```

**Rationale**:
- **Backward Compatibility**: Default `account_index = 0` means existing data works unchanged
- **Query Isolation**: All queries automatically scoped to account via WHERE clause
- **Performance**: Indexes ensure account-scoped queries remain fast
- **Metadata**: New `accounts` table stores nicknames, creation timestamps

**Code Changes**:
```typescript
// Before: No account awareness
const history = db.prepare('SELECT * FROM signing_history WHERE address = ?').all(address);

// After: Account-scoped queries
const history = db.prepare('SELECT * FROM signing_history WHERE address = ? AND account_index = ?')
  .all(address, accountIndex);
```

### Decision 8: Agent Tool API Changes

**Choice**: Add optional `chain` parameter to `wallet_send` and `wallet_balance` tools

**New Tool Signatures**:
```typescript
// agent/tools/wallet_send.ts
interface WalletSendParams {
  to: string;           // Required
  amount: string;       // Required
  token?: string;       // Optional (default ETH)
  chain?: string;       // Optional (if missing, query user)
}

// agent/tools/wallet_balance.ts
interface WalletBalanceParams {
  token?: string;       // Optional (default all tokens)
  chain?: string;       // Optional (if missing, return all chains)
}
```

**Agent Flow**:
```typescript
// Scenario 1: Agent knows the network
await wallet_send({
  to: '0x742d...',
  amount: '100',
  token: 'USDC',
  chain: 'base' // Explicit
});

// Scenario 2: Agent doesn't know the network
const balances = await wallet_balance({ token: 'USDC' });
// Returns: { ethereum: 500, base: 1000, optimism: 200 }

// Agent prompts user:
// "You have USDC on multiple networks. Which should I use?"
// User: "Base"

await wallet_send({
  to: '0x742d...',
  amount: '100',
  token: 'USDC',
  chain: 'base' // User-selected
});
```

**Rationale**:
- **Flexibility**: Agent can specify network when known, query when not
- **User Control**: User makes final network decision
- **Backward Compatibility**: Existing Agents without `chain` param still work (prompts for network)
- **Future-Proof**: Easy to add automatic network selection later

### Decision 9: Relay Server Connection Limit

**Choice**: Enforce 10 WebSocket connections per source IP address

**Implementation** (Go):
```go
// relay/server/connection_limiter.go
type ConnectionLimiter struct {
    connections map[string]int // IP -> count
    mu          sync.RWMutex
    maxPerIP    int
}

func NewConnectionLimiter(maxPerIP int) *ConnectionLimiter {
    return &ConnectionLimiter{
        connections: make(map[string]int),
        maxPerIP:    maxPerIP,
    }
}

func (cl *ConnectionLimiter) AllowConnection(ip string) bool {
    cl.mu.Lock()
    defer cl.mu.Unlock()
    
    if cl.connections[ip] >= cl.maxPerIP {
        return false
    }
    
    cl.connections[ip]++
    return true
}

func (cl *ConnectionLimiter) ReleaseConnection(ip string) {
    cl.mu.Lock()
    defer cl.mu.Unlock()
    
    if cl.connections[ip] > 0 {
        cl.connections[ip]--
    }
}

// In WebSocket handler:
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
    ip := getClientIP(r)
    
    if !s.connLimiter.AllowConnection(ip) {
        http.Error(w, "Too many connections from this IP", http.StatusTooManyRequests)
        return
    }
    defer s.connLimiter.ReleaseConnection(ip)
    
    // ... existing WebSocket upgrade code
}
```

**Rationale**:
- **Abuse Prevention**: Prevents single IP from monopolizing server resources
- **User Requirement**: Explicitly requested "10 WebSocket limit per IP"
- **Edge Case Handling**: Users behind corporate NAT can still use system (shared limit acknowledged)

## Risks / Trade-offs

### Risk 1: WebSocket Connection Stability

**Risk**: 10 concurrent WebSocket connections per Desktop instance may be unstable

**Impact**: Users lose connectivity, miss approval requests  
**Likelihood**: Medium  
**Mitigation**:
- Automatic reconnection with exponential backoff (5s, 10s, 30s, 60s)
- Connection keepalive ping every 30 seconds
- Health monitoring: log connection failures for debugging
- Load test Relay Server with 100 concurrent Desktop clients (10 accounts each = 1000 connections)

### Risk 2: RPC Rate Limiting

**Risk**: Aggregating balances across 8 networks × 10 accounts = 80 RPC calls may hit rate limits

**Impact**: Balance display fails, users frustrated  
**Likelihood**: High  
**Mitigation**:
- **Caching**: Cache balance results for 10 seconds (reduce repeated calls)
- **Batching**: Use `eth_call` multicall where supported
- **Throttling**: Rate limit balance refresh to max 1/second
- **Multiple Providers**: Rotate through 3 providers per network
- **User RPCs**: Allow users to add unlimited custom RPCs

### Risk 3: Account Isolation Bugs

**Risk**: Data leaks between accounts (signing history, contacts, policies)

**Impact**: Critical security vulnerability, user trust destroyed  
**Likelihood**: Low (but high severity)  
**Mitigation**:
- **Code Review**: All database queries must include `account_index` check
- **Unit Tests**: Test account isolation for every database query
- **Integration Tests**: Create 2 accounts, verify data doesn't cross-contaminate
- **Audit**: Pre-launch security audit focused on account isolation
- **Defensive Programming**: TypeScript strict mode, no `any` types

**Test Cases**:
```typescript
// Test: Signing history isolation
test('signing history isolated by account', async () => {
  await accountManager.switchTo(0);
  await wallet.send({ to: '0xAAA', amount: '1' });
  
  await accountManager.switchTo(1);
  await wallet.send({ to: '0xBBB', amount: '2' });
  
  const historyAccount0 = await signingHistory.get(0);
  const historyAccount1 = await signingHistory.get(1);
  
  expect(historyAccount0).toHaveLength(1);
  expect(historyAccount1).toHaveLength(1);
  expect(historyAccount0[0].to).toBe('0xAAA');
  expect(historyAccount1[0].to).toBe('0xBBB');
});
```

### Risk 4: UI Complexity

**Risk**: Users overwhelmed by account selector + network filter

**Impact**: Poor UX, support tickets increase  
**Likelihood**: Medium  
**Mitigation**:
- **Smart Defaults**: Default to "All Accounts" and "All Networks"
- **Progressive Disclosure**: Hide advanced features until user creates 2nd account
- **Onboarding**: First-run tutorial explaining multi-account benefits
- **Tooltips**: Contextual help on hover
- **User Testing**: Test with 5+ non-technical users before launch

### Risk 5: Migration Failures

**Risk**: SQLite schema migration fails for existing users

**Impact**: App crashes on startup, data loss  
**Likelihood**: Low  
**Mitigation**:
- **Backup**: Automatically backup database before migration
- **Validation**: Test migration on copy of production database first
- **Rollback**: If migration fails, restore from backup
- **Logging**: Detailed error logging for debugging
- **Testing**: Test migration on 100+ real user databases (anonymized)

## Migration Plan

### Phase 1: Multi-Network Foundation (Week 1-2)

**Deliverables**:
- Network configuration system (`network-config.json`)
- RPC Provider Manager with health checks
- Multi-network balance aggregation
- UI: Network filter dropdown
- UI: Hybrid balance view
- Agent: Add `chain` parameter to tools

**Deployment**:
- Feature flag: `ENABLE_MULTI_NETWORK=true` (default false)
- Rollout: 10% → 50% → 100% over 1 week
- Rollback: Toggle feature flag to false

### Phase 2: Multi-Account Core (Week 3-4)

**Deliverables**:
- Account Manager (BIP-44 derivation)
- Connection Pool (WebSocket management)
- SQLite schema migration
- UI: Account selector
- Per-account data isolation

**Deployment**:
- Database migration runs on app startup (automatic)
- Feature flag: `ENABLE_MULTI_ACCOUNT=true` (default false)
- Rollout: Internal testing → Beta users → Public

**Rollback**:
- Database rollback SQL script (restore from backup)
- Feature flag toggle

### Phase 3: Cross-Account Features (Week 5)

**Deliverables**:
- Global Message Router
- Cross-account approval notifications
- Fast account switching
- Account nickname management

**Deployment**:
- Requires Phase 2 enabled
- No database changes (safe to deploy)

### Phase 4: Relay Server Updates (Week 6)

**Deliverables**:
- IP-based connection limiter (Go)
- Monitoring dashboard

**Deployment**:
- Deploy to staging Relay Server first
- Load test with 100 Desktop clients
- Deploy to production (zero downtime)
- Monitor error rates for 24 hours

**Rollback**:
- Revert Go binary to previous version
- Connection limiter disabled via config flag

### Phase 5: Agent Integration & Testing (Week 7)

**Deliverables**:
- Agent tool signature updates
- Network selection intelligence
- Integration tests
- Documentation updates

**Deployment**:
- Agent SDK version bump (breaking change)
- Migration guide for Agent developers
- Backward compatibility maintained for 3 months

## Open Questions

None - all design decisions finalized through exploration phase.

---

**Next Steps**: Create `specs` and `tasks` artifacts to begin implementation.
