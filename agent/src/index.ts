import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import type { Address } from "viem";

import { ChainAdapter } from "./chain.js";
import { PolicyEngine } from "./policy.js";
import { ContactsManager } from "./contacts.js";
import { TransactionHistory } from "./history.js";
import { BalanceMonitor } from "./monitor.js";
import { TransferService } from "./transfer.js";
import { WalletConnection } from "./wallet-connection.js";
import type { SupportedChain, WalletConfig, ToolDefinition, ChainConfig } from "./types.js";

import { createAllTools } from "./tool-registry.js";
import { readRelayUrlFromCwdConfig } from "./resolve-relay-url.js";
import { logger } from "./logger.js";
import { agentConfig } from "./config.js";

export interface ClawWalletOptions {
  dataDir?: string;
  defaultChain?: SupportedChain;
  chains?: Partial<Record<SupportedChain, ChainConfig>>;
  relayUrl?: string;
  pollIntervalMs?: number;
  onBalanceChange?: (event: any) => void;
}

export class ClawWallet {
  private chainAdapter: ChainAdapter;
  private policy: PolicyEngine;
  private contacts: ContactsManager;
  private history: TransactionHistory;
  private monitor: BalanceMonitor | null = null;
  private walletConnection: WalletConnection;
  private walletAddress: Address | null = null;
  private dataDir: string;
  private defaultChain: SupportedChain;
  private pollIntervalMs: number;
  private onBalanceChange?: (event: any) => void;

  constructor(options: ClawWalletOptions = {}) {
    this.dataDir = options.dataDir || agentConfig.dataDir || join(homedir(), ".openclaw", "wallet");
    this.defaultChain = options.defaultChain || agentConfig.defaultChain || "base";
    this.pollIntervalMs = options.pollIntervalMs || 30_000;
    this.onBalanceChange = options.onBalanceChange;

    const relayUrl =
      options.relayUrl ||
      agentConfig.relayUrl ||
      process.env.RELAY_URL ||
      readRelayUrlFromCwdConfig() ||
      "https://wallet.janespace.xyz/relay";
      
    logger.log("ClawWallet", "Initializing", { 
      dataDir: this.dataDir, 
      defaultChain: this.defaultChain, 
      relayUrl,
      pollIntervalMs: this.pollIntervalMs 
    });
    logger.log("ClawWallet", `Log file: ${logger.getLogFile()}`);
      
    this.walletConnection = new WalletConnection({
      relayUrl,
      dataDir: this.dataDir,
    });

    // Use chains config from options first, then fall back to agentConfig
    const chains = options.chains || agentConfig.chains;
    this.chainAdapter = new ChainAdapter(chains);
    this.policy = new PolicyEngine(join(this.dataDir, "policy.json"));
    this.contacts = new ContactsManager(join(this.dataDir, "contacts.json"));
    this.history = new TransactionHistory(join(this.dataDir, "history.json"));
  }

  async initialize(): Promise<void> {
    logger.log("ClawWallet", "Starting initialization...");
    await mkdir(this.dataDir, { recursive: true });
    await this.walletConnection.initialize();
    await this.policy.load();
    await this.contacts.load();
    await this.history.load();

    const addr = this.walletConnection.getAddress();
    if (addr) {
      this.walletAddress = addr as Address;
      this.startMonitor();
      logger.log("ClawWallet", "Initialization complete", { address: addr });
    } else {
      logger.log("ClawWallet", "Initialization complete (no wallet paired)");
    }
  }

  async shutdown(): Promise<void> {
    this.stopMonitor();
    await this.history.save();
    await this.contacts.save();
    await this.policy.save();
  }

  private startMonitor(): void {
    if (!this.walletAddress || this.monitor) return;
    this.monitor = new BalanceMonitor(
      this.chainAdapter,
      this.walletAddress,
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
    return this.walletAddress;
  }

  private getTransferService(): TransferService | null {
    if (!this.walletAddress) return null;
    return new TransferService(
      this.chainAdapter,
      this.walletAddress,
      this.walletConnection,
      this.policy,
      this.contacts,
      this.history
    );
  }

  async reloadAddress(): Promise<void> {
    const addr = this.walletConnection.getAddress();
    if (addr) {
      this.walletAddress = addr as Address;
      this.stopMonitor();
      this.startMonitor();
    }
  }

  getTools(): ToolDefinition[] {
    const tools = createAllTools({
      walletConnection: this.walletConnection,
      chainAdapter: this.chainAdapter,
      getAddress: () => this.getAddress(),
      getTransferService: () => this.getTransferService(),
      contacts: this.contacts,
      policy: this.policy,
      history: this.history,
      defaultChain: this.defaultChain,
    });

    const wrapWithReload = (name: string) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) return;
      const original = tool.execute;
      tool.execute = async (args) => {
        const result = await original(args);
        if (!(result as any).error) {
          await this.reloadAddress();
        }
        return result;
      };
    };

    wrapWithReload("wallet_pair");

    return tools;
  }
}

export { readRelayUrlFromCwdConfig } from "./resolve-relay-url.js";
export { ChainAdapter } from "./chain.js";
export { createAllTools, type ToolDependencies } from "./tool-registry.js";
export { PolicyEngine, createDefaultPolicy } from "./policy.js";
export { ContactsManager } from "./contacts.js";
export { TransactionHistory } from "./history.js";
export { BalanceMonitor } from "./monitor.js";
export { TransferService, PolicyBlockedError } from "./transfer.js";
export { WalletConnection, type WalletConnectionOptions } from "./wallet-connection.js";
export { logger } from "./logger.js";
export type * from "./types.js";
