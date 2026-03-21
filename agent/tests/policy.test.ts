import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { PolicyEngine, createDefaultPolicy } from "../src/policy.js";
import type { Address } from "viem";

const ADDR_A = "0x1111111111111111111111111111111111111111" as Address;
const ADDR_B = "0x2222222222222222222222222222222222222222" as Address;

describe("PolicyEngine", () => {
  let tempDir: string;
  let engine: PolicyEngine;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-policy-test-"));
    engine = new PolicyEngine(join(tempDir, "policy.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createDefaultPolicy", () => {
    it("returns sensible defaults", () => {
      const policy = createDefaultPolicy();
      expect(policy.perTransactionLimitUsd).toBe(100);
      expect(policy.dailyLimitUsd).toBe(500);
      expect(policy.whitelist).toEqual([]);
      expect(policy.mode).toBe("supervised");
    });
  });

  describe("checkTransaction", () => {
    it("allows transaction within limits to whitelisted address", () => {
      engine.updateConfig({ whitelist: [ADDR_A], mode: "supervised" });
      const result = engine.checkTransaction(ADDR_A, 50, "USDC", "base");
      expect(result.allowed).toBe(true);
    });

    it("blocks transaction exceeding per-tx limit", () => {
      engine.updateConfig({ whitelist: [ADDR_A] });
      const result = engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("per-transaction limit");
    });

    it("blocks transaction exceeding daily limit", () => {
      engine.updateConfig({ whitelist: [ADDR_A], perTransactionLimitUsd: 300, dailyLimitUsd: 500 });
      engine.checkTransaction(ADDR_A, 250, "USDC", "base");
      engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      const result = engine.checkTransaction(ADDR_A, 100, "USDC", "base");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("daily limit");
    });

    it("blocks non-whitelisted address in supervised mode", () => {
      engine.updateConfig({ mode: "supervised" });
      const result = engine.checkTransaction(ADDR_B, 10, "USDC", "base");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not whitelisted");
    });

    it("allows non-whitelisted address in autonomous mode within limits", () => {
      engine.updateConfig({ mode: "autonomous" });
      const result = engine.checkTransaction(ADDR_B, 10, "USDC", "base");
      expect(result.allowed).toBe(true);
    });
  });

  describe("approval queue", () => {
    it("approve returns the pending tx", () => {
      engine.updateConfig({ whitelist: [ADDR_A] });
      const check = engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      expect(check.approvalId).toBeDefined();

      const approved = engine.approve(check.approvalId!);
      expect(approved).not.toBeNull();
      expect(approved!.amount).toBe("200");
    });

    it("reject removes from queue", () => {
      engine.updateConfig({ whitelist: [ADDR_A] });
      const check = engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      engine.reject(check.approvalId!);
      expect(engine.listPending()).toHaveLength(0);
    });

    it("listPending returns all pending", () => {
      engine.updateConfig({ whitelist: [ADDR_A] });
      engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      engine.checkTransaction(ADDR_A, 300, "ETH", "base");
      expect(engine.listPending()).toHaveLength(2);
    });
  });

  describe("save / load", () => {
    it("persists and restores policy state", async () => {
      engine.updateConfig({ perTransactionLimitUsd: 999, mode: "autonomous" });
      await engine.save();

      const loaded = new PolicyEngine(join(tempDir, "policy.json"));
      await loaded.load();
      expect(loaded.getConfig().perTransactionLimitUsd).toBe(999);
      expect(loaded.getConfig().mode).toBe("autonomous");
    });
  });
});
