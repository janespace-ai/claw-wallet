import type { Hex, Address, Chain } from "viem";

// ── Keystore ──

export interface KeystoreV3 {
  address: Address;
  crypto: {
    cipher: string;
    cipherparams: { iv: string };
    ciphertext: string;
    kdf: string;
    kdfparams: {
      dklen: number;
      n: number;
      r: number;
      p: number;
      salt: string;
    };
    mac: string;
  };
  id: string;
  version: 3;
}

// ── Chain ──

export type SupportedChain =
  | "base"
  | "ethereum"
  | "linea"
  | "arbitrum"
  | "bsc"
  | "optimism"
  | "polygon"
  | "sei";

export interface ChainConfig {
  chain: Chain;
  rpcUrl?: string;
}

export interface WalletConfig {
  dataDir: string;
  chains: Partial<Record<SupportedChain, ChainConfig>>;
  defaultChain: SupportedChain;
  pollIntervalMs: number;
}

// ── Token ──

export interface TokenInfo {
  symbol: string;
  address: Address;
  decimals: number;
  chain: SupportedChain;
}

export const KNOWN_TOKENS: Record<SupportedChain, Record<string, Address>> = {
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
  },
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  linea: {
    USDC: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    USDT: "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
  },
  arbitrum: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  bsc: {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  optimism: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  polygon: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  sei: {
    USDC: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1",
  },
};

// ── Policy ──

export type PolicyMode = "supervised" | "autonomous";

export interface PolicyConfig {
  perTransactionLimitUsd: number;
  dailyLimitUsd: number;
  mode: PolicyMode;
}

export interface PendingApproval {
  id: string;
  to: Address;
  amount: string;
  token: string;
  chain: SupportedChain;
  reason: string;
  createdAt: number;
  rawTx?: TransactionRequest;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  approvalId?: string;
}

// ── Contacts ──

export interface Contact {
  name: string;
  addresses: Partial<Record<SupportedChain, Address>>;
  supportedTokens?: string[];
  /** Mirrored from Desktop: trusted on a chain → eligible for silent signing there (Agent cache only). */
  trustedOnChain?: Partial<Record<SupportedChain, boolean>>;
  lastUpdated: string;
}

export interface ContactsStore {
  contacts: Contact[];
}

// ── Transaction ──

export type TxDirection = "sent" | "received";
export type TxStatus = "confirmed" | "failed" | "pending";

export interface TxRecord {
  hash: Hex;
  direction: TxDirection;
  from: Address;
  to: Address;
  amount: string;
  token: string;
  chain: SupportedChain;
  status: TxStatus;
  blockNumber?: bigint;
  gasUsed?: bigint;
  timestamp: number;
  revertReason?: string;
}

export interface TransactionRequest {
  to: Address;
  from?: Address;
  value?: bigint;
  data?: Hex;
  gas?: bigint;
  chainId?: number;
}

// ── Balance Monitor ──

export type BalanceChangeCallback = (event: BalanceChangeEvent) => void;

export interface BalanceChangeEvent {
  token: string;
  chain: SupportedChain;
  previousBalance: string;
  newBalance: string;
  difference: string;
  direction: "increase" | "decrease";
}

// ── Plugin ──

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
