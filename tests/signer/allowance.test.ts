import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { getAddress } from "viem";
import { AllowanceManager, defaultAllowancePolicy } from "../../src/signer/allowance.js";
import type { Address } from "viem";

describe("Allowance security", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-sec-allowance-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const addr = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") as Address;

  it("auto-approves within per-tx and daily limits", () => {
    const mgr = new AllowanceManager(join(tempDir, "a.json"));
    const result = mgr.checkTransaction(50, "ETH", addr);
    expect(result.level).toBe(0);
  });

  it("escalates when per-tx limit exceeded", () => {
    const mgr = new AllowanceManager(join(tempDir, "a.json"));
    const result = mgr.checkTransaction(150, "ETH", addr);
    expect(result.level).toBeGreaterThan(0);
  });

  it("escalates when daily limit would be exceeded", () => {
    const mgr = new AllowanceManager(join(tempDir, "a.json"));
    for (let i = 0; i < 5; i++) {
      mgr.checkTransaction(90, "ETH", addr);
      mgr.recordSpending(90);
    }
    const result = mgr.checkTransaction(90, "ETH", addr);
    expect(result.level).toBeGreaterThan(0);
  });

  it("daily accumulation uses integer cents precision", () => {
    const mgr = new AllowanceManager(join(tempDir, "a.json"), {
      ...defaultAllowancePolicy(),
      maxDailyUsd: 1,
    });
    mgr.checkTransaction(0.1, "ETH", addr);
    mgr.recordSpending(0.1);
    mgr.checkTransaction(0.2, "ETH", addr);
    mgr.recordSpending(0.2);
    const result = mgr.checkTransaction(0.69, "ETH", addr);
    expect(result.level).toBe(0);
    mgr.recordSpending(0.69);
    const over = mgr.checkTransaction(0.02, "ETH", addr);
    expect(over.level).toBeGreaterThan(0);
  });

  it("unknown token escalates", () => {
    const mgr = new AllowanceManager(join(tempDir, "a.json"));
    const result = mgr.checkTransaction(10, "SHIB", addr);
    expect(result.level).toBeGreaterThan(0);
  });

  it("persists and restores", async () => {
    const path = join(tempDir, "a.json");
    const mgr1 = new AllowanceManager(path);
    mgr1.recordSpending(100);
    await mgr1.save();

    const mgr2 = new AllowanceManager(path);
    await mgr2.load();
    expect(mgr2.getDailyTotalUsd()).toBe(100);
  });
});
