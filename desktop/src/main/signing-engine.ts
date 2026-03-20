import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { KeyManager } from "./key-manager.js";

export interface AllowanceConfig {
  dailyLimitUSD: number;
  perTxLimitUSD: number;
  tokenWhitelist: string[];
  addressWhitelist: string[];
}

interface DailyUsage {
  date: string;
  spentUSD: number;
}

interface PendingSignRequest {
  requestId: string;
  method: string;
  params: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export interface SigningEngineOptions {
  dailyLimitUsd?: number;
  perTxLimitUsd?: number;
  tokenWhitelist?: string[];
}

const DEFAULT_ALLOWANCE: AllowanceConfig = {
  dailyLimitUSD: 100,
  perTxLimitUSD: 50,
  tokenWhitelist: ["ETH", "USDC", "USDT"],
  addressWhitelist: [],
};

export class SigningEngine {
  private keyManager: KeyManager;
  private allowance: AllowanceConfig;
  private dailyUsage: DailyUsage = { date: "", spentUSD: 0 };
  private pendingRequests = new Map<string, PendingSignRequest>();
  private frozen = false;
  private frozenUntil = 0;
  private dataDir = "";

  constructor(keyManager: KeyManager, options?: SigningEngineOptions) {
    this.keyManager = keyManager;
    this.allowance = {
      dailyLimitUSD: options?.dailyLimitUsd ?? DEFAULT_ALLOWANCE.dailyLimitUSD,
      perTxLimitUSD: options?.perTxLimitUsd ?? DEFAULT_ALLOWANCE.perTxLimitUSD,
      tokenWhitelist: options?.tokenWhitelist ?? [...DEFAULT_ALLOWANCE.tokenWhitelist],
      addressWhitelist: [],
    };
  }

  setDataDir(dir: string): void {
    this.dataDir = dir;
  }

  async loadAllowance(): Promise<void> {
    if (!this.dataDir) return;
    try {
      const raw = await readFile(join(this.dataDir, "allowance.json"), "utf-8");
      const saved = JSON.parse(raw);
      this.allowance = { ...DEFAULT_ALLOWANCE, ...saved };
    } catch {
      this.allowance = { ...DEFAULT_ALLOWANCE };
    }
  }

  async saveAllowance(): Promise<void> {
    if (!this.dataDir) return;
    await writeFile(
      join(this.dataDir, "allowance.json"),
      JSON.stringify(this.allowance, null, 2),
      { mode: 0o600 }
    );
  }

  isFrozen(): boolean {
    if (this.frozen && Date.now() >= this.frozenUntil) {
      this.frozen = false;
    }
    return this.frozen;
  }

  freeze(durationMs = 30 * 60 * 1000): void {
    this.frozen = true;
    this.frozenUntil = Date.now() + durationMs;
  }

  unfreeze(): void {
    this.frozen = false;
  }

  async handleSignRequest(
    requestId: string,
    method: string,
    params: Record<string, unknown>,
    estimatedUSD: number,
    onNeedApproval: (req: PendingSignRequest) => void,
  ): Promise<unknown> {
    if (this.isFrozen()) {
      throw new Error("Wallet is frozen due to security alert. Please wait or dismiss the alert.");
    }

    if (!this.keyManager.isUnlocked()) {
      throw new Error("Wallet is locked. Please unlock in the Wallet App first.");
    }

    this.resetDailyIfNeeded();

    const withinBudget = this.checkBudget(estimatedUSD, params);

    if (withinBudget) {
      return this.signDirectly(method, params, estimatedUSD);
    }

    return new Promise((resolve, reject) => {
      const pending: PendingSignRequest = {
        requestId,
        method,
        params,
        resolve,
        reject,
      };
      this.pendingRequests.set(requestId, pending);
      onNeedApproval(pending);
    });
  }

  async approve(requestId: string): Promise<void> {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) throw new Error("No pending request found");

    this.pendingRequests.delete(requestId);

    try {
      const result = await this.signDirectly(pending.method, pending.params, 0);
      pending.resolve(result);
    } catch (err) {
      pending.reject(err as Error);
    }
  }

  reject(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;
    this.pendingRequests.delete(requestId);
    pending.reject(new Error("Transaction rejected by user"));
  }

  getAllowance(): AllowanceConfig {
    return { ...this.allowance };
  }

  async setAllowance(config: Partial<AllowanceConfig>): Promise<void> {
    this.allowance = { ...this.allowance, ...config };
    await this.saveAllowance();
  }

  private checkBudget(estimatedUSD: number, params: Record<string, unknown>): boolean {
    if (estimatedUSD > this.allowance.perTxLimitUSD) return false;
    if (this.dailyUsage.spentUSD + estimatedUSD > this.allowance.dailyLimitUSD) return false;

    const token = (params.token as string || "ETH").toUpperCase();
    if (this.allowance.tokenWhitelist.length > 0 && !this.allowance.tokenWhitelist.includes(token)) {
      return false;
    }

    const to = params.to as string;
    if (this.allowance.addressWhitelist.length > 0 && to && !this.allowance.addressWhitelist.includes(to.toLowerCase())) {
      return false;
    }

    return true;
  }

  private async signDirectly(
    method: string,
    params: Record<string, unknown>,
    estimatedUSD: number,
  ): Promise<unknown> {
    const privateKey = this.keyManager.getPrivateKey();
    if (!privateKey) throw new Error("Wallet is locked");

    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(privateKey);

    if (method === "sign_transaction") {
      const signature = await account.signTransaction(params as any);
      this.dailyUsage.spentUSD += estimatedUSD;
      return { signature, address: account.address };
    }

    if (method === "sign_message") {
      const message = params.message as string;
      const signature = await account.signMessage({ message });
      return { signature, address: account.address };
    }

    throw new Error(`Unsupported signing method: ${method}`);
  }

  private resetDailyIfNeeded(): void {
    const today = new Date().toISOString().split("T")[0];
    if (this.dailyUsage.date !== today) {
      this.dailyUsage = { date: today, spentUSD: 0 };
    }
  }
}
