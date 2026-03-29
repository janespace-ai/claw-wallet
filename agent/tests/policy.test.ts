import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { PolicyEngine, createDefaultPolicy } from "../src/policy.js";
import { agentConfig } from "../src/config.js";
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
    it("returns defaults aligned with agent config", () => {
      const policy = createDefaultPolicy();
      expect(policy.perTransactionLimitUsd).toBe(agentConfig.policy.perTxLimitUsd);
      expect(policy.dailyLimitUsd).toBe(agentConfig.policy.dailyLimitUsd);
      expect(policy.mode).toBe(agentConfig.policy.mode);
    });
  });

  describe("checkTransaction", () => {
    it("allows transaction within limits (any recipient)", () => {
      engine.updateConfig({ mode: "supervised" });
      const result = engine.checkTransaction(ADDR_A, 50, "USDC", "base");
      expect(result.allowed).toBe(true);
    });

    it("allows supervised mode to any address within limits", () => {
      engine.updateConfig({ mode: "supervised" });
      const result = engine.checkTransaction(ADDR_B, 10, "USDC", "base");
      expect(result.allowed).toBe(true);
    });

    it("allows autonomous mode within limits", () => {
      engine.updateConfig({ mode: "autonomous" });
      const result = engine.checkTransaction(ADDR_B, 10, "USDC", "base");
      expect(result.allowed).toBe(true);
    });

    it("blocks transaction exceeding per-tx limit", () => {
      engine.updateConfig({ perTransactionLimitUsd: 100, dailyLimitUsd: 500, mode: "supervised" });
      const result = engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("per-transaction limit");
    });

    it("blocks transaction exceeding daily limit", () => {
      engine.updateConfig({ perTransactionLimitUsd: 300, dailyLimitUsd: 500 });
      engine.checkTransaction(ADDR_A, 250, "USDC", "base");
      engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      const result = engine.checkTransaction(ADDR_A, 100, "USDC", "base");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("daily limit");
    });
  });

  describe("approval queue", () => {
    it("approve returns the pending tx", () => {
      engine.updateConfig({ perTransactionLimitUsd: 100, dailyLimitUsd: 500, mode: "supervised" });
      const check = engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      expect(check.approvalId).toBeDefined();

      const approved = engine.approve(check.approvalId!);
      expect(approved).not.toBeNull();
      expect(approved!.amount).toBe("200");
    });

    it("reject removes from queue", () => {
      engine.updateConfig({ perTransactionLimitUsd: 100, dailyLimitUsd: 500, mode: "supervised" });
      const check = engine.checkTransaction(ADDR_A, 200, "USDC", "base");
      engine.reject(check.approvalId!);
      expect(engine.listPending()).toHaveLength(0);
    });

    it("listPending returns all pending", () => {
      engine.updateConfig({
        perTransactionLimitUsd: 100,
        dailyLimitUsd: 5000,
        mode: "supervised",
      });
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

    it("ignores legacy whitelist field on load", async () => {
      const fs = await import("node:fs/promises");
      const legacy = {
        config: {
          perTransactionLimitUsd: 100,
          dailyLimitUsd: 500,
          mode: "supervised",
          whitelist: [ADDR_A],
        },
        approvalQueue: [],
        dailySpending: [],
      };
      await fs.writeFile(join(tempDir, "policy.json"), JSON.stringify(legacy), "utf-8");

      const loaded = new PolicyEngine(join(tempDir, "policy.json"));
      await loaded.load();
      expect(loaded.getConfig().perTransactionLimitUsd).toBe(100);
      expect("whitelist" in loaded.getConfig()).toBe(false);
    });
  });
});
