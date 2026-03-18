import type { ToolDefinition } from "../types.js";
import { SignerClient } from "../signer/ipc-client.js";

export function createWalletExportMnemonicTool(signerClient: SignerClient): ToolDefinition {
  return {
    name: "wallet_export_mnemonic",
    description:
      "Export the wallet recovery phrase (mnemonic). The mnemonic will be displayed in a secure popup window — " +
      "it is NEVER returned to you (the Agent). Tell the user to check the popup to view and copy their mnemonic. " +
      "The user must enter their password in the popup to verify identity.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (_args) => {
      try {
        const result = await signerClient.call("export_mnemonic") as { exported: boolean };
        if (result.exported) {
          return { message: "Recovery phrase displayed in secure window. It was NOT returned here for security." };
        }
        return { error: "Export was not completed" };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  };
}
