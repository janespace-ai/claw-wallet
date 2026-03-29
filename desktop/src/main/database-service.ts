/**
 * Database Service - SQLite database management for Desktop wallet
 * 
 * Manages SQLite connection, schema migrations, and provides database access
 * to other services. Uses WAL mode for crash safety and better concurrency.
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { existsSync, mkdirSync } from "fs";

export class DatabaseService {
  private db: Database.Database;
  private static instance: DatabaseService | null = null;

  private constructor(dbPath: string) {
    console.log(`[DatabaseService] Initializing database at ${dbPath}`);
    
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open database with options
    this.db = new Database(dbPath, {
      verbose: process.env.DEBUG_SQL ? console.log : undefined,
    });

    // Enable WAL mode for crash safety and better concurrency
    this.db.pragma("journal_mode = WAL");
    
    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    // Run migrations
    this.migrate();
    
    console.log("[DatabaseService] Database initialized successfully");
  }

  /**
   * Get singleton instance
   */
  static getInstance(dbPath: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  /**
   * Get the underlying Database instance
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Run database migrations
   */
  private migrate(): void {
    const currentVersion = this.db.pragma("user_version", { simple: true }) as number;
    console.log(`[DatabaseService] Current schema version: ${currentVersion}`);

    if (currentVersion === 0) {
      console.log("[DatabaseService] Running migration v1...");
      this.migrateToV1();
      this.db.pragma("user_version = 1");
      console.log("[DatabaseService] Migration v1 complete");
    }

    const versionAfterV1 = this.db.pragma("user_version", { simple: true }) as number;
    if (versionAfterV1 < 2) {
      console.log("[DatabaseService] Running migration v2...");
      this.migrateToV2();
      this.db.pragma("user_version = 2");
      console.log("[DatabaseService] Migration v2 complete");
    }

    const versionAfterV2 = this.db.pragma("user_version", { simple: true }) as number;
    if (versionAfterV2 < 3) {
      console.log("[DatabaseService] Running migration v3 (contacts.trusted; drop trusted_addresses, no data migration)...");
      this.migrateToV3();
      this.db.pragma("user_version = 3");
      console.log("[DatabaseService] Migration v3 complete");
    }

    const versionAfterV3 = this.db.pragma("user_version", { simple: true }) as number;
    if (versionAfterV3 < 4) {
      console.log("[DatabaseService] Running migration v4 (contacts: unique name + unique address+chain)...");
      this.migrateToV4();
      this.db.pragma("user_version = 4");
      console.log("[DatabaseService] Migration v4 complete");
    }

    const versionAfterV4 = this.db.pragma("user_version", { simple: true }) as number;
    if (versionAfterV4 < 5) {
      console.log("[DatabaseService] Running migration v5 (add account_index for multi-account support)...");
      this.migrateToV5();
      this.db.pragma("user_version = 5");
      console.log("[DatabaseService] Migration v5 complete");
    }
  }

  /**
   * Migration v1: Create signing_history table
   */
  private migrateToV1(): void {
    this.db.exec(`
      -- Signing History Table
      CREATE TABLE IF NOT EXISTS signing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT UNIQUE NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('auto', 'manual', 'rejected')),
        method TEXT NOT NULL,
        
        -- Transaction details
        tx_to TEXT,
        tx_value TEXT,
        tx_token TEXT NOT NULL DEFAULT 'ETH',
        tx_chain TEXT NOT NULL,
        
        -- Financial
        estimated_usd REAL NOT NULL,
        
        -- Execution result (updated after broadcast)
        tx_hash TEXT,
        tx_status TEXT CHECK(tx_status IN ('pending', 'success', 'failed')),
        block_number INTEGER,
        block_timestamp INTEGER,
        gas_used INTEGER,
        
        -- Metadata
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_signing_timestamp ON signing_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_signing_type ON signing_history(type);
      CREATE INDEX IF NOT EXISTS idx_signing_tx_hash ON signing_history(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_signing_status ON signing_history(tx_status);
      CREATE INDEX IF NOT EXISTS idx_signing_request_id ON signing_history(request_id);
    `);
  }

  /** Trust + authoritative contacts */
  private migrateToV2(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trusted_addresses (
        address TEXT PRIMARY KEY COLLATE NOCASE,
        label TEXT,
        source TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_trusted_created ON trusted_addresses(created_at);

      CREATE TABLE IF NOT EXISTS desktop_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        chain TEXT NOT NULL,
        address TEXT NOT NULL COLLATE NOCASE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(name COLLATE NOCASE, chain COLLATE NOCASE)
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_name ON desktop_contacts(name COLLATE NOCASE);
    `);
  }

  /**
   * v3: `trusted` on contacts only; remove legacy `trusted_addresses` without copying rows.
   */
  private migrateToV3(): void {
    const tables = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='desktop_contacts'`)
      .get() as { name: string } | undefined;
    if (tables) {
      const cols = this.db.prepare(`PRAGMA table_info(desktop_contacts)`).all() as { name: string }[];
      if (!cols.some((c) => c.name === "trusted")) {
        this.db.exec(
          `ALTER TABLE desktop_contacts ADD COLUMN trusted INTEGER NOT NULL DEFAULT 0`,
        );
      }
    }
    this.db.exec(`DROP TABLE IF EXISTS trusted_addresses`);
  }

  /**
   * v4: One display name per row; unique (address, chain). Dedupe legacy rows per design D2.
   */
  private migrateToV4(): void {
    const exists = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='desktop_contacts'`)
      .get() as { name: string } | undefined;
    if (!exists) return;

    interface Row {
      id: number;
      name: string;
      chain: string;
      address: string;
      trusted: number;
      created_at: number;
      updated_at: number;
    }

    const normAddr = (a: string) => a.trim().toLowerCase();
    const normChain = (c: string) => c.trim().toLowerCase();

    const rows = this.db.prepare(`SELECT * FROM desktop_contacts`).all() as Row[];

    this.db.exec(`ALTER TABLE desktop_contacts RENAME TO desktop_contacts_v4_old`);

    this.db.exec(`
      CREATE TABLE desktop_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        chain TEXT NOT NULL,
        address TEXT NOT NULL COLLATE NOCASE,
        trusted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    this.db.exec(`CREATE UNIQUE INDEX ux_desktop_contacts_name ON desktop_contacts(name COLLATE NOCASE)`);
    this.db.exec(
      `CREATE UNIQUE INDEX ux_desktop_contacts_addr_chain ON desktop_contacts(address COLLATE NOCASE, chain COLLATE NOCASE)`,
    );
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_name ON desktop_contacts(name COLLATE NOCASE)`);

    if (rows.length === 0) {
      this.db.exec(`DROP TABLE desktop_contacts_v4_old`);
      return;
    }

    const byAddrChain = new Map<string, Row>();
    for (const r of rows) {
      const k = `${normAddr(r.address)}|${normChain(r.chain)}`;
      const cur = byAddrChain.get(k);
      if (!cur || r.updated_at > cur.updated_at) byAddrChain.set(k, r);
    }
    let survivors = Array.from(byAddrChain.values());

    const byName = new Map<string, Row[]>();
    for (const r of survivors) {
      const nk = r.name.trim().toLowerCase();
      if (!byName.has(nk)) byName.set(nk, []);
      byName.get(nk)!.push(r);
    }

    const finalRows: Row[] = [];
    const usedNamesLower = new Set<string>();

    for (const [, group] of byName) {
      group.sort((a, b) => b.updated_at - a.updated_at);
      const [keep, ...dupes] = group;
      finalRows.push(keep);
      usedNamesLower.add(keep.name.trim().toLowerCase());

      for (const d of dupes) {
        let base = `${keep.name.trim()} (${normChain(d.chain)})`;
        let candidate = base;
        let n = 2;
        while (usedNamesLower.has(candidate.trim().toLowerCase())) {
          candidate = `${base} ${n++}`;
        }
        usedNamesLower.add(candidate.trim().toLowerCase());
        finalRows.push({ ...d, name: candidate });
      }
    }

    const ins = this.db.prepare(`
      INSERT INTO desktop_contacts (name, chain, address, trusted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const r of finalRows) {
      ins.run(r.name, normChain(r.chain), normAddr(r.address), r.trusted, r.created_at, r.updated_at);
    }

    this.db.exec(`DROP TABLE desktop_contacts_v4_old`);
  }

  /**
   * Migration v5: Add account_index for multi-account support
   */
  private migrateToV5(): void {
    // Add account_index column to signing_history
    const signingHistoryCols = this.db.pragma("table_info(signing_history)") as Array<{ name: string }>;
    if (!signingHistoryCols.some(c => c.name === "account_index")) {
      this.db.exec(`ALTER TABLE signing_history ADD COLUMN account_index INTEGER DEFAULT 0`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_signing_history_account ON signing_history(account_index)`);
      console.log("[DatabaseService] Added account_index to signing_history");
    }

    // Add account_index column to desktop_contacts
    const contactsCols = this.db.pragma("table_info(desktop_contacts)") as Array<{ name: string }>;
    if (!contactsCols.some(c => c.name === "account_index")) {
      this.db.exec(`ALTER TABLE desktop_contacts ADD COLUMN account_index INTEGER DEFAULT 0`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_account ON desktop_contacts(account_index)`);
      console.log("[DatabaseService] Added account_index to desktop_contacts");
    }

    // Add account_index column to transaction_sync
    const txSyncCols = this.db.pragma("table_info(transaction_sync)") as Array<{ name: string }>;
    if (!txSyncCols.some(c => c.name === "account_index")) {
      this.db.exec(`ALTER TABLE transaction_sync ADD COLUMN account_index INTEGER DEFAULT 0`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_sync_account ON transaction_sync(account_index)`);
      console.log("[DatabaseService] Added account_index to transaction_sync");
    }

    console.log("[DatabaseService] Migration v5: All existing data assigned to account 0 (default account)");
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      console.log("[DatabaseService] Database closed");
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    signingHistoryCount: number;
    pendingCount: number;
    dbSize: number;
  } {
    const signingHistoryCount = this.db
      .prepare("SELECT COUNT(*) as count FROM signing_history")
      .get() as { count: number };

    const pendingCount = this.db
      .prepare("SELECT COUNT(*) as count FROM signing_history WHERE tx_status = 'pending'")
      .get() as { count: number };

    const dbSize = this.db
      .prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
      .get() as { size: number };

    return {
      signingHistoryCount: signingHistoryCount.count,
      pendingCount: pendingCount.count,
      dbSize: dbSize.size,
    };
  }
}
