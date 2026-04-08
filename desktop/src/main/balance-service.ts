/**
 * Balance Service - Fetch token balances from blockchain
 * 
 * Queries ETH and ERC20 token balances across configured networks
 * using RPCProviderManager for automatic failover and health monitoring.
 */

import { ethers } from "ethers";
import type { ChainConfig } from "./config.js";
import { NetworkConfigService } from "./network-config-service.js";
import { RPCProviderManager } from "./rpc-provider-manager.js";
import type { AssetCacheService, CachedAssetEntry } from "./asset-cache-service.js";

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  rawAmount: string;
  chainId: number;
  chainName: string;
  decimals: number;
}

export interface AggregatedBalance {
  symbol: string;
  totalAmount: string;
  networks: Array<{
    chainId: number;
    chainName: string;
    amount: string;
    rawAmount: string;
  }>;
}

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

function isEmptyContractCallResult(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const o = err as { code?: string; value?: string; shortMessage?: string };
  if (o.code === "BAD_DATA") return true;
  if (o.value === "0x") return true;
  if (typeof o.shortMessage === "string" && o.shortMessage.includes("could not decode")) return true;
  return false;
}

export class BalanceService {
  private networkConfig: NetworkConfigService;
  private rpcManager: RPCProviderManager;
  private assetCache?: AssetCacheService;
  private balanceCache: Map<string, { balances: TokenBalance[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 10000; // 10 seconds

  constructor(
    networkConfig: NetworkConfigService,
    rpcManager: RPCProviderManager,
    assetCache?: AssetCacheService,
  ) {
    this.networkConfig = networkConfig;
    this.rpcManager = rpcManager;
    this.assetCache = assetCache;
  }

  /**
   * Get balances for all tokens across all configured networks
   */
  async getWalletBalances(address: string, tokenWhitelist?: string[], useCache: boolean = true): Promise<TokenBalance[]> {
    const cacheKey = `${address}-all`;
    
    if (useCache) {
      const cached = this.balanceCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
        console.log('[BalanceService] Returning cached balances');
        return cached.balances;
      }
    }

    const balances: TokenBalance[] = [];
    const supportedChainIds = this.networkConfig.getSupportedChainIds();

    const balancePromises = supportedChainIds.map((chainId) =>
      this.getBalancesForNetwork(address, chainId, tokenWhitelist).catch((err) => {
        const network = this.networkConfig.getNetwork(chainId);
        console.error(`[BalanceService] Failed to fetch balances for ${network?.name || chainId}: ${(err as Error).message ?? err}`);
        return [];
      })
    );

    const results = await Promise.all(balancePromises);
    for (const networkBalances of results) {
      balances.push(...networkBalances);
    }

    this.balanceCache.set(cacheKey, { balances, timestamp: Date.now() });

    return balances;
  }

  /**
   * Write balances + prices to the persistent SQLite cache.
   * Called by the IPC layer after fetching prices so each entry carries its USD value.
   */
  persistToCache(address: string, balances: TokenBalance[], prices: Record<string, number>): void {
    if (!this.assetCache || balances.length === 0) return;
    const now = Date.now();
    const entries: CachedAssetEntry[] = balances.map((b) => ({
      symbol: b.symbol,
      token: b.token,
      chain_id: b.chainId,
      chain_name: b.chainName,
      decimals: b.decimals,
      amount: b.amount,
      raw_amount: b.rawAmount,
      price_usd: prices[b.symbol] ?? 0,
      updated_at: now,
    }));
    try {
      this.assetCache.upsertMany(address, entries);
    } catch (err) {
      console.error("[BalanceService] Failed to persist cache:", err);
    }
  }

  /**
   * Get balances for specific network
   */
  async getBalancesForNetwork(address: string, chainId: number, tokenWhitelist?: string[]): Promise<TokenBalance[]> {
    const cacheKey = `${address}-${chainId}`;
    
    const cached = this.balanceCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
      return cached.balances;
    }

    const balances: TokenBalance[] = [];
    const network = this.networkConfig.getNetwork(chainId);
    
    if (!network) {
      console.warn(`[BalanceService] Network ${chainId} not configured`);
      return balances;
    }

    // Get native currency balance (ETH, MATIC, etc.)
    const nativeBalance = await this.getNativeBalance(address, chainId);
    if (nativeBalance) {
      balances.push(nativeBalance);
    }

    // Get ERC20 token balances
    const allTokens = this.networkConfig.getAllTokens();
    const filteredTokens = tokenWhitelist
      ? allTokens.filter(token => tokenWhitelist.includes(token.symbol.toUpperCase()))
      : allTokens;

    const tokenPromises = filteredTokens
      .filter(token => token.contracts[chainId.toString()])
      .map(token => 
        this.getERC20Balance(
          address, 
          token.contracts[chainId.toString()], 
          chainId,
          token.symbol,
          token.decimals
        ).catch((err) => {
          console.error(`[BalanceService] Failed to fetch ${token.symbol} on ${network.name}: ${(err as Error).message ?? err}`);
          return null;
        })
      );

    const tokenBalances = await Promise.all(tokenPromises);
    for (const balance of tokenBalances) {
      if (balance && parseFloat(balance.amount) > 0) {
        balances.push(balance);
      }
    }

    this.balanceCache.set(cacheKey, { balances, timestamp: Date.now() });

    return balances;
  }

