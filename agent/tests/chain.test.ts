import { describe, it, expect } from "vitest";
import { ChainAdapter } from "../src/chain.js";
import { base } from "viem/chains";
import type { Address } from "viem";

describe("ChainAdapter", () => {
  describe("constructor", () => {
    it("creates adapter with default chains", () => {
      const adapter = new ChainAdapter();
      expect(adapter.getSupportedChains()).toContain("base");
      expect(adapter.getSupportedChains()).toContain("ethereum");
    });

    it("creates adapter with custom RPC", () => {
      const adapter = new ChainAdapter({
        base: { chain: base, rpcUrl: "https://custom-rpc.com" },
      });
      expect(adapter.getSupportedChains()).toContain("base");
    });
  });

  describe("getClient", () => {
    it("returns a client for supported chains", () => {
      const adapter = new ChainAdapter();
      const client = adapter.getClient("base");
      expect(client).toBeDefined();
    });

    it("caches clients", () => {
      const adapter = new ChainAdapter();
      const c1 = adapter.getClient("base");
      const c2 = adapter.getClient("base");
      expect(c1).toBe(c2);
    });

    it("throws for unsupported chain", () => {
      const adapter = new ChainAdapter();
      expect(() => adapter.getClient("solana" as any)).toThrow("Unsupported chain");
    });
  });

  describe("getChain", () => {
    it("returns chain config for base", () => {
      const adapter = new ChainAdapter();
      const chain = adapter.getChain("base");
      expect(chain.id).toBe(8453);
      expect(chain.name).toBe("Base");
    });

    it("returns chain config for ethereum", () => {
      const adapter = new ChainAdapter();
      const chain = adapter.getChain("ethereum");
      expect(chain.id).toBe(1);
    });
  });

  describe("buildERC20TransferData", () => {
    it("builds valid transfer calldata", () => {
      const adapter = new ChainAdapter();
      const to = "0x1234567890abcdef1234567890abcdef12345678" as Address;
      const amount = BigInt("1000000");

      const data = adapter.buildERC20TransferData(to, amount);
      expect(data).toMatch(/^0xa9059cbb/);
      expect(data.length).toBe(2 + 8 + 64 + 64);
    });
  });
});
