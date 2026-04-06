import type { Address } from "viem";
import { ChainAdapter } from "../chain.js";
import type { ToolDefinition, SupportedChain } from "../types.js";
import { KNOWN_TOKENS } from "../types.js";
import type { WalletConnection } from "../wallet-connection.js";

/** Shape returned by desktop balance-service via wallet_get_balances relay. */
interface RelayTokenBalance {
  token: string;
  symbol: string;
  amount: string;
  rawAmount: string;
  chainId: number;
  chainName: string;
  decimals: number;
}

export function createWalletBalanceTool(
  chainAdapter: ChainAdapter,
  getAddress: () => Address | null,
  defaultChain: SupportedChain,
  walletConnection?: WalletConnection | null
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

      const token = (args.token as string) || undefined;
      const specifiedChain = args.chain as SupportedChain | undefined;

      // ── Primary path: delegate to desktop balance service via relay ──
      // Desktop uses configured multi-RPC fallback endpoints, avoiding public RPC rate-limits.
      if (walletConnection && walletConnection.hasPairing()) {
        try {
          // Determine which tokens to request. For a generic query or ETH, fetch all common tokens.
          // For a specific token, fetch just that token.
          let tokensParam: string[] | undefined;
          if (!token) {
            tokensParam = ["ETH", "USDC", "USDT"];
          } else if (!token.startsWith("0x")) {
            tokensParam = [token.toUpperCase()];
          }
          // Contract-address tokens: desktop won't know the symbol, pass undefined so it scans all configured tokens

          const relayParams: Record<string, unknown> = { address };
          if (tokensParam) relayParams.tokens = tokensParam;

          const resp = await (walletConnection.sendToWallet("wallet_get_balances", relayParams) as Promise<{ balances: RelayTokenBalance[] }>);
          const allBalances: RelayTokenBalance[] = resp?.balances ?? [];

          // Filter to non-zero balances
          const nonZero = allBalances.filter((b) => parseFloat(b.amount) > 0);

          // If a specific chain was requested, further filter by chain name
          const filtered = specifiedChain
            ? nonZero.filter((b) => b.chainName.toLowerCase().includes(specifiedChain.toLowerCase()) || b.chainId === chainIdForSupportedChain(specifiedChain))
            : nonZero;

          if (filtered.length === 0) {
            const tokenLabel = token ?? "any token";
            const chainLabel = specifiedChain ? ` on ${specifiedChain}` : "";
            return { message: `No balance found for ${tokenLabel}${chainLabel}` };
          }

          // Format result grouped by token symbol
          const grouped: Record<string, Array<{ chain: string; balance: string }>> = {};
          for (const b of filtered) {
            const sym = b.symbol || b.token;
            if (!grouped[sym]) grouped[sym] = [];
            grouped[sym].push({ chain: b.chainName, balance: b.amount });
          }

          const summary = Object.entries(grouped).map(([sym, entries]) => ({
            token: sym,
            balances: entries,
          }));

          return {
            balances: summary,
            message: `Found balances across ${filtered.length} chain/token combination(s)`,
          };
        } catch (relayErr) {
          // Relay unavailable or timed out — fall through to direct RPC
          console.warn(`[wallet_balance] Relay query failed (${(relayErr as Error).message}), falling back to direct RPC`);
        }
      }

      // ── Fallback: direct RPC (may be rate-limited on public endpoints) ──
      const tokenStr = token ?? "ETH";

      if (specifiedChain) {
        if (tokenStr.toUpperCase() === "ETH") {
          const { formatted } = await chainAdapter.getBalance(address, specifiedChain);
          return { balance: formatted, token: "ETH", chain: specifiedChain };
        }

        let tokenAddress: Address;
        if (tokenStr.startsWith("0x") && tokenStr.length === 42) {
          tokenAddress = tokenStr as Address;
        } else {
          const known = KNOWN_TOKENS[specifiedChain]?.[tokenStr.toUpperCase()];
          if (!known) return { error: `Unknown token "${tokenStr}" on ${specifiedChain}` };
          tokenAddress = known;
        }

        const info = await chainAdapter.getTokenBalance(address, tokenAddress, specifiedChain);
        return { balance: info.formatted, token: info.symbol, chain: specifiedChain };
      }

      // Multi-chain direct RPC query
      const supportedChains: SupportedChain[] = ["base", "ethereum", "arbitrum", "optimism", "polygon", "linea", "bsc", "sei"];
      const results: Array<{ chain: string; balance: string; token: string }> = [];
      const errors: Array<{ chain: string; error: string }> = [];

      await Promise.all(
        supportedChains.map(async (chain) => {
          try {
            if (tokenStr.toUpperCase() === "ETH") {
              const { formatted } = await chainAdapter.getBalance(address, chain);
              if (parseFloat(formatted) > 0) {
                results.push({ chain, balance: formatted, token: "ETH" });
              }
            } else {
              let tokenAddress: Address | undefined;
              if (tokenStr.startsWith("0x") && tokenStr.length === 42) {
                tokenAddress = tokenStr as Address;
              } else {
                tokenAddress = KNOWN_TOKENS[chain]?.[tokenStr.toUpperCase()];
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
        })
      );

      if (results.length === 0 && errors.length === 0) {
        return {
          message: `No balance found for ${tokenStr} across any supported chains`,
          chains: supportedChains,
        };
      }

      if (results.length === 0 && errors.length > 0) {
        return {
          error: `Failed to query ${tokenStr} on all chains. RPC errors: ${errors.map((e) => `${e.chain}: ${e.error}`).join("; ")}`,
          suggestion: "The wallet may not be reachable via public RPC. Ensure the desktop wallet is paired and try again.",
        };
      }

      return {
        token: tokenStr,
        balances: results,
        ...(errors.length > 0 && { errors }),
        message: `Found ${tokenStr} balances on ${results.length} chain(s)`,
      };
    },
  };
}

/** Map a SupportedChain name to its EVM chain ID for relay response filtering. */
function chainIdForSupportedChain(chain: SupportedChain): number | undefined {
  const map: Partial<Record<SupportedChain, number>> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    optimism: 10,
    polygon: 137,
    linea: 59144,
    bsc: 56,
    sei: 1329,
  };
  return map[chain];
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
