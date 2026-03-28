/**
 * Signing History - SQLite-based persistent audit log
 * 
 * Stores all signing decisions (auto-approved, manually approved, rejected)
 * with transaction status tracking.
 */

import type Database from "better-sqlite3";
import type { DatabaseService } from "./database-service.js";

export interface SigningRecord {
  id: number;
  request_id: string;
  timestamp: number;
  type: "auto" | "manual" | "rejected";
  method: string;
  tx_to: string | null;
  tx_value: string | null;
  tx_token: string;
  tx_chain: string;
  estimated_usd: number;
  tx_hash: string | null;
  tx_status: "pending" | "success" | "failed" | null;
  block_number: number | null;
  block_timestamp: number | null;
  gas_used: number | null;
  created_at: number;
  updated_at: number;
}

export interface TxStatus {
  status: "success" | "failed";
  blockNumber: number;
  blockTimestamp: number;
  gasUsed: number;
}

export class SigningHistory {
  private db: Database.Database;

  constructor(dbService: DatabaseService) {
    this.db = dbService.getDatabase();
  }

  /**
   * Add a new signing record
   */
  addRecord(record: {
    requestId: string;
    type: "auto" | "manual" | "rejected";
    method: string;
    to: string;
    value: string;
    token: string;
    chain: string;
    estimatedUSD: number;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO signing_history 
      (request_id, timestamp, type, method, tx_to, tx_value, tx_token, tx_chain, estimated_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      record.requestId,
      Date.now(),
      record.type,
      record.method,
      record.to,
      record.value,
      record.token,
      record.chain,
      record.estimatedUSD
    );

    console.log(`[SigningHistory] Added record: ${record.requestId} (${record.type})`);
    return result.lastInsertRowid as number;
  }

  /**
   * Update transaction hash after signing
   */
  updateTxHash(requestId: string, txHash: string): void {
    const stmt = this.db.prepare(`
      UPDATE signing_history 
      SET tx_hash = ?, tx_status = 'pending', updated_at = ?
      WHERE request_id = ?
    `);

    stmt.run(txHash, Date.now(), requestId);
    console.log(`[SigningHistory] Updated txHash for ${requestId}: ${txHash}`);
  }

  /**
   * Update transaction status from blockchain
   */
  updateTxStatus(txHash: string, status: TxStatus): void {
    const stmt = this.db.prepare(`
      UPDATE signing_history 
      SET tx_status = ?,
          block_number = ?,
          block_timestamp = ?,
          gas_used = ?,
          updated_at = ?
      WHERE tx_hash = ?
    `);

    stmt.run(
      status.status,
      status.blockNumber,
      status.blockTimestamp,
      status.gasUsed,
      Date.now(),
      txHash
    );

    console.log(`[SigningHistory] Updated status for ${txHash}: ${status.status}`);
  }

  /**
   * Get records with pagination
   */
  getRecords(limit = 50, offset = 0): SigningRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM signing_history
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(limit, offset) as SigningRecord[];
  }

  /**
   * Get records filtered by type
   */
  getRecordsByType(type: "auto" | "manual" | "rejected"): SigningRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM signing_history
      WHERE type = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `);

    return stmt.all(type) as SigningRecord[];
  }

  /**
   * Get records filtered by status
   */
  getRecordsByStatus(status: "pending" | "success" | "failed"): SigningRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM signing_history
      WHERE tx_status = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `);

    return stmt.all(status) as SigningRecord[];
  }

  /**
   * Get pending transactions that need status updates
   */
  getPendingTransactions(): SigningRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM signing_history
      WHERE tx_hash IS NOT NULL AND tx_status = 'pending'
      ORDER BY timestamp DESC
      LIMIT 50
    `);

    return stmt.all() as SigningRecord[];
  }

  /**
   * Get record by request ID
   */
  getRecordByRequestId(requestId: string): SigningRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM signing_history
      WHERE request_id = ?
    `);

    return (stmt.get(requestId) as SigningRecord) || null;
  }

  getRecordByTxHash(txHash: string): SigningRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM signing_history
      WHERE tx_hash = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    return (stmt.get(txHash) as SigningRecord) || null;
  }

  /**
   * Get total record count
   */
  getRecordCount(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM signing_history
    `);

    const result = stmt.get() as { count: number };
    return result.count;
  }
}
