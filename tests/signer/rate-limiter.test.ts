import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { RateLimiter } from "../../src/signer/rate-limiter.js";

describe("rate-limiter", () => {
  let tempDir: string;
  let limiter: RateLimiter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "rate-limiter-test-"));
    limiter = new RateLimiter(tempDir);
    await limiter.load();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("allows first attempt", () => {
    const check = limiter.checkRateLimit();
    expect(check.allowed).toBe(true);
    expect(check.waitMs).toBe(0);
  });

  it("allows attempts for failures 1-3 (no delay)", async () => {
    for (let i = 0; i < 3; i++) {
      await limiter.recordFailure();
    }
    const check = limiter.checkRateLimit();
    expect(check.allowed).toBe(true);
  });

  it("enforces delay after failure 4", async () => {
    for (let i = 0; i < 4; i++) {
      await limiter.recordFailure();
    }
    const check = limiter.checkRateLimit();
    expect(check.allowed).toBe(false);
    expect(check.waitMs).toBeGreaterThan(0);
    expect(check.waitMs).toBeLessThanOrEqual(30_000);
  });

  it("enforces longer delay after failure 6", async () => {
    for (let i = 0; i < 6; i++) {
      await limiter.recordFailure();
    }
    const check = limiter.checkRateLimit();
    expect(check.allowed).toBe(false);
    expect(check.waitMs).toBeGreaterThan(0);
    expect(check.waitMs).toBeLessThanOrEqual(300_000);
  });

  it("lockout after >10 failures", async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.recordFailure();
    }
    expect(limiter.getFailureCount()).toBe(10);
    const result = await limiter.recordFailure();
    expect(result.lockout).toBe(true);
    expect(result.failureCount).toBe(11);

    const check = limiter.checkRateLimit();
    expect(check.allowed).toBe(false);
    expect(check.message).toContain("Rate limited");
  });

  it("resets counter on success", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.recordFailure();
    }
    await limiter.recordSuccess();
    expect(limiter.getFailureCount()).toBe(0);
    const check = limiter.checkRateLimit();
    expect(check.allowed).toBe(true);
  });

  it("persists and restores state across instances", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.recordFailure();
    }
    const limiter2 = new RateLimiter(tempDir);
    await limiter2.load();
    expect(limiter2.getFailureCount()).toBe(5);
  });

  it("resets expired lockout on load", async () => {
    for (let i = 0; i < 11; i++) {
      await limiter.recordFailure();
    }
    // Manually expire the lockout by writing a past timestamp
    const { readFile, writeFile } = await import("node:fs/promises");
    const filePath = join(tempDir, "rate-limit.json");
    const state = JSON.parse(await readFile(filePath, "utf-8"));
    state.lockoutUntil = Date.now() - 1000;
    await writeFile(filePath, JSON.stringify(state));

    const limiter2 = new RateLimiter(tempDir);
    await limiter2.load();
    expect(limiter2.getFailureCount()).toBe(0);
    const check = limiter2.checkRateLimit();
    expect(check.allowed).toBe(true);
  });
});