  /**
   * Aggregate balances across networks by token symbol
   */
  aggregateBalances(balances: TokenBalance[]): AggregatedBalance[] {
    const aggregated: Map<string, AggregatedBalance> = new Map();

    for (const balance of balances) {
      const existing = aggregated.get(balance.symbol);
      
      if (existing) {
        const totalBigInt = BigInt(existing.networks.reduce((sum, n) => sum + BigInt(n.rawAmount), BigInt(0))) + BigInt(balance.rawAmount);
        existing.totalAmount = ethers.formatUnits(totalBigInt, balance.decimals);
        existing.networks.push({
          chainId: balance.chainId,
          chainName: balance.chainName,
          amount: balance.amount,
          rawAmount: balance.rawAmount
        });
      } else {
        aggregated.set(balance.symbol, {
          symbol: balance.symbol,
          totalAmount: balance.amount,
          networks: [{
            chainId: balance.chainId,
            chainName: balance.chainName,
            amount: balance.amount,
            rawAmount: balance.rawAmount
          }]
        });
      }
    }

    return Array.from(aggregated.values());
  }

  /**
   * Get native currency balance (ETH, MATIC, etc.)
   */
  private async getNativeBalance(address: string, chainId: number): Promise<TokenBalance | null> {
    try {
      const provider = await this.rpcManager.getProvider(chainId);
      const network = this.networkConfig.getNetwork(chainId);
      
      if (!network) return null;

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Balance query timeout')), 5000)
      );

      const balance = await Promise.race([
        provider.getBalance(address),
        timeoutPromise
      ]);
      
      return {
        token: network.nativeCurrency.symbol,
        symbol: network.nativeCurrency.symbol,
        amount: ethers.formatUnits(balance, network.nativeCurrency.decimals),
        rawAmount: balance.toString(),
        chainId,
        chainName: network.name,
        decimals: network.nativeCurrency.decimals,
      };
    } catch (err) {
      const network = this.networkConfig.getNetwork(chainId);
      console.error(`[BalanceService] getNativeBalance failed for ${network?.name || chainId}: ${(err as Error).message ?? err}`);
      return null;
    }
  }

  /**
   * Get ERC20 token balance
   */
  private async getERC20Balance(
    walletAddress: string,
    tokenAddress: string,
    chainId: number,
    tokenSymbol: string,
    knownDecimals: number
  ): Promise<TokenBalance | null> {
    const network = this.networkConfig.getNetwork(chainId);
    if (!network) return null;

    try {
      const provider = await this.rpcManager.getProvider(chainId);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Token query timeout')), 5000)
      );

      let decimals = knownDecimals;
      try {
        const decResult = await Promise.race([contract.decimals(), timeoutPromise]);
        decimals = Number(decResult);
        if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
          decimals = knownDecimals;
        }
      } catch (decErr) {
        if (!isEmptyContractCallResult(decErr)) {
          console.warn(`[BalanceService] Using known decimals for ${tokenSymbol} on ${network.name}`);
        }
      }

      let symbol = tokenSymbol.toUpperCase();
      try {
        const symResult = await Promise.race([contract.symbol(), timeoutPromise]);
        if (symResult != null && String(symResult).trim() !== "") {
          symbol = String(symResult);
        }
      } catch {
        // Use provided symbol
      }

      let balance: bigint;
      try {
        balance = await Promise.race([contract.balanceOf(walletAddress), timeoutPromise]);
      } catch (balErr) {
        if (isEmptyContractCallResult(balErr)) {
          console.warn(`[BalanceService] Skip ${tokenSymbol} on ${network.name}: balanceOf empty`);
          return null;
        }
        throw balErr;
      }

      return {
        token: tokenSymbol.toUpperCase(),
        symbol,
        amount: ethers.formatUnits(balance, decimals),
        rawAmount: balance.toString(),
        chainId,
        chainName: network.name,
        decimals,
      };
    } catch (err) {
      if (isEmptyContractCallResult(err)) {
        return null;
      }
      console.error(`[BalanceService] getERC20Balance failed for ${tokenSymbol} on ${network.name}: ${(err as Error).message ?? err}`);
      return null;
    }
  }

  /**
   * Return cached balances if available (ignoring TTL), otherwise fetch from chain.
   * Priority: in-memory map → SQLite persistent cache → on-chain fetch.
   * Used by relay queries so the agent sees the same data shown in the UI.
   */
  async getCachedOrFetchBalances(address: string, tokenWhitelist?: string[]): Promise<TokenBalance[]> {
    const cacheKey = `${address}-all`;
    const cached = this.balanceCache.get(cacheKey);
    if (cached && cached.balances.length > 0) {
      console.log('[BalanceService] Relay query: returning in-memory cached balances (age: ' + Math.round((Date.now() - cached.timestamp) / 1000) + 's)');
      return cached.balances;
    }

    // Try SQLite persistent cache before hitting the chain
    if (this.assetCache) {
      const persistent = this.assetCache.getByAddress(address);
      if (persistent.length > 0) {
        console.log(`[BalanceService] Relay query: returning ${persistent.length} SQLite-cached entries`);
        return persistent.map((e) => ({
          token: e.token,
          symbol: e.symbol,
          amount: e.amount,
          rawAmount: e.raw_amount,
          chainId: e.chain_id,
          chainName: e.chain_name,
          decimals: e.decimals,
        }));
      }
    }

    // No cache at all — fresh fetch
    return this.getWalletBalances(address, tokenWhitelist, false);
  }

  /**
   * Clear in-memory balance cache (does NOT wipe SQLite — use clearCacheForAddress for that).
   */
  clearCache(): void {
    this.balanceCache.clear();
    console.log('[BalanceService] In-memory cache cleared');
  }

  /**
   * Clear in-memory and SQLite cache for a specific address.
   */
  clearCacheForAddress(address: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.balanceCache.keys()) {
      if (key.startsWith(address)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.balanceCache.delete(key);
    }
    try {
      this.assetCache?.clearByAddress(address);
    } catch (err) {
      console.error("[BalanceService] Failed to clear SQLite cache:", err);
    }
  }
}
