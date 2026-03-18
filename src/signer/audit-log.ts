import type { Address } from "viem";
import type { SupportedChain } from "../types.js";
import { secureWriteFile } from "../validation.js";

export interface AuditEntry {
  timestamp: number;
  recipient?: Address;
  amount?: string;
  token?: string;
  chain?: SupportedChain;
  authLevel: 0 | 1 | 2;
  result: "auto-approved" | "user-confirmed" | "rejected" | "timeout";
  operation: string;
}

export class AuditLog {
  private entries: AuditEntry[] = [];
  private filePath: string;
  private maxEntries: number;

  constructor(filePath: string, maxEntries = 10000) {
    this.filePath = filePath;
    this.maxEntries = maxEntries;
  }

  add(entry: AuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getRecent(count = 50): AuditEntry[] {
    return this.entries.slice(-count).reverse();
  }

  async save(): Promise<void> {
    await secureWriteFile(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  async load(): Promise<void> {
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(this.filePath, "utf-8");
      this.entries = JSON.parse(content);
    } catch {
      this.entries = [];
    }
  }
}
