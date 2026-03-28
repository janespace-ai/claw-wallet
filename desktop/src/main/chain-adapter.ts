/**
 * Chain Adapter - Blockchain RPC interactions for Desktop
 * 
 * Provides methods to query transaction receipts and other on-chain data.
 */

import { createPublicClient, http, type PublicClient, type Address } from "viem";
import { mainnet, base } from "viem/chains";
import type { ChainConfig } from "./config.js";
import type { TxStatus } from "./signing-history.js";

const CHAIN_CONFIGS = {
  ethereum: mainnet,
  base: base,
};

export class ChainAdapter {
  private clients: Map<string, PublicClient> = new Map();
  private chainsConfig: Partial<Record<string, ChainConfig>>;

  constructor(chainsConfig?: Partial<Record<string, ChainConfig>>) {
    this.chainsConfig = chainsConfig || {};
  }

  /**
   * Get transaction receipt from blockchain
   */
  async getTransactionReceipt(txHash: string, chainName: string): Promise<TxStatus | null> {
    try {
      const client = this.getClient(chainName);
      
      const receipt = await client.getTransactionReceipt({
        hash: txHash as Address,
      });

      if (!receipt) {
        return null; // Transaction not yet mined
      }

      // Get block to extract timestamp
      const block = await client.getBlock({
        blockNumber: receipt.blockNumber,
      });

      return {
        status: receipt.status === "success" ? "success" : "failed",
        blockNumber: Number(receipt.blockNumber),
        blockTimestamp: Number(block.timestamp) * 1000, // Convert to ms
        gasUsed: Number(receipt.gasUsed),
      };
    } catch (err) {
      // Transaction not found or RPC error
      console.error(`[ChainAdapter] Failed to get receipt for ${txHash}:`, err);
      return null;
    }
  }

  /**
   * Get or create viem PublicClient for a chain
   */
  private getClient(chainName: string): PublicClient {
    let client = this.clients.get(chainName);
    if (client) return client;

    const chainConfig = CHAIN_CONFIGS[chainName as keyof typeof CHAIN_CONFIGS];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }

    const userChainConfig = this.chainsConfig[chainName];
    const rpcUrl = userChainConfig?.rpcUrl;

    client = createPublicClient({
      chain: chainConfig,
      transport: http(rpcUrl, {
        timeout: 30_000,
      }),
    }) as PublicClient;

    this.clients.set(chainName, client);
    return client;
  }
}
