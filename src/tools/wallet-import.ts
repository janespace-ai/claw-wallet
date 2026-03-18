import type { ToolDefinition } from "../types.js";
import { SignerClient } from "../signer/ipc-client.js";

export function createWalletImportTool(signerClient: SignerClient): ToolDefinition {
  return {
    name: "wallet_import",
    description: "Import an existing wallet. Private key and password are entered securely through the Signer process — never exposed to the Agent.",
    parameters: {
      type: "object",
      properties: {
        keystoreFile: {
          type: "string",
          description: "Optional path to an existing Keystore V3 JSON file to import",
        },
      },
      required: [],
    },
    execute: async (args) => {
      try {
        const params: Record<string, unknown> = {};
        if (args.keystoreFile) params.keystoreFile = args.keystoreFile;
        const result = await signerClient.call("import_wallet", params) as { address: string };
        return { address: result.address, message: `Wallet imported successfully. Address: ${result.address}` };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  };
}
