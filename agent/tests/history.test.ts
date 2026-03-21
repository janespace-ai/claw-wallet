import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { TransactionHistory } from "../src/history.js";
import type { TxRecord } from "../src/types.js";
import type { Hex, Address } from "viem";

function makeTx(overrides: Partial<TxRecord> = {}): TxRecord {
  return {
    hash: "0xabc123" as Hex,
    direction: "sent",
    from: "0x1111111111111111111111111111111111111111" as Address,
    to: "0x2222222222222222222222222222222222222222" as Address,
    amount: "100",
    token: "USDC",
    chain: "base",
    status: "confirmed",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("TransactionHistory", () => {
  let tempDir: string;
  let history: TransactionHistory;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-history-test-"));
    history = new TransactionHistory(join(tempDir, "history.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("addRecord / getHistory", () => {
    it("adds and retrieves records", () => {
      history.addRecord(makeTx({ hash: "0x001" as Hex }));
      history.addRecord(makeTx({ hash: "0x002" as Hex }));
      const records = history.getHistory();
      expect(records).toHaveLength(2);
      expect(records[0].hash).toBe("0x002");
    });

    it("respects limit and offset", () => {
      for (let i = 0; i < 10; i++) {
        history.addRecord(makeTx({ hash: `0x${i.toString().padStart(3, "0")}` as Hex }));
      }
      const page = history.getHistory(3, 2);
      expect(page).toHaveLength(3);
    });
  });

  describe("getByHash", () => {
    it("finds transaction by hash", () => {
      history.addRecord(makeTx({ hash: "0xfind_me" as Hex }));
      expect(history.getByHash("0xfind_me")).toBeDefined();
      expect(history.getByHash("0xnot_here")).toBeUndefined();
    });
  });

  describe("save / load", () => {
    it("persists and restores with bigint conversion", async () => {
      history.addRecord(makeTx({
        hash: "0xpersist" as Hex,
        blockNumber: 12345n,
        gasUsed: 21000n,
      }));
      await history.save();

      const loaded = new TransactionHistory(join(tempDir, "history.json"));
      await loaded.load();
      const records = loaded.getHistory();
      expect(records).toHaveLength(1);
      expect(records[0].blockNumber).toBe(12345n);
      expect(records[0].gasUsed).toBe(21000n);
    });
  });
});
