import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { TxRecord } from "./types.js";
import { secureWriteFile } from "./validation.js";

export class TransactionHistory {
  private records: TxRecord[] = [];
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  addRecord(record: TxRecord): void {
    this.records.unshift(record);
  }

  getHistory(limit = 20, offset = 0): TxRecord[] {
    return this.records.slice(offset, offset + limit);
  }

  getByHash(hash: string): TxRecord | undefined {
    return this.records.find((r) => r.hash === hash);
  }

  getRecentHashes(count = 50): string[] {
    return this.records
      .filter((r) => r.direction === "sent")
      .slice(0, count)
      .map((r) => r.hash);
  }

  async save(): Promise<void> {
    const serializable = this.records.map((r) => ({
      ...r,
      blockNumber: r.blockNumber?.toString(),
      gasUsed: r.gasUsed?.toString(),
    }));
    await secureWriteFile(this.filePath, JSON.stringify(serializable, null, 2));
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      const raw = JSON.parse(content) as any[];
      this.records = raw.map((r) => ({
        ...r,
        blockNumber: r.blockNumber ? BigInt(r.blockNumber) : undefined,
        gasUsed: r.gasUsed ? BigInt(r.gasUsed) : undefined,
      }));
    } catch {
      this.records = [];
    }
  }
}
