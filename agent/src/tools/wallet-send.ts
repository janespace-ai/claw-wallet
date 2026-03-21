import { TransferService, PolicyBlockedError } from "../transfer.js";
import type { ToolDefinition, SupportedChain } from "../types.js";

export function createWalletSendTool(
  getTransferService: () => TransferService | null,
  defaultChain: SupportedChain
): ToolDefinition {
  return {
    name: "wallet_send",
    description:
      "Send ETH or ERC-20 tokens to an address or contact name. " +
      "The transaction is signed remotely by the Electron Wallet App via E2EE. " +
      "If the amount exceeds the auto-approval limit, the Wallet App will prompt the user for confirmation. " +
      "Requires the Wallet App to be running and paired. " +
      "Examples: send 0.1 ETH, send 50 USDC to 0xABC..., send 10 USDC to trading-bot.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient address (0x...) or contact name",
        },
        amount: {
          type: "string",
          description: "Amount to send (e.g., '0.1', '50')",
        },
        token: {
          type: "string",
          description: "Token to send (ETH, USDC, USDT, or contract address). Defaults to ETH.",
        },
        chain: {
          type: "string",
          description: "Chain to use (base, ethereum). Defaults to configured default.",
        },
      },
      required: ["to", "amount"],
    },
    execute: async (args) => {
      const service = getTransferService();
      if (!service) {
        return { error: "No wallet configured. Use wallet_create or wallet_import first." };
      }

      try {
        const result = await service.send({
          to: args.to as string,
          amount: args.amount as string,
          token: (args.token as string) || "ETH",
          chain: (args.chain as SupportedChain) || defaultChain,
        });

        return {
          hash: result.hash,
          status: result.status,
          blockNumber: result.blockNumber?.toString(),
          gasUsed: result.gasUsed?.toString(),
          message: `Transaction ${result.status}. Hash: ${result.hash}`,
        };
      } catch (err) {
        if (err instanceof PolicyBlockedError) {
          return {
            blocked: true,
            reason: err.message,
            approvalId: err.approvalId,
            message: `Transaction blocked: ${err.message}. Approval ID: ${err.approvalId}`,
          };
        }
        return { error: (err as Error).message };
      }
    },
  };
}
