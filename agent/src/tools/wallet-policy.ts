import { PolicyEngine } from "../policy.js";
import type { ToolDefinition } from "../types.js";

export function createWalletPolicyTools(policy: PolicyEngine): ToolDefinition[] {
  return [
    {
      name: "wallet_policy_get",
      description: "View current wallet security policy settings including spending limits, whitelist, and mode.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        return { policy: policy.getConfig() };
      },
    },
    {
      name: "wallet_policy_set",
      description: "Update wallet security policy. Can change spending limits, whitelist, or mode (supervised/autonomous).",
      parameters: {
        type: "object",
        properties: {
          per_transaction_limit_usd: {
            type: "number",
            description: "Maximum USD value per single transaction",
          },
          daily_limit_usd: {
            type: "number",
            description: "Maximum total USD value per 24-hour period",
          },
          mode: {
            type: "string",
            description: "Policy mode: 'supervised' (requires whitelist) or 'autonomous' (allows any address within limits)",
          },
          add_to_whitelist: {
            type: "string",
            description: "Address to add to the whitelist",
          },
          remove_from_whitelist: {
            type: "string",
            description: "Address to remove from the whitelist",
          },
        },
      },
      execute: async (args) => {
        const updates: Record<string, any> = {};

        if (args.per_transaction_limit_usd !== undefined)
          updates.perTransactionLimitUsd = args.per_transaction_limit_usd;
        if (args.daily_limit_usd !== undefined)
          updates.dailyLimitUsd = args.daily_limit_usd;
        if (args.mode !== undefined)
          updates.mode = args.mode;

        if (Object.keys(updates).length > 0) {
          policy.updateConfig(updates);
        }

        if (args.add_to_whitelist) {
          const config = policy.getConfig();
          const addr = (args.add_to_whitelist as string).toLowerCase();
          if (!config.whitelist.some((w) => w.toLowerCase() === addr)) {
            config.whitelist.push(args.add_to_whitelist as any);
            policy.updateConfig({ whitelist: config.whitelist });
          }
        }

        if (args.remove_from_whitelist) {
          const config = policy.getConfig();
          const addr = (args.remove_from_whitelist as string).toLowerCase();
          config.whitelist = config.whitelist.filter(
            (w) => w.toLowerCase() !== addr
          );
          policy.updateConfig({ whitelist: config.whitelist });
        }

        await policy.save();
        return { policy: policy.getConfig(), message: "Policy updated." };
      },
    },
  ];
}
