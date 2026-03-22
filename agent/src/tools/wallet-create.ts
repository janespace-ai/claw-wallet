import type { ToolDefinition } from "../types.js";

export function createWalletCreateTool(): ToolDefinition {
  return {
    name: "wallet_create",
    description: "Create a new Web3 wallet. The wallet is managed securely in the Desktop Wallet App — keys never touch this Agent. Instructs the user to open the Wallet App and create a wallet there, then pair with this Agent.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      return {
        message: "Please create your wallet in the Desktop Wallet App, then use wallet_pair to connect.",
      };
    },
  };
}
