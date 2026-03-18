import { readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { secureWriteFile } from "../validation.js";

interface RateLimitState {
  failureCount: number;
  lockoutUntil: number | null;
  lastFailureAt: number | null;
}

export interface RateLimitCheck {
  allowed: boolean;
  waitMs: number;
  message?: string;
}

const DELAY_TIERS: Array<{ maxFailures: number; delayMs: number }> = [
  { maxFailures: 3, delayMs: 0 },
  { maxFailures: 5, delayMs: 30_000 },
  { maxFailures: 10, delayMs: 300_000 },
];
const LOCKOUT_MS = 3_600_000;

export class RateLimiter {
  private state: RateLimitState = { failureCount: 0, lockoutUntil: null, lastFailureAt: null };
  private filePath: string;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, "rate-limit.json");
  }

  async load(): Promise<void> {
    try {
      await access(this.filePath);
      const data = JSON.parse(await readFile(this.filePath, "utf-8"));
      this.state = {
        failureCount: data.failureCount ?? 0,
        lockoutUntil: data.lockoutUntil ?? null,
        lastFailureAt: data.lastFailureAt ?? null,
      };
      if (this.state.lockoutUntil && Date.now() >= this.state.lockoutUntil) {
        this.state = { failureCount: 0, lockoutUntil: null, lastFailureAt: null };
        await this.save();
      }
    } catch {
      this.state = { failureCount: 0, lockoutUntil: null, lastFailureAt: null };
    }
  }

  async save(): Promise<void> {
    await secureWriteFile(this.filePath, JSON.stringify(this.state, null, 2));
  }

  checkRateLimit(): RateLimitCheck {
    const now = Date.now();

    if (this.state.lockoutUntil) {
      if (now < this.state.lockoutUntil) {
        const waitMs = this.state.lockoutUntil - now;
        return { allowed: false, waitMs, message: `Rate limited. Try again in ${Math.ceil(waitMs / 1000)} seconds` };
      }
      this.state = { failureCount: 0, lockoutUntil: null, lastFailureAt: null };
    }

    const delayMs = this.getDelayForCount(this.state.failureCount);
    if (delayMs > 0 && this.state.lastFailureAt) {
      const elapsed = now - this.state.lastFailureAt;
      if (elapsed < delayMs) {
        const waitMs = delayMs - elapsed;
        return { allowed: false, waitMs, message: `Rate limited. Try again in ${Math.ceil(waitMs / 1000)} seconds` };
      }
    }

    return { allowed: true, waitMs: 0 };
  }

  async recordFailure(): Promise<{ lockout: boolean; failureCount: number }> {
    this.state.failureCount += 1;
    this.state.lastFailureAt = Date.now();

    let lockout = false;
    if (this.state.failureCount > 10) {
      this.state.lockoutUntil = Date.now() + LOCKOUT_MS;
      lockout = true;
    }

    await this.save();
    return { lockout, failureCount: this.state.failureCount };
  }

  async recordSuccess(): Promise<void> {
    this.state = { failureCount: 0, lockoutUntil: null, lastFailureAt: null };
    await this.save();
  }

  getFailureCount(): number {
    return this.state.failureCount;
  }

  private getDelayForCount(count: number): number {
    for (let i = DELAY_TIERS.length - 1; i >= 0; i--) {
      if (count > DELAY_TIERS[i].maxFailures) {
        if (i + 1 < DELAY_TIERS.length) return DELAY_TIERS[i + 1].delayMs;
        return LOCKOUT_MS;
      }
    }
    return 0;
  }
}
