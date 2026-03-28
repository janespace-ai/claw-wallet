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

export type SupportedChain = "base" | "ethereum";

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
