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
  /** USD estimate for allowance accounting after user approves an over-budget request */
  estimatedUSD: number;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

export interface SigningEngineOptions {
  dailyLimitUsd?: number;
  perTxLimitUsd?: number;
  tokenWhitelist?: string[];
  /** When true, on-chain txs within allowance may auto-sign without a prompt. Default false. */
  autoApproveWithinBudget?: boolean;
  approvalTimeoutMs?: number;
  onApprovalExpired?: (requestId: string) => void;
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
  private approvalTimeoutMs: number;
  private onApprovalExpired?: (requestId: string) => void;
  private autoApproveWithinBudget: boolean;

  constructor(keyManager: KeyManager, options?: SigningEngineOptions) {
    this.keyManager = keyManager;
    this.approvalTimeoutMs = options?.approvalTimeoutMs ?? 10 * 60 * 1000;
    this.onApprovalExpired = options?.onApprovalExpired;
    this.autoApproveWithinBudget = options?.autoApproveWithinBudget ?? false;
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
    console.log(`[signing-engine] handleSignRequest: requestId=${requestId} method=${method} estimatedUSD=${estimatedUSD}`);

    if (this.isFrozen()) {
      throw new Error("Wallet is frozen due to security alert. Please wait or dismiss the alert.");
    }

    if (!this.keyManager.isUnlocked()) {
      throw new Error("Wallet is locked. Please unlock in the Wallet App first.");
    }

    this.resetDailyIfNeeded();

    const withinBudget = this.checkBudget(estimatedUSD, params);
    const canSilentSign =
      method === "sign_transaction"
        ? withinBudget && this.autoApproveWithinBudget
        : withinBudget;

    if (canSilentSign) {
      console.log(`[signing-engine] auto-approve within budget for requestId=${requestId}`);
      return this.signDirectly(method, params, estimatedUSD);
    }

    console.log(`[signing-engine] needs manual approval for requestId=${requestId} (withinBudget=${withinBudget})`);
    return new Promise((resolve, reject) => {
      const pending: PendingSignRequest = {
        requestId,
        method,
        params,
        estimatedUSD,
        resolve,
        reject,
      };

      pending.expiryTimer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error("Approval timeout: transaction expired after 10 minutes"));
          this.onApprovalExpired?.(requestId);
        }
      }, this.approvalTimeoutMs);

      this.pendingRequests.set(requestId, pending);
      onNeedApproval(pending);
    });
  }

  async approve(requestId: string): Promise<void> {
    console.log(`[signing-engine] approve: requestId=${requestId} pending=${this.pendingRequests.has(requestId)}`);
    const pending = this.pendingRequests.get(requestId);
    if (!pending) throw new Error("No pending request found");

    if (pending.expiryTimer) clearTimeout(pending.expiryTimer);
    this.pendingRequests.delete(requestId);

    try {
      console.log(`[signing-engine] signDirectly START requestId=${requestId} method=${pending.method}`);
      const result = await this.signDirectly(pending.method, pending.params, pending.estimatedUSD);
      console.log(`[signing-engine] signDirectly OK requestId=${requestId}`);
      pending.resolve(result);
    } catch (err) {
      console.error(`[signing-engine] signDirectly FAILED requestId=${requestId}: ${(err as Error).message}`);
      pending.reject(err as Error);
    }
  }

  reject(requestId: string): void {
    console.log(`[signing-engine] reject: requestId=${requestId}`);
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;
    if (pending.expiryTimer) clearTimeout(pending.expiryTimer);
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
      const txParams = sanitizeTxParams(params);
      console.log(`[signing-engine] signTransaction with sanitized params:`, JSON.stringify(txParams));
      const signedTx = await account.signTransaction(txParams as any);
      this.dailyUsage.spentUSD += estimatedUSD;
      return { signedTx, address: account.address };
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

const VALID_TX_FIELDS = new Set([
  "to", "value", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas",
  "nonce", "data", "chainId", "type", "accessList",
  "blobs", "blobVersionedHashes", "sidecars", "authorizationList",
]);

function toBigInt(v: unknown): bigint | undefined {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && v.trim() !== "") {
    try {
      return BigInt(v);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function sanitizeTxParams(raw: Record<string, unknown>): Record<string, unknown> {
  const tx: Record<string, unknown> = {};

  for (const key of VALID_TX_FIELDS) {
    if (raw[key] !== undefined && raw[key] !== null) {
      tx[key] = raw[key];
    }
  }

  const bigintFields = ["value", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "nonce"];
  for (const field of bigintFields) {
    if (tx[field] !== undefined) {
      const converted = toBigInt(tx[field]);
      if (converted !== undefined) {
        tx[field] = converted;
      } else {
        delete tx[field];
      }
    }
  }

  if (!tx.type && !tx.maxFeePerGas && !tx.accessList && !tx.blobs && !tx.authorizationList) {
    if (tx.gasPrice) {
      tx.type = "legacy";
    } else {
      tx.type = "legacy";
      if (!tx.gasPrice) tx.gasPrice = 1000000000n;
    }
  }

  return tx;
}
