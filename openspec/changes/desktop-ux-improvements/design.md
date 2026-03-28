## Context

Desktop currently provides core wallet functionality (key management, pairing, signing) but lacks essential UX features that impact usability. Users must manually explain pairing codes to the Agent, have no visibility into their holdings, and cannot audit signing decisions. This limits trust and makes the wallet feel incomplete.

The proposal introduces three independent improvements: streamlined pairing UX, balance visualization with price data, and signing audit trails. These can be implemented incrementally without blocking each other.

**Current Architecture:**
- Electron app with main process (Node.js) and renderer process (browser-like)
- IPC communication via `contextBridge` (preload.ts) and `ipcMain/ipcRenderer`
- Main process services: KeyManager, SigningEngine, RelayBridge, SecurityMonitor
- Renderer: Vanilla JS (app.js), no framework
- Data storage: JSON files in `~/.claw-wallet/`

**Constraints:**
- Content Security Policy (CSP) blocks renderer from making HTTP requests → main process must fetch external data
- SQLite not currently used → prefer JSON for consistency
- No build tooling changes → use built-in Node.js APIs where possible

## Goals / Non-Goals

**Goals:**
- Enable instant Agent pairing via clipboard auto-copy
- Display real-time wallet balance with USD values across configured chains
- Provide complete audit trail of all signing decisions
- Multi-tier price fetching with fallback to ensure reliability
- Maintain existing signing flow without breaking changes

**Non-Goals:**
- Historical price charts or advanced analytics
- Portfolio management features (buy/sell, swap)
- Mobile app support
- Real-time WebSocket price updates (5-minute cache is sufficient)
- Transaction history display (separate from signing history)

## Decisions

### Decision 1: Clipboard API in Renderer vs Main Process

**Choice:** Use `navigator.clipboard.writeText()` in renderer process

**Rationale:**
- Electron supports browser Clipboard API in renderer without additional setup
- Simpler than IPC round-trip to main process
- CSP allows clipboard access (`clipboard-write` permission implicit)

**Alternatives Considered:**
- Main process `clipboard` module: More complex, unnecessary IPC overhead
- `document.execCommand('copy')`: Deprecated API

### Decision 2: Price Service Architecture - Multi-tier with Caching

**Choice:** Gate.com primary, CoinGecko fallback, 5-minute in-memory cache

**Rationale:**
- Gate.com has higher rate limits and lower latency for Asian users
- CoinGecko provides reliable fallback (industry standard, 30 req/min free tier)
- 5-minute cache balances freshness vs API rate limits
- In-memory cache (vs Redis/disk) keeps architecture simple

**Alternatives Considered:**
- Uniswap on-chain prices: Requires RPC calls, not practical for local dev (Hardhat has no real prices)
- Single-source (CoinGecko only): Less resilient to API failures
- Longer cache (15min): Too stale for volatile assets

**Implementation:**
```typescript
class PriceService {
  private cache: Map<string, { price: number; fetchedAt: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getTokenPrices(tokens: string[]): Promise<Record<string, number>> {
    // 1. Check cache first
    // 2. Try Gate.com API: /api/v4/spot/tickers
    // 3. Fallback to CoinGecko: /api/v3/simple/price
    // 4. Update cache
  }
}
```

### Decision 3: Balance Fetching - Chain Adapter Bridge vs Direct RPC

**Choice:** Create `BalanceService` in main process that reuses viem logic from Agent's ChainAdapter

**Rationale:**
- Desktop already has `config.chains` with RPC URLs (recent addition)
- viem provides robust RPC client with type safety
- Consistent with Agent architecture (both use viem)
- npm package already in dependencies

**Alternatives Considered:**
- Ethers.js: Another dependency, viem is already used in Agent
- Raw `node-fetch` to RPC: Reinventing wheel, error-prone

