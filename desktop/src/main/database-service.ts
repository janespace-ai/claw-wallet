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

    // Future migrations go here
    // if (currentVersion < 2) {
    //   this.migrateToV2();
    //   this.db.pragma("user_version = 2");
    // }
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
