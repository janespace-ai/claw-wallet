/**
 * Chain Adapter - Blockchain RPC interactions for Desktop
 * 
 * Provides methods to query transaction receipts and other on-chain data.
 */

import { ethers } from "ethers";
import type { TxStatus } from "./signing-history.js";
import type { NetworkConfigService } from "./network-config-service.js";

export class ChainAdapter {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private networkConfig: NetworkConfigService;

  constructor(networkConfig: NetworkConfigService) {
    this.networkConfig = networkConfig;
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

    // Resolve chain by name — look up chainId from NetworkConfigService
    const chainIds = this.networkConfig.getSupportedChainIds();
    let chainId: number | undefined;
    for (const id of chainIds) {
      const network = this.networkConfig.getNetwork(id);
      if (network && network.name.toLowerCase().replace(/\s+/g, "") === chainName.toLowerCase().replace(/\s+/g, "")) {
        chainId = id;
        break;
      }
    }
    // Fallback: match by common short name (e.g. "arbitrum" → "Arbitrum One")
    if (!chainId) {
      for (const id of chainIds) {
        const network = this.networkConfig.getNetwork(id);
        if (network && network.name.toLowerCase().includes(chainName.toLowerCase())) {
          chainId = id;
          break;
        }
      }
    }
    if (!chainId) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }

    // Use the first (highest-priority) RPC from NetworkConfigService
    const rpcs = this.networkConfig.getRPCProviders(chainId);
    const rpcUrl = rpcs[0]?.url;

    provider = new ethers.JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
    this.providers.set(chainName, provider);
    return provider;
  }
}
