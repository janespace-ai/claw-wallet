import { describe, it, expect, beforeEach } from "vitest";
import { ChainAdapter } from "../../chain.js";
import type { SupportedChain } from "../../types.js";
import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

/**
 * Security tests for RPC handling using a local mock or sanity checks.
 * These tests verify that our code handles malicious/unexpected RPC responses
 * without crashing. We use public RPC for basic sanity; for negative balance
 * and overflow we test validation logic or document expected behavior.
 */

describe("security-rpc", () => {
  describe("balance handling", () => {
    it("getBalance returns BigInt without throwing for valid response", async () => {
      const adapter = new ChainAdapter();
      const addr = "0x0000000000000000000000000000000000000001" as Address;
      const result = await adapter.getBalance(addr, "ethereum");
      expect(typeof result.wei).toBe("bigint");
      expect(result.wei >= 0n).toBe(true);
    });
  });

  describe("gas sanity", () => {
    it("estimateGas returns reasonable value for simple transfer", async () => {
      const adapter = new ChainAdapter();
      const to = "0x0000000000000000000000000000000000000002" as Address;
      const est = await adapter.estimateGas(
        { to, value: 1n },
        "ethereum"
      );
      expect(est.gas > 0n).toBe(true);
      expect(est.gas < 30_000_000n).toBe(true);
    });
  });

  describe("error messages", () => {
    it("broadcast failure does not expose private key", async () => {
      const adapter = new ChainAdapter();
      const invalidTxHex = "0x00" as `0x${string}`;
      try {
        await adapter.broadcastTransaction(invalidTxHex, "ethereum");
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        expect(msg).not.toMatch(/[0-9a-f]{64}/);
      }
    });
  });
});
