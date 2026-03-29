import { PolicyEngine } from "../policy.js";
import type { PolicyConfig, ToolDefinition } from "../types.js";

export function createWalletPolicyTools(policy: PolicyEngine): ToolDefinition[] {
  return [
    {
      name: "wallet_policy_get",
      description:
        "View current agent-side wallet policy: spending limits and mode. Trusted send-to addresses are managed in the desktop wallet, not here.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        return { policy: policy.getConfig() };
      },
    },
    {
      name: "wallet_policy_set",
      description:
        "Update agent-side policy (USD limits and mode). Cannot add or remove trusted addresses; use the desktop wallet for that.",
      parameters: {
        type: "object",
        properties: {
          per_transaction_limit_usd: {
            type: "number",
            description: "Maximum USD value per single transaction (agent-side limit)",
          },
          daily_limit_usd: {
            type: "number",
            description: "Maximum total USD value per 24-hour period (agent-side limit)",
          },
          mode: {
            type: "string",
            description:
              "Policy mode label (supervised | autonomous). Both apply the same address rules on the agent; signing and trust are gated by the desktop wallet.",
          },
        },
      },
      execute: async (args) => {
        if (
          (args as Record<string, unknown>).add_to_whitelist != null ||
          (args as Record<string, unknown>).remove_from_whitelist != null
        ) {
          return {
            error:
              "Trusted addresses are managed in the Claw Wallet desktop app. remove add_to_whitelist / remove_from_whitelist from the request.",
            policy: policy.getConfig(),
          };
        }

        const updates: Record<string, unknown> = {};

        if (args.per_transaction_limit_usd !== undefined) {
          updates.perTransactionLimitUsd = args.per_transaction_limit_usd;
        }
        if (args.daily_limit_usd !== undefined) {
          updates.dailyLimitUsd = args.daily_limit_usd;
        }
        if (args.mode !== undefined) {
          updates.mode = args.mode;
        }

        if (Object.keys(updates).length > 0) {
          policy.updateConfig(updates as Partial<PolicyConfig>);
        }

        await policy.save();
        return { policy: policy.getConfig(), message: "Policy updated." };
      },
    },
  ];
}
