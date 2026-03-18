import { readFile } from "node:fs/promises";
import type { Address } from "viem";
import { secureWriteFile } from "../validation.js";

export interface AllowancePolicy {
  maxPerTxUsd: number;
  maxDailyUsd: number;
  allowedTokens: string[];
  allowedRecipients: Address[];
  enabled: boolean;
}

export interface AllowanceCheckResult {
  level: 0 | 1 | 2;
  reason?: string;
}

interface SpendingRecord {
  amountCents: number;
  timestamp: number;
}

const LEVEL1_MAX_USD = 1000;

export function defaultAllowancePolicy(): AllowancePolicy {
  return {
    maxPerTxUsd: 100,
    maxDailyUsd: 500,
    allowedTokens: ["ETH", "USDC", "USDT"],
    allowedRecipients: [],
    enabled: true,
  };
}

export class AllowanceManager {
  private policy: AllowancePolicy;
  private spending: SpendingRecord[] = [];
  private filePath: string;

  constructor(filePath: string, policy?: AllowancePolicy) {
    this.filePath = filePath;
    this.policy = policy ?? defaultAllowancePolicy();
  }

  getPolicy(): AllowancePolicy {
    return { ...this.policy };
  }

  setPolicy(policy: AllowancePolicy): void {
    this.policy = { ...policy };
  }

  checkTransaction(amountUsd: number, token: string, recipient: Address): AllowanceCheckResult {
    if (!this.policy.enabled) {
      return { level: 1, reason: "Allowance disabled" };
    }

    const amountCents = Math.round(amountUsd * 100);
    const perTxCents = Math.round(this.policy.maxPerTxUsd * 100);
    const dailyCents = Math.round(this.policy.maxDailyUsd * 100);

    if (amountCents > perTxCents) {
      return amountUsd > LEVEL1_MAX_USD
        ? { level: 2, reason: `Amount $${amountUsd} exceeds per-tx limit $${this.policy.maxPerTxUsd} (large)` }
        : { level: 1, reason: `Amount $${amountUsd} exceeds per-tx limit $${this.policy.maxPerTxUsd}` };
    }

    const tokenAllowed = this.policy.allowedTokens.some(
      (t) => t.toLowerCase() === token.toLowerCase()
    );
    if (!tokenAllowed) {
      return { level: 1, reason: `Token ${token} not in allowed list` };
    }

    if (this.policy.allowedRecipients.length > 0) {
      const recipientAllowed = this.policy.allowedRecipients.some(
        (a) => a.toLowerCase() === recipient.toLowerCase()
      );
      if (!recipientAllowed) {
        return { level: 1, reason: `Recipient ${recipient} not in allowed list` };
      }
    }

    const dailyTotalCents = this.getDailyTotalCents();
    if (dailyTotalCents + amountCents > dailyCents) {
      return { level: 1, reason: `Daily total would exceed $${this.policy.maxDailyUsd}` };
    }

    return { level: 0 };
  }

  recordSpending(amountUsd: number): void {
    this.spending.push({
      amountCents: Math.round(amountUsd * 100),
      timestamp: Date.now(),
    });
  }

  private getDailyTotalCents(): number {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.spending = this.spending.filter((s) => s.timestamp > cutoff);
    return this.spending.reduce((sum, s) => sum + s.amountCents, 0);
  }

  getDailyTotalUsd(): number {
    return this.getDailyTotalCents() / 100;
  }

  async save(): Promise<void> {
    const data = { policy: this.policy, spending: this.spending };
    await secureWriteFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      const data = JSON.parse(content);
      if (data.policy) this.policy = data.policy;
      if (data.spending) this.spending = data.spending;
    } catch {
      // Use defaults
    }
  }
}
