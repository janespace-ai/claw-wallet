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
    description: "Query ETH or ERC-20 token balance. Specify token (ETH, USDC, USDT) and chain (base, ethereum). If chain is omitted, checks all supported chains. Always check balance before calling wallet_send.",
    parameters: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "Token symbol (e.g., ETH, USDC, USDT) or contract address. Defaults to ETH.",
        },
        chain: {
          type: "string",
          description: "Chain to query (base, ethereum). If omitted, queries all supported chains.",
        },
      },
    },
    execute: async (args) => {
      const address = getAddress();
      if (!address) return { error: "Wallet not paired. Ask the user to open Claw Wallet desktop app → Pairing tab → generate a code, then call wallet_pair with that code." };

      const token = (args.token as string) || "ETH";
      const specifiedChain = args.chain as SupportedChain | undefined;

      // If chain is specified, query single chain (original behavior)
      if (specifiedChain) {
        if (token.toUpperCase() === "ETH") {
          const { formatted } = await chainAdapter.getBalance(address, specifiedChain);
          return { balance: formatted, token: "ETH", chain: specifiedChain };
        }

        let tokenAddress: Address;
        if (token.startsWith("0x") && token.length === 42) {
          tokenAddress = token as Address;
        } else {
          const known = KNOWN_TOKENS[specifiedChain]?.[token.toUpperCase()];
          if (!known) return { error: `Unknown token "${token}" on ${specifiedChain}` };
          tokenAddress = known;
        }

        const info = await chainAdapter.getTokenBalance(address, tokenAddress, specifiedChain);
        return { balance: info.formatted, token: info.symbol, chain: specifiedChain };
      }

      // Multi-chain query: query all supported chains
      const supportedChains: SupportedChain[] = ["base", "ethereum"];
      const results: Array<{ chain: string; balance: string; token: string }> = [];
      const errors: Array<{ chain: string; error: string }> = [];

      for (const chain of supportedChains) {
        try {
          if (token.toUpperCase() === "ETH") {
            const { formatted } = await chainAdapter.getBalance(address, chain);
            if (parseFloat(formatted) > 0) {
              results.push({ chain, balance: formatted, token: "ETH" });
            }
          } else {
            let tokenAddress: Address | undefined;
            if (token.startsWith("0x") && token.length === 42) {
              tokenAddress = token as Address;
            } else {
              tokenAddress = KNOWN_TOKENS[chain]?.[token.toUpperCase()];
            }

            if (tokenAddress) {
              const info = await chainAdapter.getTokenBalance(address, tokenAddress, chain);
              if (parseFloat(info.formatted) > 0) {
                results.push({ chain, balance: info.formatted, token: info.symbol });
              }
            }
          }
        } catch (err) {
          errors.push({ chain, error: (err as Error).message });
        }
      }

      if (results.length === 0 && errors.length === 0) {
        return { 
          message: `No balance found for ${token} across any supported chains`,
          chains: supportedChains 
        };
      }

      return {
        token,
        balances: results,
        ...(errors.length > 0 && { errors }),
        message: `Found ${token} balances on ${results.length} chain(s)`
      };
    },
  };
}

export function createWalletAddressTool(
  getAddress: () => Address | null
): ToolDefinition {
  return {
    name: "wallet_address",
    description: "Get the current wallet address. Also use this to check pairing state — returns an error if the wallet is not yet paired, which means the user needs to go through the pairing flow first.",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const address = getAddress();
      if (!address) return { error: "Wallet not paired. Ask the user to open Claw Wallet desktop app → Pairing tab → generate a code, then call wallet_pair with that code." };
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
    description: "Estimate the gas fee for a transaction before sending. Call this after checking balance and before calling wallet_send, so the user can see the cost upfront.",
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
