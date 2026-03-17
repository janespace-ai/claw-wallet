import type { Address } from "viem";
import { ChainAdapter } from "../chain.js";
import type { ToolDefinition, SupportedChain } from "../types.js";
import { KNOWN_TOKENS } from "../types.js";

export function createWalletBalanceTool(
  chainAdapter: ChainAdapter,
  getAddress: () => Address | null,
  defaultChain: SupportedChain
): ToolDefinition {
  return {
    name: "wallet_balance",
    description: "Query the current balance of ETH and/or ERC-20 tokens in the wallet. Can specify a token symbol (e.g., USDC) and chain (e.g., base, ethereum).",
    parameters: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "Token symbol (e.g., ETH, USDC, USDT) or contract address. Defaults to ETH.",
        },
        chain: {
          type: "string",
          description: "Chain to query (base, ethereum). Defaults to the configured default chain.",
        },
      },
    },
    execute: async (args) => {
      const address = getAddress();
      if (!address) return { error: "No wallet configured. Use wallet_create or wallet_import first." };

      const chain = (args.chain as SupportedChain) || defaultChain;
      const token = (args.token as string) || "ETH";

      if (token.toUpperCase() === "ETH") {
        const { formatted } = await chainAdapter.getBalance(address, chain);
        return { balance: formatted, token: "ETH", chain };
      }

      let tokenAddress: Address;
      if (token.startsWith("0x") && token.length === 42) {
        tokenAddress = token as Address;
      } else {
        const known = KNOWN_TOKENS[chain]?.[token.toUpperCase()];
        if (!known) return { error: `Unknown token "${token}" on ${chain}` };
        tokenAddress = known;
      }

      const info = await chainAdapter.getTokenBalance(address, tokenAddress, chain);
      return { balance: info.formatted, token: info.symbol, chain };
    },
  };
}

export function createWalletAddressTool(
  getAddress: () => Address | null
): ToolDefinition {
  return {
    name: "wallet_address",
    description: "Get the current wallet address.",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const address = getAddress();
      if (!address) return { error: "No wallet configured. Use wallet_create or wallet_import first." };
      return { address };
    },
  };
}

export function createWalletEstimateGasTool(
  chainAdapter: ChainAdapter,
  defaultChain: SupportedChain
): ToolDefinition {
  return {
    name: "wallet_estimate_gas",
    description: "Estimate gas cost for a transaction.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address" },
        amount: { type: "string", description: "Amount to send" },
        chain: { type: "string", description: "Chain (base, ethereum)" },
      },
      required: ["to", "amount"],
    },
    execute: async (args) => {
      const chain = (args.chain as SupportedChain) || defaultChain;
      const { parseEther } = await import("viem");
      const estimate = await chainAdapter.estimateGas(
        { to: args.to as Address, value: parseEther(args.amount as string) },
        chain
      );
      return {
        estimatedGas: estimate.gas.toString(),
        gasCostEth: estimate.totalCostFormatted,
        chain,
      };
    },
  };
}
