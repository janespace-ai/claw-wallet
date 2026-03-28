/**
 * Balance Service - Fetch token balances from blockchain
 * 
 * Queries ETH and ERC20 token balances across configured chains
 * using viem RPC clients.
 */

import { createPublicClient, http, formatEther, formatUnits, type PublicClient, type Address } from "viem";
import { mainnet, base } from "viem/chains";
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
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// Known token addresses on Ethereum mainnet
const KNOWN_TOKENS_ETHEREUM: Record<string, Address> = {
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

// Known token addresses on Base
const KNOWN_TOKENS_BASE: Record<string, Address> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const CHAIN_CONFIGS: Record<string, { chain: typeof mainnet | typeof base; tokens: Record<string, Address> }> = {
  ethereum: { chain: mainnet, tokens: KNOWN_TOKENS_ETHEREUM },
  base: { chain: base, tokens: KNOWN_TOKENS_BASE },
};

export class BalanceService {
  private clients: Map<string, PublicClient> = new Map();
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
    const ethBalance = await this.getETHBalance(address as Address, chainName);
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
      this.getERC20Balance(address as Address, tokenAddress, chainName, symbol).catch((err) => {
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
  private async getETHBalance(address: Address, chainName: string): Promise<TokenBalance | null> {
    try {
      const client = this.getClient(chainName);
      const balance = await client.getBalance({ address });
      
      return {
        token: "ETH",
        symbol: "ETH",
        amount: formatEther(balance),
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
    walletAddress: Address,
    tokenAddress: Address,
    chainName: string,
    tokenSymbol: string
  ): Promise<TokenBalance | null> {
    try {
      const client = this.getClient(chainName);

      const [balance, decimals, symbol] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress],
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
      ]);

      return {
        token: tokenSymbol.toUpperCase(),
        symbol: symbol || tokenSymbol.toUpperCase(),
        amount: formatUnits(balance, decimals),
        rawAmount: balance.toString(),
        chain: chainName,
        decimals,
      };
    } catch (err) {
      console.error(`[BalanceService] getERC20Balance failed for ${tokenSymbol} on ${chainName}:`, err);
      return null;
    }
  }

  /**
   * Get or create a viem PublicClient for a chain
   */
  private getClient(chainName: string): PublicClient {
    let client = this.clients.get(chainName);
    if (client) return client;

    const chainConfig = CHAIN_CONFIGS[chainName];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }

    const userChainConfig = this.chainsConfig[chainName];
    const rpcUrl = userChainConfig?.rpcUrl;

    client = createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpcUrl, {
        timeout: 30_000,
      }),
    }) as PublicClient;

    this.clients.set(chainName, client);
    return client;
  }
}
