/**
 * Signing History - Persistent audit log of all signing decisions
 * 
 * Stores all signing decisions (auto-approved, manually approved, rejected)
 * in a JSON file with atomic writes.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface SigningRecord {
  requestId: string;
  timestamp: number;
  type: "auto" | "manual" | "rejected";
  method: string;
  to: string;
  value: string;
  token: string;
  chain: string;
  estimatedUSD: number;
  txHash?: string;
}

interface SigningHistoryData {
  records: SigningRecord[];
}

export class SigningHistory {
  private historyPath: string;
  private records: SigningRecord[] = [];

  constructor(dataDir?: string) {
    const baseDir = dataDir || join(homedir(), ".claw-wallet");
    this.historyPath = join(baseDir, "signing-history.json");
    this.load();
  }

  /**
   * Add a new signing record
   */
  addRecord(record: Omit<SigningRecord, "timestamp">): void {
    const fullRecord: SigningRecord = {
      ...record,
      timestamp: Date.now(),
    };

    this.records.push(fullRecord);
    this.save();
  }

  /**
   * Update an existing record (e.g., to add txHash)
   */
  updateRecord(requestId: string, updates: Partial<SigningRecord>): boolean {
    const index = this.records.findIndex((r) => r.requestId === requestId);
    if (index === -1) {
      return false;
    }

    this.records[index] = { ...this.records[index], ...updates };
    this.save();
    return true;
  }

  /**
   * Get all records sorted by timestamp (newest first)
   */
  getRecords(): SigningRecord[] {
    return [...this.records].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Load records from disk
   */
  private load(): void {
    try {
      if (!existsSync(this.historyPath)) {
        this.records = [];
        return;
      }

      const data = readFileSync(this.historyPath, "utf-8");
      const parsed: SigningHistoryData = JSON.parse(data);

      if (!Array.isArray(parsed.records)) {
        console.error("[SigningHistory] Invalid data format, resetting");
        this.records = [];
        return;
      }

      this.records = parsed.records;
      console.log(`[SigningHistory] Loaded ${this.records.length} records from ${this.historyPath}`);
    } catch (err) {
      console.error("[SigningHistory] Failed to load history file, starting fresh:", err);
      this.records = [];
    }
  }

  /**
   * Save records to disk with atomic write
   */
  private save(): void {
    try {
      const dir = dirname(this.historyPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data: SigningHistoryData = { records: this.records };
      const jsonContent = JSON.stringify(data, null, 2);

      const tmpPath = `${this.historyPath}.tmp`;
      writeFileSync(tmpPath, jsonContent, "utf-8");
      renameSync(tmpPath, this.historyPath);

      console.log(`[SigningHistory] Saved ${this.records.length} records to ${this.historyPath}`);
    } catch (err) {
      console.error("[SigningHistory] Failed to save history:", err);
    }
  }
}
