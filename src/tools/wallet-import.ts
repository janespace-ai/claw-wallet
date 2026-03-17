import { encryptKey, saveKeystore } from "../keystore.js";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import type { ToolDefinition } from "../types.js";

export function createWalletImportTool(keystorePath: string): ToolDefinition {
  return {
    name: "wallet_import",
    description: "Import an existing wallet using a private key. Encrypts and stores it locally.",
    parameters: {
      type: "object",
      properties: {
        private_key: {
          type: "string",
          description: "The private key to import (hex string starting with 0x)",
        },
        password: {
          type: "string",
          description: "Master password to encrypt the wallet private key",
        },
      },
      required: ["private_key", "password"],
    },
    execute: async (args) => {
      const privateKey = args.private_key as Hex;
      const password = args.password as string;

      try {
        privateKeyToAccount(privateKey);
      } catch {
        return { error: "Invalid private key format." };
      }

      const keystore = encryptKey(privateKey, password);
      await saveKeystore(keystore, keystorePath);
      return {
        address: keystore.address,
        message: `Wallet imported successfully. Address: ${keystore.address}`,
      };
    },
  };
}
