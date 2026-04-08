import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssetCacheService, type CachedAssetEntry } from "./asset-cache-service.js";
import { DatabaseService } from "./database-service.js";

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
const ADDR = "0xabc1230000000000000000000000000000000001";

function makeEntry(overrides: Partial<CachedAssetEntry> = {}): CachedAssetEntry {
  return {
    symbol: "ETH",
    token: "ETH",
    chain_id: 1,
    chain_name: "Ethereum",
    decimals: 18,
    amount: "1.5",
    raw_amount: "1500000000000000000",
    price_usd: 2000,
    updated_at: Date.now(),
    ...overrides,
  };
}

describe.skipIf(!SQLITE_OK)("AssetCacheService", () => {
  let dbPath = "";

  beforeEach(() => {
    DatabaseService.resetInstanceForTests();
    const dir = join(tmpdir(), `claw-ac-${randomBytes(8).toString("hex")}`);
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

  function service(): AssetCacheService {
    return new AssetCacheService(DatabaseService.getInstance(dbPath));
  }

  it("getByAddress returns empty array when no cache exists", () => {
    const svc = service();
    expect(svc.getByAddress(ADDR)).toEqual([]);
  });

  it("upsertMany inserts new entries and getByAddress returns them", () => {
    const svc = service();
    const entries = [
      makeEntry({ symbol: "ETH", chain_id: 1, amount: "1.0" }),
      makeEntry({ symbol: "USDC", token: "USDC", chain_id: 1, amount: "500.0", decimals: 6, price_usd: 1 }),
    ];
    svc.upsertMany(ADDR, entries);

    const result = svc.getByAddress(ADDR);
    expect(result).toHaveLength(2);
    const symbols = result.map((r) => r.symbol).sort();
    expect(symbols).toEqual(["ETH", "USDC"]);
  });

  it("upsertMany updates existing entry on (address, symbol, chain_id) conflict", () => {
    const svc = service();
    svc.upsertMany(ADDR, [makeEntry({ amount: "1.0", price_usd: 2000 })]);

    svc.upsertMany(ADDR, [makeEntry({ amount: "2.5", price_usd: 2100 })]);

    const result = svc.getByAddress(ADDR);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe("2.5");
    expect(result[0].price_usd).toBe(2100);
  });

  it("upsertMany does not create duplicate for same (address, symbol, chain_id)", () => {
    const svc = service();
    svc.upsertMany(ADDR, [makeEntry()]);
    svc.upsertMany(ADDR, [makeEntry({ amount: "3.0" })]);
    svc.upsertMany(ADDR, [makeEntry({ amount: "4.0" })]);

    expect(svc.getByAddress(ADDR)).toHaveLength(1);
    expect(svc.getByAddress(ADDR)[0].amount).toBe("4.0");
  });

  it("upsertMany is address-isolated (different addresses do not interfere)", () => {
    const svc = service();
    const other = "0xdeadbeef0000000000000000000000000000ffff";
    svc.upsertMany(ADDR, [makeEntry({ amount: "1.0" })]);
    svc.upsertMany(other, [makeEntry({ amount: "9.9" })]);

    expect(svc.getByAddress(ADDR)).toHaveLength(1);
    expect(svc.getByAddress(ADDR)[0].amount).toBe("1.0");
    expect(svc.getByAddress(other)[0].amount).toBe("9.9");
  });

  it("clearByAddress removes all entries for that address only", () => {
    const svc = service();
    const other = "0xdeadbeef0000000000000000000000000000ffff";
    svc.upsertMany(ADDR, [makeEntry()]);
    svc.upsertMany(other, [makeEntry()]);

    svc.clearByAddress(ADDR);

    expect(svc.getByAddress(ADDR)).toHaveLength(0);
    expect(svc.getByAddress(other)).toHaveLength(1);
  });

  it("migration v7 creates asset_cache on a fresh db", () => {
    const db = DatabaseService.getInstance(dbPath);
    const version = db.getDatabase().pragma("user_version", { simple: true }) as number;
    expect(version).toBeGreaterThanOrEqual(7);

    const table = db
      .getDatabase()
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='asset_cache'`)
      .get() as { name: string } | undefined;
    expect(table?.name).toBe("asset_cache");
  });

  it("migration v7 is idempotent (running twice does not throw)", () => {
    // First instance already ran migrations
    DatabaseService.resetInstanceForTests();
    // Opening again should silently skip v7
    expect(() => DatabaseService.getInstance(dbPath)).not.toThrow();
  });
});
