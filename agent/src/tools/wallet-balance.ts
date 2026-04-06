import type { Address } from "viem";
import { ChainAdapter } from "../chain.js";
import type { ToolDefinition, SupportedChain } from "../types.js";
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
    description: "Query wallet balances via the paired desktop wallet. If token is omitted, queries ETH + USDC + USDT across all chains. If token is specified (ETH, USDC, USDT, or a 0x contract address), queries only that token. If chain is also specified, queries only that chain. Always check balance before calling wallet_send.",
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

      if (!walletConnection || !walletConnection.hasPairing()) {
        return { error: "Wallet not paired. Ask the user to open Claw Wallet desktop app → Pairing tab → generate a code, then call wallet_pair with that code." };
      }

      const token = args.token as string | undefined;
      const specifiedChain = args.chain as SupportedChain | undefined;

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
