import { generateWallet, encryptKey, saveKeystore, keystoreExists } from "../keystore.js";
import type { ToolDefinition } from "../types.js";

export function createWalletCreateTool(keystorePath: string): ToolDefinition {
  return {
    name: "wallet_create",
    description: "Create a new Web3 wallet. Generates a new private key, encrypts it, and stores it locally. Returns the new wallet address.",
    parameters: {
      type: "object",
      properties: {
        password: {
          type: "string",
          description: "Master password to encrypt the wallet private key",
        },
      },
      required: ["password"],
    },
    execute: async (args) => {
      const password = args.password as string;

      if (await keystoreExists(keystorePath)) {
        return { error: "Wallet already exists. Use wallet_import to replace it." };
      }

      const { privateKey, address } = generateWallet();
      const keystore = encryptKey(privateKey, password);

      const buf = Buffer.from(privateKey.slice(2), "hex");
      buf.fill(0);

      await saveKeystore(keystore, keystorePath);
      return { address, message: `Wallet created successfully. Address: ${address}` };
    },
  };
}
