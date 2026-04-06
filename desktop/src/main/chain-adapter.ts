/**
 * Chain Adapter - Blockchain RPC interactions for Desktop
 * 
 * Provides methods to query transaction receipts and other on-chain data.
 */

import { ethers } from "ethers";
import type { ChainConfig } from "./config.js";
import type { TxStatus } from "./signing-history.js";

const CHAIN_CONFIGS: Record<string, { chainId: number }> = {
  ethereum:  { chainId: 1 },
  base:      { chainId: 8453 },
  arbitrum:  { chainId: 42161 },
  optimism:  { chainId: 10 },
  polygon:   { chainId: 137 },
  linea:     { chainId: 59144 },
  bsc:       { chainId: 56 },
  sei:       { chainId: 1329 },
};

export class ChainAdapter {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private chainsConfig: Partial<Record<string, ChainConfig>>;

  constructor(chainsConfig?: Partial<Record<string, ChainConfig>>) {
    this.chainsConfig = chainsConfig || {};
  }

  /**
   * Get transaction receipt from blockchain
   */
  async getTransactionReceipt(txHash: string, chainName: string): Promise<TxStatus | null> {
    try {
      const provider = this.getProvider(chainName);
      
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return null; // Transaction not yet mined
      }

      // Get block to extract timestamp
      const block = await provider.getBlock(receipt.blockNumber);
      if (!block) {
        return null;
      }

      return {
        status: receipt.status === 1 ? "success" : "failed",
        blockNumber: receipt.blockNumber,
        blockTimestamp: block.timestamp * 1000, // Convert to ms
        gasUsed: Number(receipt.gasUsed),
      };
    } catch (err) {
      // Transaction not found or RPC error
      console.error(`[ChainAdapter] Failed to get receipt for ${txHash}:`, err);
      return null;
    }
  }

  /**
   * Get or create ethers JsonRpcProvider for a chain
   */
  private getProvider(chainName: string): ethers.JsonRpcProvider {
    let provider = this.providers.get(chainName);
    if (provider) return provider;

    const chainConfig = CHAIN_CONFIGS[chainName as keyof typeof CHAIN_CONFIGS];
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
