import { TransactionHistory } from "../history.js";
import type { ToolDefinition } from "../types.js";

export function createWalletHistoryTool(history: TransactionHistory): ToolDefinition {
  return {
    name: "wallet_history",
    description: "Query transaction history for the wallet. Shows recent sent and received transactions.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of transactions to return. Defaults to 20.",
        },
        offset: {
          type: "number",
          description: "Number of transactions to skip. Defaults to 0.",
        },
      },
    },
    execute: async (args) => {
      const limit = (args.limit as number) || 20;
      const offset = (args.offset as number) || 0;
      const records = history.getHistory(limit, offset);

      if (records.length === 0) return { transactions: [], message: "No transaction history." };

      return {
        transactions: records.map((r) => ({
          hash: r.hash,
          direction: r.direction,
          from: r.from,
          to: r.to,
          amount: r.amount,
          token: r.token,
          chain: r.chain,
          status: r.status,
          timestamp: new Date(r.timestamp).toISOString(),
        })),
        total: records.length,
      };
    },
  };
}
