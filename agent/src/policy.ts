import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { Address } from "viem";
import type {
  PolicyConfig,
  PendingApproval,
  PolicyCheckResult,
  SupportedChain,
  TransactionRequest,
} from "./types.js";
import { secureWriteFile } from "./validation.js";
import { agentConfig } from "./config.js";

const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Amount in integer cents to avoid float precision issues. */
interface PolicyState {
  config: PolicyConfig;
  dailySpending: { amountCents: number; windowStart: number }[];
  approvalQueue: PendingApproval[];
}

export function createDefaultPolicy(): PolicyConfig {
  return {
    perTransactionLimitUsd: agentConfig.policy.perTxLimitUsd,
    dailyLimitUsd: agentConfig.policy.dailyLimitUsd,
    mode: agentConfig.policy.mode,
  };
}

export class PolicyEngine {
  private state: PolicyState;
  private filePath: string;

  constructor(filePath: string, config?: PolicyConfig) {
    this.filePath = filePath;
    this.state = {
      config: config ?? createDefaultPolicy(),
      dailySpending: [],
      approvalQueue: [],
    };
  }

  getConfig(): PolicyConfig {
    return { ...this.state.config };
  }

  updateConfig(updates: Partial<PolicyConfig>): void {
    this.state.config = { ...this.state.config, ...updates };
  }

  checkTransaction(
    to: Address,
    amountUsd: number,
    token: string,
    chain: SupportedChain,
    rawTx?: TransactionRequest
  ): PolicyCheckResult {
    const { config } = this.state;
    const amountCents = Math.round(amountUsd * 100);
    const perTxCents = Math.round(config.perTransactionLimitUsd * 100);
    const dailyLimitCents = Math.round(config.dailyLimitUsd * 100);

    if (amountCents > perTxCents) {
      const approval = this.addToQueue(to, amountUsd.toString(), token, chain, "Exceeds per-transaction limit", rawTx);
      return {
        allowed: false,
        reason: `Amount $${amountUsd} exceeds per-transaction limit of $${config.perTransactionLimitUsd}`,
        requiresApproval: true,
        approvalId: approval.id,
      };
    }

    const dailyTotalCents = this.getDailyTotalCents();
    if (dailyTotalCents + amountCents > dailyLimitCents) {
      const approval = this.addToQueue(to, amountUsd.toString(), token, chain, "Exceeds daily limit", rawTx);
      return {
        allowed: false,
        reason: `Daily total $${((dailyTotalCents + amountCents) / 100).toFixed(2)} would exceed daily limit of $${config.dailyLimitUsd}`,
        requiresApproval: true,
        approvalId: approval.id,
      };
    }

    // Trusted-address / signing policy is enforced in the desktop wallet. Agent policy only applies USD limits here.

    this.recordSpendingCents(amountCents);
    return { allowed: true };
  }

  private getDailyTotalCents(): number {
    const now = Date.now();
    const windowStart = now - 24 * 60 * 60 * 1000;
    this.state.dailySpending = this.state.dailySpending.filter(
      (s) => s.windowStart > windowStart
    );
    return this.state.dailySpending.reduce((sum, s) => sum + s.amountCents, 0);
  }

  private recordSpendingCents(amountCents: number): void {
    this.state.dailySpending.push({
      amountCents,
      windowStart: Date.now(),
    });
  }

  addToQueue(
    to: Address,
    amount: string,
    token: string,
    chain: SupportedChain,
    reason: string,
    rawTx?: TransactionRequest
  ): PendingApproval {
    const approval: PendingApproval = {
      id: randomBytes(8).toString("hex"),
      to,
      amount,
      token,
      chain,
      reason,
      createdAt: Date.now(),
      rawTx,
    };
    this.state.approvalQueue.push(approval);
    return approval;
  }

  approve(id: string): PendingApproval | null {
    const idx = this.state.approvalQueue.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const [approval] = this.state.approvalQueue.splice(idx, 1);
    const amountCents = Math.round(parseFloat(approval.amount) * 100);
    this.recordSpendingCents(amountCents);
    return approval;
  }

  reject(id: string): PendingApproval | null {
    const idx = this.state.approvalQueue.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const [approval] = this.state.approvalQueue.splice(idx, 1);
    return approval;
  }

  listPending(): PendingApproval[] {
    return [...this.state.approvalQueue];
  }

  autoExpire(): PendingApproval[] {
    const now = Date.now();
    const expired: PendingApproval[] = [];
    this.state.approvalQueue = this.state.approvalQueue.filter((a) => {
      if (now - a.createdAt > APPROVAL_TIMEOUT_MS) {
        expired.push(a);
        return false;
      }
      return true;
    });
    return expired;
  }

  async save(): Promise<void> {
    const data = {
      config: this.state.config,
      approvalQueue: this.state.approvalQueue,
      dailySpending: this.state.dailySpending.map((s) => ({ amountCents: s.amountCents, windowStart: s.windowStart })),
    };
    await secureWriteFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      const data = JSON.parse(content);
      if (data.config) {
        const c = data.config;
        this.state.config = {
          perTransactionLimitUsd:
            typeof c.perTransactionLimitUsd === "number"
              ? c.perTransactionLimitUsd
              : this.state.config.perTransactionLimitUsd,
          dailyLimitUsd:
            typeof c.dailyLimitUsd === "number" ? c.dailyLimitUsd : this.state.config.dailyLimitUsd,
          mode: c.mode === "autonomous" ? "autonomous" : "supervised",
        };
      }
      if (data.approvalQueue) this.state.approvalQueue = data.approvalQueue;
      if (data.dailySpending) {
        this.state.dailySpending = data.dailySpending.map((s: { amountCents?: number; amount?: number; windowStart: number }) => ({
          amountCents: s.amountCents ?? Math.round((s.amount ?? 0) * 100),
          windowStart: s.windowStart,
        }));
      }
    } catch {
      // File doesn't exist yet, use defaults
    }
  }
}
