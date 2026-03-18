import type { ToolDefinition } from "../types.js";
import { SignerClient } from "../signer/ipc-client.js";

export function createWalletCreateTool(signerClient: SignerClient): ToolDefinition {
  return {
    name: "wallet_create",
    description: "Create a new Web3 wallet with BIP-39 mnemonic. A secure password input window will pop up — tell the user to set a strong password in the dialog before calling this tool. Returns the new wallet address.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (_args) => {
      try {
        const result = await signerClient.call("create_wallet") as { address: string };
        return { address: result.address, message: `Wallet created successfully. Address: ${result.address}` };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  };
}
