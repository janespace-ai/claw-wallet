/**
 * Integration tests: account-scoped SQLite queries after full `DatabaseService` migrations.
 * Complements `data-isolation.test.ts` (minimal schema) by exercising the real v1→v5 path.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseService } from "./database-service.js";
import { SigningHistory } from "./signing-history.js";
import { WalletAuthorityStore } from "./wallet-authority-store.js";

describe("Account-scoped queries (DatabaseService migrations)", () => {
  let dbPath: string;
  let dbService: DatabaseService;
  let signingHistory: SigningHistory;
  let authorityStore: WalletAuthorityStore;

  beforeEach(() => {
    DatabaseService.resetInstanceForTests();
    dbPath = path.join(os.tmpdir(), `wallet-account-scope-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    dbService = DatabaseService.getInstance(dbPath);
    const ver = dbService.getDatabase().pragma("user_version", { simple: true }) as number;
    expect(ver).toBe(5);

    signingHistory = new SigningHistory(dbService);
    authorityStore = new WalletAuthorityStore(dbService);
  });

  afterEach(() => {
    DatabaseService.resetInstanceForTests();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
    const wal = `${dbPath}-wal`;
    const shm = `${dbPath}-shm`;
    try {
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      /* ignore */
    }
  });

  it("keeps signing_history rows isolated with 120+ records across accounts", () => {
    const perAccount = [40, 50, 30];
    for (let acc = 0; acc < perAccount.length; acc++) {
      for (let i = 0; i < perAccount[acc]; i++) {
        signingHistory.addRecord({
          requestId: `req-a${acc}-n${i}`,
          type: "manual",
          method: "sign_transaction",
          to: `0x${String(acc).repeat(2)}${String(i).padStart(38, "0")}`,
          value: "1",
          token: "ETH",
          chain: "ethereum",
          estimatedUSD: 1,
          accountIndex: acc,
        });
      }
    }

    expect(signingHistory.getRecordCount(0)).toBe(40);
    expect(signingHistory.getRecordCount(1)).toBe(50);
    expect(signingHistory.getRecordCount(2)).toBe(30);
    expect(signingHistory.getRecordCount(3)).toBe(0);

    const r0 = signingHistory.getRecordByRequestId("req-a1-n0", 1);
    expect(r0).not.toBeNull();
    expect(r0!.tx_to?.startsWith("0x11")).toBe(true);
    expect(signingHistory.getRecordByRequestId("req-a1-n0", 0)).toBeNull();

    expect(signingHistory.findAccountIndexByRequestId("req-a2-n5")).toBe(2);
  });

  it("scopes getRecordsByStatus and pending lists per account", () => {
    signingHistory.addRecord({
      requestId: "pend-0",
      type: "manual",
      method: "sign_transaction",
      to: "0x1111111111111111111111111111111111111111",
      value: "1",
      token: "ETH",
      chain: "ethereum",
      estimatedUSD: 1,
      accountIndex: 0,
    });
    signingHistory.updateTxHash("pend-0", "0xaaa0000000000000000000000000000000000000000000000000000000000aaa", 0);

    signingHistory.addRecord({
      requestId: "ok-1",
      type: "manual",
      method: "sign_transaction",
      to: "0x2222222222222222222222222222222222222222",
      value: "1",
      token: "ETH",
      chain: "ethereum",
      estimatedUSD: 1,
      accountIndex: 1,
    });

    const pending0 = signingHistory.getPendingTransactions(0);
    expect(pending0).toHaveLength(1);
    expect(pending0[0].request_id).toBe("pend-0");

    expect(signingHistory.getPendingTransactions(1)).toHaveLength(0);

    const pendingStatus = signingHistory.getRecordsByStatus(0, "pending");
    expect(pendingStatus.some((r) => r.request_id === "pend-0")).toBe(true);
    expect(signingHistory.getRecordsByStatus(1, "pending")).toHaveLength(0);
  });

  it("scopes WalletAuthorityStore contacts under real migrated schema (global unique names)", () => {
    authorityStore.upsertContact(0, "PartnerA0", "ethereum", "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { trusted: true });
    authorityStore.upsertContact(1, "PartnerB1", "ethereum", "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", {});

    expect(authorityStore.listContacts(0)).toHaveLength(1);
    expect(authorityStore.listContacts(1)).toHaveLength(1);
    expect(authorityStore.listContacts(0)[0].name).toBe("PartnerA0");
    expect(authorityStore.listContacts(1)[0].name).toBe("PartnerB1");

    expect(
      authorityStore.isTrustedRecipientForChain(0, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "ethereum"),
    ).toBe(true);
    expect(
      authorityStore.isTrustedRecipientForChain(1, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "ethereum"),
    ).toBe(false);
  });
});
