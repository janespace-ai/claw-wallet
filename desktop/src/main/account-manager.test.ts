import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountManager } from "./account-manager.js";
import { DatabaseService } from "./database-service.js";

/** Standard dev mnemonic — do not use with real funds. */
const MNEMONIC = "test test test test test test test test test test test junk";

function canOpenSqliteNative(): boolean {
  try {
    const d = new Database(":memory:");
    d.close();
    return true;
  } catch {
    return false;
  }
}

const SQLITE_OK = canOpenSqliteNative();

describe.skipIf(!SQLITE_OK)("AccountManager", () => {
  let dbPath = "";

  beforeEach(() => {
    DatabaseService.resetInstanceForTests();
    const dir = join(tmpdir(), `claw-am-${randomBytes(8).toString("hex")}`);
    mkdirSync(dir, { recursive: true });
    dbPath = join(dir, "wallet.db");
  });

  afterEach(() => {
    DatabaseService.resetInstanceForTests();
    const dir = dirname(dbPath);
    if (dir && existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function manager(): AccountManager {
    const db = DatabaseService.getInstance(dbPath);
    return new AccountManager(db);
  }

  it("deriveAccount rejects indices outside 0–9", () => {
    const am = manager();
    expect(() => am.deriveAccount(MNEMONIC, -1)).toThrow(/0-9/);
    expect(() => am.deriveAccount(MNEMONIC, 10)).toThrow(/0-9/);
  });

  it("deriveAccount returns stable distinct addresses per index", () => {
    const am = manager();
    const a0 = am.deriveAccount(MNEMONIC, 0);
    const a0b = am.deriveAccount(MNEMONIC, 0);
    const a1 = am.deriveAccount(MNEMONIC, 1);
    expect(a0.address).toBe(a0b.address);
    expect(a0.address).not.toBe(a1.address);
    expect(a0.privateKey).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("ensureDefaultAccount creates account 0 once", () => {
    const am = manager();
    const first = am.ensureDefaultAccount(MNEMONIC);
    const second = am.ensureDefaultAccount(MNEMONIC);
    expect(first.index).toBe(0);
    expect(second.index).toBe(0);
    expect(am.getAccountCount()).toBe(1);
    expect(am.getAddress(MNEMONIC, 0)).toBe(am.deriveAccount(MNEMONIC, 0).address);
  });

  it("createAccount assigns next index and switchAccount updates active + lastUsedAt", () => {
    const am = manager();
    am.ensureDefaultAccount(MNEMONIC);
    const acc1 = am.createAccount(MNEMONIC, "Second");
    expect(acc1.index).toBe(1);
    expect(am.getActiveAccountIndex()).toBe(0);
    am.switchAccount(1);
    expect(am.getActiveAccountIndex()).toBe(1);
    const row = am.getAccount(1);
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it("updateNickname persists", () => {
    const am = manager();
    am.ensureDefaultAccount(MNEMONIC);
    am.updateNickname(0, "Renamed");
    expect(am.getAccount(0)?.nickname).toBe("Renamed");
  });

  it("enforces maximum 10 accounts", () => {
    const am = manager();
    am.ensureDefaultAccount(MNEMONIC);
    for (let i = 1; i < 10; i++) {
      am.createAccount(MNEMONIC, `A${i}`);
    }
    expect(am.getAccountCount()).toBe(10);
    expect(() => am.createAccount(MNEMONIC, "overflow")).toThrow(/Maximum 10/);
  });

  it("account metadata persists across DatabaseService reopen", () => {
    const path = dbPath;
    {
      const am = manager();
      am.ensureDefaultAccount(MNEMONIC);
      am.updateNickname(0, "PersistNick");
    }
    DatabaseService.resetInstanceForTests();
    const db2 = DatabaseService.getInstance(path);
    const am2 = new AccountManager(db2);
    expect(am2.getAccount(0)?.nickname).toBe("PersistNick");
  });
});