**Implementation:**
```typescript
// desktop/src/main/balance-service.ts
import { createPublicClient, http, formatEther } from "viem";
import { mainnet, base } from "viem/chains";

class BalanceService {
  private clients: Map<string, PublicClient> = new Map();

  async getBalances(address: string, chains: ChainConfig[]): Promise<TokenBalance[]> {
    // Query ETH balance + known ERC20 tokens from config
    // Return { token, amount, chain }[]
  }
}
```

### Decision 4: Signing History Storage - JSON vs SQLite

**Choice:** JSON file (`signing-history.json`) with in-memory array

**Rationale:**
- Consistency with existing storage pattern (KeyManager, SecurityMonitor use JSON)
- No new dependencies (SQLite would require `better-sqlite3` npm package)
- Signing volume is low (dozens/day, not thousands)
- JSON is human-readable for debugging

**Alternatives Considered:**
- SQLite: Overkill for current scale, adds dependency and complexity
- Append-only log file: Harder to query, no structured format

**Data structure:**
```typescript
interface SigningRecord {
  requestId: string;
  timestamp: number;
  type: "auto" | "manual" | "rejected";
  method: string;
  to: string;
  value: string;
  token: string;
  chain: string;
  estimatedUSD: number;
  txHash?: string; // Added after broadcast
}

// signing-history.json
{ "records": SigningRecord[] }
```

**Storage location:** `~/.claw-wallet/signing-history.json`

### Decision 5: UI Update Strategy - Polling vs Event-Driven

**Choice:** Polling for balances (on Home tab activation), event-driven for signing history

**Rationale:**
- Balances: External data (blockchain + price APIs) → poll when tab becomes active + manual refresh button
- Signing history: Internal event (already have IPC events) → update immediately on sign

**Alternatives Considered:**
- WebSocket for prices: Complex, overkill for 5-min cache TTL
- Polling for signing history: Unnecessary when we control the event source

### Decision 6: Pairing Prompt Language - English

**Choice:** English prompt for Agent recognition

**Rationale:**
- Agent (Claude) is primarily English-trained LLM
- English keywords more reliably trigger tool use
- International users already interact with Agent in English

**Prompt format:**
```
My Claw Wallet pairing code is: BZJBWD55
Please pair with it using wallet_pair tool.
```

## Risks / Trade-offs

### Risk: External API rate limits or downtime
**[Risk]** Gate.com or CoinGecko may rate-limit or go offline, causing balance display failures

**[Mitigation]**
- Two-tier fallback ensures redundancy
- Cache reduces API calls (5-min TTL)
- Graceful degradation: Show balances without USD values if prices unavailable
- Display "Price unavailable" instead of crashing

### Risk: JSON file corruption for signing history
**[Risk]** JSON file may become corrupted (incomplete write during crash), losing history

**[Mitigation]**
- Atomic writes: write to `.tmp` file, then `fs.rename()` (atomic on POSIX)
- Load with `try/catch`: if corrupted, log error and start fresh (don't block app)
- User can manually backup JSON file if paranoid

### Risk: Clipboard API permissions on Linux
**[Risk]** Some Linux desktop environments may block clipboard access without explicit permission

**[Mitigation]**
- Provide fallback: Show pairing code prominently with "Copy" button
- Test on Ubuntu/Fedora before release
- Document known issues in README

### Risk: Stale cached prices during high volatility
**[Risk]** 5-minute cache may show outdated prices during rapid market movements

**[Trade-off]**
- Accepted: This is a signing wallet, not a trading terminal
- Users can manually refresh if needed
- Alternative (real-time WebSocket) adds significant complexity for marginal benefit

### Risk: Balance fetch performance with many tokens
**[Risk]** Fetching balances for 10+ tokens across 2 chains may be slow (RPC latency)

**[Mitigation]**
- Parallel RPC calls using `Promise.all()`
- Only query tokens in `config.signing.tokenWhitelist` (typically 3-5 tokens)
- Display loading spinners to set expectations

## Open Questions

_None - all design decisions finalized._
