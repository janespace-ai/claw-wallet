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
    description: "Query wallet balances. If token is omitted, queries ETH + USDC + USDT across all chains in parallel — use this for a quick portfolio overview. If token is specified (ETH, USDC, USDT, or a 0x contract address), queries only that token. If chain is also specified, queries only that chain. Always check balance before calling wallet_send.",
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

      // ── Primary path: delegate to desktop balance service via relay ──
      // Desktop uses configured multi-RPC fallback endpoints, avoiding public RPC rate-limits.
      if (walletConnection && walletConnection.hasPairing()) {
        try {
          // Determine which tokens to request.
          // For a generic query, fetch all common tokens.
          // For a specific symbol, fetch just that token.
          // For a contract address, pass undefined so desktop scans all configured tokens.
          let tokensParam: string[] | undefined;
          if (!token) {
            tokensParam = ["ETH", "USDC", "USDT"];
          } else if (!token.startsWith("0x")) {
            tokensParam = [token.toUpperCase()];
          }

          const relayParams: Record<string, unknown> = { address };
          if (tokensParam) relayParams.tokens = tokensParam;

          const resp = await (walletConnection.sendToWallet("wallet_get_balances", relayParams) as Promise<{ balances: RelayTokenBalance[] }>);
          const allBalances: RelayTokenBalance[] = resp?.balances ?? [];

          // Filter to non-zero balances
          const nonZero = allBalances.filter((b) => parseFloat(b.amount) > 0);

          // If a specific chain was requested, further filter by chain name / chainId
          const filtered = specifiedChain
            ? nonZero.filter((b) =>
                b.chainName.toLowerCase().includes(specifiedChain.toLowerCase()) ||
                b.chainId === chainIdForSupportedChain(specifiedChain)
              )
            : nonZero;

          if (filtered.length === 0) {
            const tokenLabel = token ?? "any token";
            const chainLabel = specifiedChain ? ` on ${specifiedChain}` : "";
            return { message: `No balance found for ${tokenLabel}${chainLabel}` };
          }

          // Group by token symbol for a cleaner response
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
            message: `Found balances: ${filtered.map(b => `${b.amount} ${b.symbol || b.token} on ${b.chainName}`).join(", ")}`,
          };
        } catch (relayErr) {
          // Relay unavailable or timed out — fall through to direct RPC
          console.warn(`[wallet_balance] Relay query failed (${(relayErr as Error).message}), falling back to direct RPC`);
        }
      }

      // ── Fallback: direct RPC (may be rate-limited on public endpoints) ──

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

      // --- No token specified: query ETH + common ERC-20s (USDC, USDT) in parallel ---
      const COMMON_TOKENS = ["USDC", "USDT"];
      const results: Array<{ chain: string; balance: string; token: string }> = [];
      const errors: Array<{ chain: string; error: string }> = [];

      const tasks = chains.flatMap((chain) => {
        const jobs: Promise<void>[] = [];

        // ETH
        jobs.push(
          chainAdapter.getBalance(address, chain)
            .then(({ formatted }) => {
              if (parseFloat(formatted) > 0) results.push({ chain, balance: formatted, token: "ETH" });
            })
            .catch((err) => { errors.push({ chain, error: `ETH: ${(err as Error).message}` }); })
        );

        // USDC + USDT
        for (const symbol of COMMON_TOKENS) {
          const tokenAddress = KNOWN_TOKENS[chain]?.[symbol];
          if (!tokenAddress) continue;
          jobs.push(
            chainAdapter.getTokenBalance(address, tokenAddress as Address, chain)
              .then((info) => {
                if (parseFloat(info.formatted) > 0) results.push({ chain, balance: info.formatted, token: symbol });
              })
              .catch(() => { /* token not available on this chain — skip */ })
          );
        }

        return jobs;
      });

      await Promise.all(tasks);

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
