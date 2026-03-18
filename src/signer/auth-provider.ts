import type { Address } from "viem";
import type { SupportedChain } from "../types.js";

export interface SigningContext {
  operation: "send" | "sign_message" | "create_wallet" | "import_wallet" | "set_allowance" | "unlock";
  to?: Address;
  amount?: string;
  token?: string;
  chain?: SupportedChain;
  data?: string;
  level: 0 | 1 | 2;
}

export interface AuthProvider {
  requestPin(context: SigningContext): Promise<string>;
  requestConfirm(context: SigningContext): Promise<boolean>;
  requestSecretInput(prompt: string): Promise<string>;
  notify(message: string): void;
}
