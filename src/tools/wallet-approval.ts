import { PolicyEngine } from "../policy.js";
import type { ToolDefinition } from "../types.js";

export function createWalletApprovalTools(policy: PolicyEngine): ToolDefinition[] {
  return [
    {
      name: "wallet_approval_list",
      description: "List all pending transactions waiting for manual approval.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        policy.autoExpire();
        const pending = policy.listPending();
        if (pending.length === 0) return { pending: [], message: "No pending approvals." };
        return {
          pending: pending.map((p) => ({
            id: p.id,
            to: p.to,
            amount: p.amount,
            token: p.token,
            chain: p.chain,
            reason: p.reason,
            createdAt: new Date(p.createdAt).toISOString(),
          })),
        };
      },
    },
    {
      name: "wallet_approval_approve",
      description: "Approve a pending transaction by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Approval ID of the pending transaction" },
        },
        required: ["id"],
      },
      execute: async (args) => {
        const approved = policy.approve(args.id as string);
        if (!approved) return { error: `Approval ID "${args.id}" not found.` };
        await policy.save();
        return {
          approved: {
            id: approved.id,
            to: approved.to,
            amount: approved.amount,
            token: approved.token,
          },
          message: `Transaction approved. Execute the transfer manually: send ${approved.amount} ${approved.token} to ${approved.to}`,
        };
      },
    },
    {
      name: "wallet_approval_reject",
      description: "Reject a pending transaction by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Approval ID to reject" },
        },
        required: ["id"],
      },
      execute: async (args) => {
        const rejected = policy.reject(args.id as string);
        if (!rejected) return { error: `Approval ID "${args.id}" not found.` };
        await policy.save();
        return { message: `Transaction ${args.id} rejected.` };
      },
    },
  ];
}
