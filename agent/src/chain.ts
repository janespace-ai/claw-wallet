import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type PublicClient,
  type Address,
  type Hex,
  type TransactionReceipt,
  type Chain,
} from "viem";
import { base, mainnet } from "viem/chains";
import type { SupportedChain, ChainConfig, TransactionRequest } from "./types.js";

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
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const DEFAULT_CHAINS: Record<SupportedChain, Chain> = {
  base: base,
  ethereum: mainnet,
};

export class ChainAdapter {
  private clients: Map<SupportedChain, PublicClient> = new Map();
  private chainConfigs: Map<SupportedChain, ChainConfig> = new Map();

  constructor(configs?: Partial<Record<SupportedChain, ChainConfig>>) {
    const defaultEntries: [SupportedChain, ChainConfig][] = [
      ["base", { chain: base }],
      ["ethereum", { chain: mainnet }],
    ];

    for (const [name, defaultConfig] of defaultEntries) {
      const userConfig = configs?.[name];
      const config: ChainConfig = {
        chain: userConfig?.chain ?? defaultConfig.chain,
        rpcUrl: userConfig?.rpcUrl,
      };
      this.chainConfigs.set(name, config);
    }
  }

  getClient(chainName: SupportedChain): PublicClient {
    let client = this.clients.get(chainName);
    if (client) return client;

    const config = this.chainConfigs.get(chainName);
    if (!config) throw new Error(`Unsupported chain: ${chainName}`);

    client = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    this.clients.set(chainName, client);
    return client;
  }

  async getBalance(address: Address, chainName: SupportedChain): Promise<{ wei: bigint; formatted: string }> {
    const client = this.getClient(chainName);
    let wei = await client.getBalance({ address });
    if (wei < 0n) wei = 0n;
    return { wei, formatted: formatEther(wei) };
  }

  async getTokenBalance(
    walletAddress: Address,
    tokenAddress: Address,
    chainName: SupportedChain
  ): Promise<{ raw: bigint; formatted: string; decimals: number; symbol: string }> {
    const client = this.getClient(chainName);

    const [raw, decimals, symbol] = await Promise.all([
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
      raw,
      formatted: formatUnits(raw, decimals),
      decimals,
      symbol,
    };
  }

  async estimateGas(
    tx: TransactionRequest,
    chainName: SupportedChain
  ): Promise<{ gas: bigint; gasPrice: bigint; totalCostWei: bigint; totalCostFormatted: string }> {
    const client = this.getClient(chainName);

    const [gas, gasPrice] = await Promise.all([
      client.estimateGas({
        to: tx.to,
        value: tx.value,
        data: tx.data,
      }),
      client.getGasPrice(),
    ]);

    if (gas === 0n) throw new Error("Invalid gas estimate: 0");
    const GAS_LIMIT_MAX = 30_000_000n;
    if (gas > GAS_LIMIT_MAX) throw new Error(`Gas estimate ${gas} exceeds maximum ${GAS_LIMIT_MAX}`);

    const totalCostWei = gas * gasPrice;
    return {
      gas,
      gasPrice,
      totalCostWei,
      totalCostFormatted: formatEther(totalCostWei),
    };
  }

  async broadcastTransaction(
    signedTx: Hex,
    chainName: SupportedChain
  ): Promise<TransactionReceipt> {
    const client = this.getClient(chainName);
    const hash = await client.sendRawTransaction({ serializedTransaction: signedTx });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return receipt;
  }

  buildERC20TransferData(to: Address, amount: bigint): Hex {
    const functionSelector = "0xa9059cbb";
    const paddedTo = to.slice(2).toLowerCase().padStart(64, "0");
    const paddedAmount = amount.toString(16).padStart(64, "0");
    return `${functionSelector}${paddedTo}${paddedAmount}` as Hex;
  }

  getChain(chainName: SupportedChain): Chain {
    const config = this.chainConfigs.get(chainName);
    if (!config) throw new Error(`Unsupported chain: ${chainName}`);
    return config.chain;
  }

  getSupportedChains(): SupportedChain[] {
    return Array.from(this.chainConfigs.keys());
  }
}

export { ERC20_ABI, parseEther, parseUnits, formatEther, formatUnits };
