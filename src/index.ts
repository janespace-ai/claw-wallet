import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import type { Address } from "viem";

import { ChainAdapter } from "./chain.js";
import { loadKeystore, keystoreExists, getAddress as getKeystoreAddress } from "./keystore.js";
import { PolicyEngine } from "./policy.js";
import { ContactsManager } from "./contacts.js";
import { TransactionHistory } from "./history.js";
import { BalanceMonitor } from "./monitor.js";
import { TransferService } from "./transfer.js";
import type { KeystoreV3, SupportedChain, WalletConfig, ToolDefinition, ChainConfig } from "./types.js";

import { createWalletCreateTool } from "./tools/wallet-create.js";
import { createWalletImportTool } from "./tools/wallet-import.js";
import {
  createWalletBalanceTool,
  createWalletAddressTool,
  createWalletEstimateGasTool,
} from "./tools/wallet-balance.js";
import { createWalletSendTool } from "./tools/wallet-send.js";
import { createWalletContactsTools } from "./tools/wallet-contacts.js";
import { createWalletPolicyTools } from "./tools/wallet-policy.js";
import { createWalletApprovalTools } from "./tools/wallet-approval.js";
import { createWalletHistoryTool } from "./tools/wallet-history.js";

export interface ClawWalletOptions {
  dataDir?: string;
  defaultChain?: SupportedChain;
  chains?: Partial<Record<SupportedChain, ChainConfig>>;
  password?: string;
  pollIntervalMs?: number;
  onBalanceChange?: (event: any) => void;
}

export class ClawWallet {
  private chainAdapter: ChainAdapter;
  private policy: PolicyEngine;
  private contacts: ContactsManager;
  private history: TransactionHistory;
  private monitor: BalanceMonitor | null = null;
  private keystore: KeystoreV3 | null = null;
  private password: string | null = null;
  private dataDir: string;
  private defaultChain: SupportedChain;
  private pollIntervalMs: number;
  private onBalanceChange?: (event: any) => void;

  constructor(options: ClawWalletOptions = {}) {
    this.dataDir = options.dataDir || join(homedir(), ".openclaw", "wallet");
    this.defaultChain = options.defaultChain || "base";
    this.pollIntervalMs = options.pollIntervalMs || 30_000;
    this.password = options.password || null;
    this.onBalanceChange = options.onBalanceChange;

    this.chainAdapter = new ChainAdapter(options.chains);
    this.policy = new PolicyEngine(join(this.dataDir, "policy.json"));
    this.contacts = new ContactsManager(join(this.dataDir, "contacts.json"));
    this.history = new TransactionHistory(join(this.dataDir, "history.json"));
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await this.policy.load();
    await this.contacts.load();
    await this.history.load();

    const ksPath = join(this.dataDir, "keystore.json");
    if (await keystoreExists(ksPath)) {
      this.keystore = await loadKeystore(ksPath);
      this.startMonitor();
    }
  }

  async shutdown(): Promise<void> {
    this.stopMonitor();
    await this.history.save();
    await this.contacts.save();
    await this.policy.save();
  }

  private startMonitor(): void {
    if (!this.keystore || this.monitor) return;
    const address = getKeystoreAddress(this.keystore);
    this.monitor = new BalanceMonitor(
      this.chainAdapter,
      address,
      this.chainAdapter.getSupportedChains(),
      this.pollIntervalMs
    );
    if (this.onBalanceChange) {
      this.monitor.onBalanceChange(this.onBalanceChange);
    }
    this.monitor.start();
  }

  private stopMonitor(): void {
    if (this.monitor) {
      this.monitor.stop();
      this.monitor = null;
    }
  }

  private getAddress(): Address | null {
    return this.keystore ? getKeystoreAddress(this.keystore) : null;
  }

  private getTransferService(): TransferService | null {
    if (!this.keystore || !this.password) return null;
    return new TransferService(
      this.chainAdapter,
      this.keystore,
      this.password,
      this.policy,
      this.contacts,
      this.history
    );
  }

  setPassword(password: string): void {
    this.password = password;
  }

  async reloadKeystore(): Promise<void> {
    const ksPath = join(this.dataDir, "keystore.json");
    if (await keystoreExists(ksPath)) {
      this.keystore = await loadKeystore(ksPath);
      this.stopMonitor();
      this.startMonitor();
    }
  }

  getTools(): ToolDefinition[] {
    const ksPath = join(this.dataDir, "keystore.json");

    const walletCreate = createWalletCreateTool(ksPath);
    const walletImport = createWalletImportTool(ksPath);

    const originalCreateExecute = walletCreate.execute;
    walletCreate.execute = async (args) => {
      const result = await originalCreateExecute(args);
      if (!(result as any).error) {
        this.password = args.password as string;
        await this.reloadKeystore();
      }
      return result;
    };

    const originalImportExecute = walletImport.execute;
    walletImport.execute = async (args) => {
      const result = await originalImportExecute(args);
      if (!(result as any).error) {
        this.password = args.password as string;
        await this.reloadKeystore();
      }
      return result;
    };

    return [
      walletCreate,
      walletImport,
      createWalletAddressTool(() => this.getAddress()),
      createWalletBalanceTool(this.chainAdapter, () => this.getAddress(), this.defaultChain),
      createWalletEstimateGasTool(this.chainAdapter, this.defaultChain),
      createWalletSendTool(() => this.getTransferService(), this.defaultChain),
      ...createWalletContactsTools(this.contacts, this.defaultChain),
      ...createWalletPolicyTools(this.policy),
      ...createWalletApprovalTools(this.policy),
      createWalletHistoryTool(this.history),
    ];
  }
}

export { ChainAdapter } from "./chain.js";
export { PolicyEngine, createDefaultPolicy } from "./policy.js";
export { ContactsManager } from "./contacts.js";
export { TransactionHistory } from "./history.js";
export { BalanceMonitor } from "./monitor.js";
export { TransferService, PolicyBlockedError } from "./transfer.js";
export * from "./keystore.js";
export type * from "./types.js";
