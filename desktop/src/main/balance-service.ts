/**
 * Balance Service - Fetch token balances from blockchain
 * 
 * Queries ETH and ERC20 token balances across configured chains
 * using ethers JsonRpcProvider.
 */

import { ethers } from "ethers";
import type { ChainConfig } from "./config.js";

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  rawAmount: string;
  chain: string;
  decimals: number;
}

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Known token addresses on Ethereum mainnet
const KNOWN_TOKENS_ETHEREUM: Record<string, string> = {
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

// Known token addresses on Base
const KNOWN_TOKENS_BASE: Record<string, string> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

/** When RPC returns empty data (no contract on chain / wrong network), use these instead of on-chain decimals(). */
const KNOWN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  WETH: 18,
  ETH: 18,
};

function isEmptyContractCallResult(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const o = err as { code?: string; value?: string; shortMessage?: string };
  if (o.code === "BAD_DATA") return true;
  if (o.value === "0x") return true;
  if (typeof o.shortMessage === "string" && o.shortMessage.includes("could not decode")) return true;
  return false;
}

const CHAIN_CONFIGS: Record<string, { chainId: number; tokens: Record<string, string> }> = {
  ethereum: { chainId: 1, tokens: KNOWN_TOKENS_ETHEREUM },
  base: { chainId: 8453, tokens: KNOWN_TOKENS_BASE },
};

export class BalanceService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private chainsConfig: Partial<Record<string, ChainConfig>>;

  constructor(chainsConfig?: Partial<Record<string, ChainConfig>>) {
    this.chainsConfig = chainsConfig || {};
  }

  /**
   * Get balances for all tokens across all configured chains
   */
  async getWalletBalances(address: string, tokenWhitelist?: string[]): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    const chainNames = Object.keys(CHAIN_CONFIGS);

    const balancePromises = chainNames.map((chainName) =>
      this.getBalancesForChain(address, chainName, tokenWhitelist).catch((err) => {
        console.error(`[BalanceService] Failed to fetch balances for ${chainName}:`, err);
        return [];
      })
    );

    const results = await Promise.all(balancePromises);
    for (const chainBalances of results) {
      balances.push(...chainBalances);
    }

    return balances;
  }

  /**
   * Get balances for all tokens on a specific chain
   */
  private async getBalancesForChain(address: string, chainName: string, tokenWhitelist?: string[]): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    
    // Get ETH balance
    const ethBalance = await this.getETHBalance(address, chainName);
    if (ethBalance) {
      balances.push(ethBalance);
    }

    // Get ERC20 token balances
    const chainConfig = CHAIN_CONFIGS[chainName];
    if (!chainConfig) return balances;

    const tokens = Object.entries(chainConfig.tokens);
    const filteredTokens = tokenWhitelist
      ? tokens.filter(([symbol]) => tokenWhitelist.includes(symbol.toUpperCase()))
      : tokens;

    const tokenPromises = filteredTokens.map(([symbol, tokenAddress]) =>
      this.getERC20Balance(address, tokenAddress, chainName, symbol).catch((err) => {
        console.error(`[BalanceService] Failed to fetch ${symbol} on ${chainName}:`, err);
        return null;
      })
    );

    const tokenBalances = await Promise.all(tokenPromises);
    for (const balance of tokenBalances) {
      if (balance) {
        balances.push(balance);
      }
    }

    return balances;
  }

  /**
   * Get ETH balance for an address on a specific chain
   */
  private async getETHBalance(address: string, chainName: string): Promise<TokenBalance | null> {
    try {
      const provider = this.getProvider(chainName);
      const balance = await provider.getBalance(address);
      
      return {
        token: "ETH",
        symbol: "ETH",
        amount: ethers.formatEther(balance),
        rawAmount: balance.toString(),
        chain: chainName,
        decimals: 18,
      };
    } catch (err) {
      console.error(`[BalanceService] getETHBalance failed for ${chainName}:`, err);
      return null;
    }
  }

  /**
   * Get ERC20 token balance for an address
   */
  private async getERC20Balance(
    walletAddress: string,
    tokenAddress: string,
    chainName: string,
    tokenSymbol: string
  ): Promise<TokenBalance | null> {
    const symUpper = tokenSymbol.toUpperCase();
    try {
      const provider = this.getProvider(chainName);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      let decimals: number;
      try {
        decimals = Number(await contract.decimals());
        if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
          throw new RangeError("invalid decimals from chain");
        }
      } catch (decErr) {
        const fallback = KNOWN_DECIMALS[symUpper];
        if (fallback !== undefined) {
          decimals = fallback;
        } else if (isEmptyContractCallResult(decErr)) {
          console.warn(
            `[BalanceService] Skip ${symUpper} on ${chainName}: no contract at ${tokenAddress} or RPC returned empty (check RPC URL vs chain).`,
          );
          return null;
        } else {
          console.error(`[BalanceService] getERC20Balance decimals failed for ${symUpper} on ${chainName}:`, decErr);
          return null;
        }
      }

      let symbol = symUpper;
      try {
        const s = await contract.symbol();
        if (s != null && String(s).trim() !== "") symbol = String(s);
      } catch {
        // optional
      }

      let balance: bigint;
      try {
        balance = await contract.balanceOf(walletAddress);
      } catch (balErr) {
        if (isEmptyContractCallResult(balErr)) {
          console.warn(
            `[BalanceService] Skip ${symUpper} on ${chainName}: balanceOf empty — wrong network or address.`,
          );
          return null;
        }
        throw balErr;
      }

      return {
        token: symUpper,
        symbol,
        amount: ethers.formatUnits(balance, decimals),
        rawAmount: balance.toString(),
        chain: chainName,
        decimals,
      };
    } catch (err) {
      if (isEmptyContractCallResult(err)) {
        console.warn(`[BalanceService] Skip ${symUpper} on ${chainName}: ERC20 call returned no data.`);
        return null;
      }
      console.error(`[BalanceService] getERC20Balance failed for ${symUpper} on ${chainName}:`, err);
      return null;
    }
  }

  /**
   * Get or create an ethers JsonRpcProvider for a chain
   */
  private getProvider(chainName: string): ethers.JsonRpcProvider {
    let provider = this.providers.get(chainName);
    if (provider) return provider;

    const chainConfig = CHAIN_CONFIGS[chainName];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }

    const userChainConfig = this.chainsConfig[chainName];
    const rpcUrl = userChainConfig?.rpcUrl;

    provider = new ethers.JsonRpcProvider(rpcUrl, chainConfig.chainId, {
      staticNetwork: true,
    });

    this.providers.set(chainName, provider);
    return provider;
  }
}
