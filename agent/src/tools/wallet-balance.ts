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
    description: "Query wallet balances. If token is omitted, queries ETH + all known ERC-20 tokens (USDC, USDT) across all chains in one call — use this for a full portfolio overview. If token is specified (ETH, USDC, USDT, or a 0x contract address), queries only that token. If chain is also specified, queries only that chain. Always check balance before calling wallet_send.",
    parameters: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "Token symbol (ETH, USDC, USDT) or 0x contract address. If omitted, queries ETH + USDC + USDT across all chains.",
        },
        chain: {
          type: "string",
          description: "Chain to query: ethereum, base, arbitrum, optimism, polygon, linea, bsc, sei. If omitted, queries all supported chains.",
        },
      },
    },
    execute: async (args) => {
      const address = getAddress();
      if (!address) return { error: "Wallet not paired. Ask the user to open Claw Wallet desktop app → Pairing tab → generate a code, then call wallet_pair with that code." };

      const token = args.token as string | undefined;
      const specifiedChain = args.chain as SupportedChain | undefined;
      const supportedChains: SupportedChain[] = ["ethereum", "base", "arbitrum", "optimism", "polygon", "linea", "bsc", "sei"];
      const chains = specifiedChain ? [specifiedChain] : supportedChains;

      // --- Single known token (or contract address) across one or all chains ---
      if (token) {
        const tokenKey = token.toUpperCase();
        const results: Array<{ chain: string; balance: string; token: string }> = [];
        const errors: Array<{ chain: string; error: string }> = [];

        for (const chain of chains) {
          try {
            if (tokenKey === "ETH") {
              const { formatted } = await chainAdapter.getBalance(address, chain);
              if (parseFloat(formatted) > 0 || specifiedChain) {
                results.push({ chain, balance: formatted, token: "ETH" });
              }
            } else {
              let tokenAddress: Address | undefined;
              if (token.startsWith("0x") && token.length === 42) {
                tokenAddress = token as Address;
              } else {
                tokenAddress = KNOWN_TOKENS[chain]?.[tokenKey];
              }
              if (!tokenAddress) {
                if (specifiedChain) return { error: `Unknown token "${token}" on ${chain}` };
                continue; // token not available on this chain, skip silently
              }
              const info = await chainAdapter.getTokenBalance(address, tokenAddress, chain);
              if (parseFloat(info.formatted) > 0 || specifiedChain) {
                results.push({ chain, balance: info.formatted, token: info.symbol });
              }
            }
          } catch (err) {
            errors.push({ chain, error: (err as Error).message });
          }
        }

        if (results.length === 0 && errors.length === 0) {
          return { message: `No ${token} balance found across queried chains`, chains };
        }
        return { token, balances: results, ...(errors.length > 0 && { errors }) };
      }

      // --- No token specified: query ETH + all known ERC-20s for a full overview ---
      const results: Array<{ chain: string; balance: string; token: string }> = [];
      const errors: Array<{ chain: string; error: string }> = [];

      for (const chain of chains) {
        try {
          // ETH
          const { formatted: ethBal } = await chainAdapter.getBalance(address, chain);
          if (parseFloat(ethBal) > 0) {
            results.push({ chain, balance: ethBal, token: "ETH" });
          }
          // All known ERC-20s for this chain (USDC, USDT, …)
          const chainTokens = KNOWN_TOKENS[chain] ?? {};
          for (const [symbol, tokenAddress] of Object.entries(chainTokens)) {
            try {
              const info = await chainAdapter.getTokenBalance(address, tokenAddress as Address, chain);
              if (parseFloat(info.formatted) > 0) {
                results.push({ chain, balance: info.formatted, token: symbol });
              }
            } catch {
              // individual token failure — skip silently
            }
          }
        } catch (err) {
          errors.push({ chain, error: (err as Error).message });
        }
      }

      if (results.length === 0 && errors.length === 0) {
        return { message: "No non-zero balances found across all chains and tokens", chains };
      }
      return {
        balances: results,
        ...(errors.length > 0 && { errors }),
        message: `Found balances: ${results.map(r => `${r.balance} ${r.token} on ${r.chain}`).join(", ")}`,
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
