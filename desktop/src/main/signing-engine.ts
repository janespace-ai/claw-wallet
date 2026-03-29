import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { ethers } from "ethers";
import { KeyManager } from "./key-manager.js";
import type { SigningHistory } from "./signing-history.js";
import type { WalletAuthorityStore } from "./wallet-authority-store.js";

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
  private signingHistory: SigningHistory | null;
  private allowance: AllowanceConfig;
  private dailyUsage: DailyUsage = { date: "", spentUSD: 0 };
  private pendingRequests = new Map<string, PendingSignRequest>();
  private frozen = false;
  private frozenUntil = 0;
  private dataDir = "";
  private approvalTimeoutMs: number;
  private onApprovalExpired?: (requestId: string) => void;
  private autoApproveWithinBudget: boolean;
  private authorityStore: WalletAuthorityStore | null = null;
  /** After successful tx: upsert trusted contact */
  private pendingTrustAfterTx = new Map<
    string,
    { address: string; name: string; chain: string }
  >();

  constructor(keyManager: KeyManager, options?: SigningEngineOptions, signingHistory?: SigningHistory) {
    this.keyManager = keyManager;
    this.signingHistory = signingHistory || null;
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

  setAuthorityStore(store: WalletAuthorityStore | null): void {
    this.authorityStore = store;
  }

  getApprovalTimeoutMs(): number {
    return this.approvalTimeoutMs;
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
    options?: { priceAvailable?: boolean },
  ): Promise<unknown> {
    const priceKnown =
      method !== "sign_transaction" || options?.priceAvailable === true;
    console.log(
      `[signing-engine] handleSignRequest: requestId=${requestId} method=${method} estimatedUSD=${estimatedUSD} priceKnown=${priceKnown}`,
    );

    if (this.isFrozen()) {
      throw new Error("Wallet is frozen due to security alert. Please wait or dismiss the alert.");
    }

    if (!this.keyManager.isUnlocked()) {
      throw new Error("Wallet is locked. Please unlock in the Wallet App first.");
    }

    this.resetDailyIfNeeded();

    const withinBudget = priceKnown && this.checkBudget(estimatedUSD, params);
    const canSilentSign =
      method === "sign_transaction"
        ? withinBudget && this.autoApproveWithinBudget
        : withinBudget;

    if (canSilentSign) {
      console.log(`[signing-engine] auto-approve within budget for requestId=${requestId}`);
      return this.signDirectly(method, params, estimatedUSD, requestId, true);
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

  async approve(
    requestId: string,
    options?: { trustRecipientAfterSuccess?: boolean; trustRecipientName?: string },
  ): Promise<void> {
    console.log(`[signing-engine] approve: requestId=${requestId} pending=${this.pendingRequests.has(requestId)}`);
    const pending = this.pendingRequests.get(requestId);
    if (!pending) throw new Error("No pending request found");

    if (pending.expiryTimer) clearTimeout(pending.expiryTimer);
    this.pendingRequests.delete(requestId);

    if (options?.trustRecipientAfterSuccess && pending.method === "sign_transaction") {
      const name = options.trustRecipientName?.trim();
      if (!name) {
        throw new Error("Contact name is required when adding recipient as trusted after success");
      }
      const addrRaw = extractRecipientForTrust(pending.params);
      if (!addrRaw || !ethers.isAddress(addrRaw)) {
        throw new Error("Invalid recipient for trusted contact");
      }
      const chain = String(pending.params.chain ?? "base").trim().toLowerCase();
      const addr = ethers.getAddress(addrRaw);
      this.pendingTrustAfterTx.set(requestId, { address: addr, name, chain });
      console.log(`[signing-engine] pending trusted contact after success for ${requestId} → ${name} / ${addr}`);
    }

    try {
      console.log(`[signing-engine] signDirectly START requestId=${requestId} method=${pending.method}`);
      const result = await this.signDirectly(pending.method, pending.params, pending.estimatedUSD, requestId, false);
      console.log(`[signing-engine] signDirectly OK requestId=${requestId}`);
      pending.resolve(result);
    } catch (err) {
      this.pendingTrustAfterTx.delete(requestId);
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
    this.pendingTrustAfterTx.delete(requestId);

    // Record rejection
    if (this.signingHistory) {
      this.signingHistory.addRecord({
        requestId,
        type: "rejected",
        method: pending.method,
        to: extractRecipientForTrust(pending.params) || (pending.params.to as string) || "",
        value: (pending.params.value as string) || "0",
        token: (pending.params.token as string) || "ETH",
        chain: (pending.params.chain as string) || "unknown",
        estimatedUSD: pending.estimatedUSD,
      });
    }

    pending.reject(new Error("Transaction rejected by user"));
  }

  /**
   * After on-chain success: upsert trusted contact if user opted in. Returns payload for Agent mirror.
   */
  applyPostTxTrust(
    requestId: string,
    success: boolean,
  ): { name: string; address: string; chain: string; trusted: boolean } | null {
    const pend = this.pendingTrustAfterTx.get(requestId);
    if (!pend) return null;
    this.pendingTrustAfterTx.delete(requestId);
    if (!success || !this.authorityStore) return null;
    try {
      const row = this.authorityStore.upsertContact(pend.name, pend.chain, pend.address, {
        trusted: true,
      });
      console.log(`[signing-engine] trusted contact after successful tx: ${row.name} ${row.address}`);
      return {
        name: row.name,
        address: row.address,
        chain: row.chain,
        trusted: true,
      };
    } catch (e) {
      console.error(`[signing-engine] applyPostTxTrust failed:`, (e as Error).message);
      return null;
    }
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
    const recipient = extractRecipientForTrust(params);
    const counterparty = recipient || to;
    const chain = String(params.chain ?? "unknown")
      .trim()
      .toLowerCase();
    /** Silent-sign eligibility: counterparty must be allow-listed as trusted for this chain (not merely a normal contact). */
    const cp = typeof counterparty === "string" ? counterparty.trim() : "";
    if (cp.length > 0 && /^0x[a-fA-F0-9]{40}$/i.test(cp)) {
      const trusted = this.authorityStore
        ? this.authorityStore.getTrustedRecipientKeys(this.allowance.addressWhitelist)
        : new Set(this.allowance.addressWhitelist.map((a) => `*:${a.trim().toLowerCase()}`));
      const a = cp.toLowerCase();
      const keyChain = `${chain}:${a}`;
      const keyAny = `*:${a}`;
      if (!trusted.has(keyChain) && !trusted.has(keyAny)) return false;
    }

    return true;
  }

  private async signDirectly(
    method: string,
    params: Record<string, unknown>,
    estimatedUSD: number,
    requestId?: string,
    isAutoApproved?: boolean,
  ): Promise<unknown> {
    const privateKey = this.keyManager.getPrivateKey();
    if (!privateKey) throw new Error("Wallet is locked");

    const wallet = new ethers.Wallet(privateKey);

    if (method === "sign_transaction") {
      const txParams = sanitizeTxParams(params);
      console.log(`[signing-engine] signTransaction with sanitized params:`, JSON.stringify(txParams, (_, v) => typeof v === "bigint" ? v.toString() : v));
      const signedTx = await wallet.signTransaction(txParams as any);
      this.dailyUsage.spentUSD += estimatedUSD;

      // Record signing decision
      if (this.signingHistory && requestId) {
        this.signingHistory.addRecord({
          requestId,
          type: isAutoApproved ? "auto" : "manual",
          method,
          to: extractRecipientForTrust(params) || (params.to as string) || "",
          value: (params.value as string) || "0",
          token: (params.token as string) || "ETH",
          chain: (params.chain as string) || "unknown",
          estimatedUSD,
        });
      }

      return { signedTx, address: wallet.address };
    }

    if (method === "sign_message") {
      const message = params.message as string;
      const signature = await wallet.signMessage(message);
      return { signature, address: wallet.address };
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
  "to", "value", "gas", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas",
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

/** Ethers v6 expects numeric tx type (0 legacy, 1 eip-2930, 2 eip-1559); strings like "legacy" throw. */
function normalizeTxType(t: unknown): number | undefined {
  if (t === undefined || t === null) return undefined;
  if (typeof t === "number" && [0, 1, 2].includes(t)) return t;
  if (typeof t === "bigint") {
    const n = Number(t);
    return [0, 1, 2].includes(n) ? n : undefined;
  }
  if (typeof t === "string") {
    const s = t.trim().toLowerCase();
    if (s === "legacy" || s === "0") return 0;
    if (s === "eip2930" || s === "eip-2930" || s === "1") return 1;
    if (s === "eip1559" || s === "eip-1559" || s === "2") return 2;
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

  const bigintFields = [
    "value",
    "gas",
    "gasLimit",
    "gasPrice",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "nonce",
  ];
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

  // ethers v6 TransactionRequest uses gasLimit; JSON-RPC / agent often send "gas"
  if (tx.gas !== undefined) {
    if (tx.gasLimit === undefined) {
      tx.gasLimit = tx.gas;
    }
    delete tx.gas;
  }

  const normalizedType = normalizeTxType(tx.type);
  if (normalizedType !== undefined) {
    tx.type = normalizedType;
  } else if (tx.type !== undefined) {
    delete tx.type;
  }

  if (!tx.type && !tx.maxFeePerGas && !tx.accessList && !tx.blobs && !tx.authorizationList) {
    if (tx.gasPrice) {
      tx.type = 0;
    } else {
      tx.type = 0;
      if (!tx.gasPrice) tx.gasPrice = 1000000000n;
    }
  }

  return tx;
}

/** Prefer explicit human recipient (e.g. ERC20 transfer) over contract `to`. */
export function extractRecipientForTrust(params: Record<string, unknown>): string {
  const r = params.recipient;
  if (typeof r === "string" && r.startsWith("0x")) return r.trim();
  const t = params.to;
  if (typeof t === "string") return t.trim();
  return "";
}
