import type { ToolDefinition } from "../types.js";

export function createWalletImportTool(): ToolDefinition {
  return {
    name: "wallet_import",
    description: "Import an existing wallet. The wallet is managed securely in the Desktop Wallet App — keys never touch this Agent. Instructs the user to open the Wallet App and import a wallet there, then pair with this Agent.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      return {
        message: "Please import your wallet in the Desktop Wallet App, then use wallet_pair to connect.",
      };
    },
  };
}
