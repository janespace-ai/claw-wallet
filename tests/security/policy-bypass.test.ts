import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { getAddress } from "viem";
import { PolicyEngine, createDefaultPolicy } from "../../agent/policy.js";

describe("security-policy-bypass", () => {
  let tempDir: string;
  let policy: PolicyEngine;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-sec-policy-"));
    policy = new PolicyEngine(join(tempDir, "policy.json"), {
      ...createDefaultPolicy(),
      perTransactionLimitUsd: 100,
      dailyLimitUsd: 500,
      whitelist: [],
      mode: "supervised",
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const addr = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

  describe("floating-point precision", () => {
    it("many small transactions are accumulated and block at daily limit", () => {
      const limit = 500;
      policy = new PolicyEngine(join(tempDir, "p.json"), {
        perTransactionLimitUsd: 1000,
        dailyLimitUsd: limit,
        whitelist: [addr],
        mode: "supervised",
      });
      const amount = 0.51;
      let allowed = 0;
      for (let i = 0; i < 1000; i++) {
        const r = policy.checkTransaction(addr, amount, "ETH", "base");
        if (r.allowed) allowed++;
        else break;
      }
      expect(allowed).toBeLessThan(1000);
      expect(allowed * 0.51).toBeLessThanOrEqual(limit + 0.02);
    });

    it("0.1 + 0.2 cumulative is exactly 0.3 (integer cents)", () => {
      policy = new PolicyEngine(join(tempDir, "p.json"), {
        perTransactionLimitUsd: 1,
        dailyLimitUsd: 1,
        whitelist: [addr],
        mode: "supervised",
      });
      policy.checkTransaction(addr, 0.1, "ETH", "base");
      const r2 = policy.checkTransaction(addr, 0.2, "ETH", "base");
      expect(r2.allowed).toBe(true);
      const r3 = policy.checkTransaction(addr, 0.71, "ETH", "base");
      expect(r3.allowed).toBe(false);
    });
  });

  describe("approval ID", () => {
    it("100 approval IDs are unique and not sequential", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const r = policy.checkTransaction(addr, 150, "ETH", "base");
        expect(r.approvalId).toBeDefined();
        ids.add(r.approvalId!);
      }
      expect(ids.size).toBe(100);
      expect(ids.size).toBe(100);
    });

    it("approve with fabricated ID returns null and has no side effect", () => {
      policy.checkTransaction(addr, 150, "ETH", "base");
      const pendingBefore = policy.listPending().length;
      const result = policy.approve("deadbeef00000000");
      expect(result).toBeNull();
      expect(policy.listPending().length).toBe(pendingBefore);
    });
  });

  describe("whitelist case", () => {
    it("mixed-case address matches whitelist (case-insensitive)", () => {
      const mixed = getAddress("0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa");
      policy = new PolicyEngine(join(tempDir, "p.json"), {
        perTransactionLimitUsd: 100,
        dailyLimitUsd: 500,
        whitelist: [mixed],
        mode: "supervised",
      });
      const lower = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const r = policy.checkTransaction(getAddress(lower), 10, "ETH", "base");
      expect(r.allowed).toBe(true);
    });
  });

  describe("concurrent-style daily total", () => {
    it("two transactions both counted in daily total", () => {
      policy = new PolicyEngine(join(tempDir, "p.json"), {
        perTransactionLimitUsd: 100,
        dailyLimitUsd: 100,
        whitelist: [addr],
        mode: "supervised",
      });
      const r1 = policy.checkTransaction(addr, 60, "ETH", "base");
      const r2 = policy.checkTransaction(addr, 60, "ETH", "base");
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(false);
    });
  });
});
