import type { ToolDefinition } from "../types.js";
import { SignerClient } from "../signer/ipc-client.js";

export function createWalletPairTool(signerClient: SignerClient): ToolDefinition {
  return {
    name: "wallet_pair",
    description: "Pair with an Electron Wallet App using a short code. The user should first open the Wallet App, generate a pairing code, and provide it here. This establishes a secure E2EE channel between Agent and Wallet App.",
    parameters: {
      type: "object",
      properties: {
        shortCode: {
          type: "string",
          description: "The pairing code displayed in the Electron Wallet App",
        },
      },
      required: ["shortCode"],
    },
    execute: async (args) => {
      try {
        const result = await signerClient.call("wallet_pair", {
          shortCode: args.shortCode as string,
        }) as { address: string; paired: boolean; pairId: string };
        return {
          address: result.address,
          paired: result.paired,
          message: `Successfully paired with wallet. Address: ${result.address}`,
        };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  };
}
