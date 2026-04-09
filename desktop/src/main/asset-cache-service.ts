/**
 * Asset Cache Service - Persistent cross-session balance cache via SQLite
 *
 * Stores per-address token balances and prices in the `asset_cache` table
 * (schema v7). Keyed by (address, symbol, chain_id) so a wallet address
 * change never exposes stale data to the wrong account.
 */

import type Database from "better-sqlite3";
import type { DatabaseService } from "./database-service.js";

export interface CachedAssetEntry {
  symbol: string;
  token: string;
  chain_id: number;
  chain_name: string;
  decimals: number;
  amount: string;
  raw_amount: string;
  price_usd: number;
  updated_at: number; // ms timestamp
}

export class AssetCacheService {
  private db: Database.Database;

  constructor(dbService: DatabaseService) {
    this.db = dbService.getDatabase();
  }

  /**
   * Return all cached asset entries for an address, newest-updated first.
   * Returns an empty array if no cache exists yet.
   */
  getByAddress(address: string): CachedAssetEntry[] {
    return this.db
      .prepare(
        `SELECT symbol, token, chain_id, chain_name, decimals, amount, raw_amount, price_usd, updated_at
         FROM asset_cache
         WHERE address = ?
         ORDER BY updated_at DESC`,
      )
      .all(address.toLowerCase()) as CachedAssetEntry[];
  }

  /**
   * Upsert multiple asset entries for an address in a single transaction.
   * Conflicts on (address, symbol, chain_id) update all mutable columns.
   */
  upsertMany(address: string, entries: CachedAssetEntry[]): void {
    if (entries.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO asset_cache
        (address, symbol, token, chain_id, chain_name, decimals, amount, raw_amount, price_usd, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address, symbol, chain_id) DO UPDATE SET
        token      = excluded.token,
        chain_name = excluded.chain_name,
        decimals   = excluded.decimals,
        amount     = excluded.amount,
        raw_amount = excluded.raw_amount,
        price_usd  = excluded.price_usd,
        updated_at = excluded.updated_at
    `);

    const addr = address.toLowerCase();
    const insertMany = this.db.transaction((rows: CachedAssetEntry[]) => {
      for (const e of rows) {
        stmt.run(
          addr,
          e.symbol,
          e.token,
          e.chain_id,
          e.chain_name,
          e.decimals,
          e.amount,
          e.raw_amount,
          e.price_usd,
          e.updated_at,
        );
      }
    });

    insertMany(entries);
    console.log(`[AssetCacheService] Upserted ${entries.length} entries for ${addr}`);
  }

  /**
   * Delete all cached entries for an address (e.g. on manual refresh or account clear).
   */
  clearByAddress(address: string): void {
    const result = this.db
      .prepare(`DELETE FROM asset_cache WHERE address = ?`)
      .run(address.toLowerCase());
    console.log(`[AssetCacheService] Cleared ${result.changes} entries for ${address.toLowerCase()}`);
  }
}
