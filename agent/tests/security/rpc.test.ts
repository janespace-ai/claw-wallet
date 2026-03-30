import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { ChainAdapter } from "../../src/chain.js";

/**
 * Mock JSON-RPC (no public internet) so CI/sandbox stays deterministic and fast.
 */
function startMockJsonRpc(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 404;
        res.end();
        return;
      }
      let buf = "";
      req.on("data", (c) => {
        buf += c;
      });
      req.on("end", () => {
        let parsed: { id?: number | string; method?: string };
        try {
          parsed = JSON.parse(buf || "{}");
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        const id = parsed.id ?? 0;
        const method = parsed.method ?? "";

        res.setHeader("content-type", "application/json");

        if (method === "eth_sendRawTransaction") {
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: { code: -32000, message: "invalid raw tx (mock)" },
            }),
          );
          return;
        }

        let result: string;
        switch (method) {
          case "eth_chainId":
            result = "0x1";
            break;
          case "eth_getBalance":
            result = "0xde0b6b3a7640000";
            break;
          case "eth_gasPrice":
            result = "0x3b9aca00";
            break;
          case "eth_estimateGas":
            result = "0x5208";
            break;
          case "eth_blockNumber":
            result = "0x100";
            break;
          case "eth_getBlockByNumber":
          case "eth_syncing":
            result = "0x0";
            break;
          default:
            result = "0x";
        }

        res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr == null || typeof addr === "string") {
        reject(new Error("invalid listen address"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((r, rej) => {
            server.close((e) => (e ? rej(e) : r()));
          }),
      });
    });
    server.on("error", reject);
  });
}

describe("security-rpc", () => {
  let mockUrl: string;
  let closeMock: () => Promise<void>;

  beforeAll(async () => {
    const s = await startMockJsonRpc();
    mockUrl = s.url;
    closeMock = s.close;
  });

  afterAll(async () => {
    await closeMock();
  });

  describe("balance handling", () => {
    it("getBalance returns BigInt without throwing for valid response", async () => {
      const adapter = new ChainAdapter({
        ethereum: { chain: mainnet, rpcUrl: mockUrl },
      });
      const addr = "0x0000000000000000000000000000000000000001" as Address;
      const result = await adapter.getBalance(addr, "ethereum");
      expect(typeof result.wei).toBe("bigint");
      expect(result.wei >= 0n).toBe(true);
    });
  });

  describe("gas sanity", () => {
    it("estimateGas returns reasonable value for simple transfer", async () => {
      const adapter = new ChainAdapter({
        ethereum: { chain: mainnet, rpcUrl: mockUrl },
      });
      const to = "0x0000000000000000000000000000000000000002" as Address;
      const est = await adapter.estimateGas({ to, value: 1n }, "ethereum");
      expect(est.gas > 0n).toBe(true);
      expect(est.gas < 30_000_000n).toBe(true);
    });
  });

  describe("error messages", () => {
    it("broadcast failure does not expose private key", async () => {
      const adapter = new ChainAdapter({
        ethereum: { chain: mainnet, rpcUrl: mockUrl },
      });
      const invalidTxHex = "0x00" as `0x${string}`;
      try {
        await adapter.broadcastTransaction(invalidTxHex, "ethereum");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toMatch(/[0-9a-f]{64}/);
      }
    });
  });
});
