import type { ToolDefinition } from "../types.js";
import { SignerClient } from "../signer/ipc-client.js";

export function createWalletCreateTool(signerClient: SignerClient): ToolDefinition {
  return {
    name: "wallet_create",
    description: "Create a new Web3 wallet. The wallet is managed securely in the Electron Wallet App — keys never touch this Agent. If not yet paired, instructs the user to open the Wallet App.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (_args) => {
      try {
        const result = await signerClient.call("create_wallet") as { address?: string; message?: string };
        if (result.message) {
          return { message: result.message };
        }
        return { address: result.address, message: `Wallet created successfully. Address: ${result.address}` };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  };
}
