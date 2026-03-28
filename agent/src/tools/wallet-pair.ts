import type { ToolDefinition } from "../types.js";
import type { WalletConnection } from "../wallet-connection.js";

export function createWalletPairTool(walletConnection: WalletConnection): ToolDefinition {
  return {
    name: "wallet_pair",
    description: "Pair with a Desktop Wallet App using a short code. The user should first open the Wallet App, generate a pairing code, and provide it here. This establishes a secure E2EE channel between Agent and Wallet App.",
    parameters: {
      type: "object",
      properties: {
        shortCode: {
          type: "string",
          description: "The pairing code displayed in the Desktop Wallet App",
        },
      },
      required: ["shortCode"],
    },
    execute: async (args) => {
      console.log(`[wallet-pair] execute called with args:`, JSON.stringify(args));
      
      if (!args.shortCode || typeof args.shortCode !== 'string' || args.shortCode.trim() === '') {
        console.error(`[wallet-pair] Invalid shortCode:`, args.shortCode);
        return { error: 'shortCode is required and must be a non-empty string' };
      }
      
      try {
        const result = await walletConnection.pair(args.shortCode as string);
        return {
          address: result.address,
          paired: result.paired,
          message: `Successfully paired with wallet. Address: ${result.address}`,
        };
      } catch (err) {
        console.error(`[wallet-pair] Pairing failed:`, err);
        return { error: (err as Error).message };
      }
    },
  };
}
