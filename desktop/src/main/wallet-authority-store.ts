/**
 * Authoritative trusted addresses + contacts in SQLite (Desktop).
 */

import type Database from "better-sqlite3";
import type { DatabaseService } from "./database-service.js";

export interface DesktopContactRow {
  name: string;
  chain: string;
  address: string;
}

export interface TrustedAddressRow {
  address: string;
  label: string | null;
  source: string;
  createdAt: number;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function normAddr(a: string): string {
  return a.trim().toLowerCase();
}

export class WalletAuthorityStore {
  private db: Database.Database;

  constructor(dbService: DatabaseService) {
    this.db = dbService.getDatabase();
  }

  /** One-shot: import legacy allowance.json addresses, idempotent */
  mergeLegacyAllowanceWhitelist(addresses: string[]): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO trusted_addresses (address, label, source, created_at)
      VALUES (?, NULL, 'migrated_allowance', ?)
    `);
    const now = Date.now();
    for (const raw of addresses) {
      if (!raw || typeof raw !== "string") continue;
      const a = normAddr(raw);
      if (!ADDR_RE.test(a)) continue;
      stmt.run(a, now);
    }
  }

  isTrustedAddress(address: string): boolean {
    const a = normAddr(address);
    if (!ADDR_RE.test(a)) return false;
    const row = this.db
      .prepare("SELECT 1 FROM trusted_addresses WHERE address = ?")
      .get(a);
    return Boolean(row);
  }

  /** Lowercase set for policy: empty => no address restriction */
  getTrustedAddressesForPolicy(legacyWhitelist: string[]): Set<string> {
    const set = new Set<string>();
    for (const raw of legacyWhitelist) {
      const a = normAddr(raw);
      if (ADDR_RE.test(a)) set.add(a);
    }
    const rows = this.db
      .prepare("SELECT address FROM trusted_addresses")
      .all() as { address: string }[];
    for (const r of rows) set.add(normAddr(r.address));
    return set;
  }

  listTrustedAddresses(): TrustedAddressRow[] {
    const rows = this.db
      .prepare(
        `SELECT address, label, source, created_at AS createdAt
         FROM trusted_addresses ORDER BY created_at ASC`,
      )
      .all() as TrustedAddressRow[];
    return rows;
  }

  addTrustedAddress(address: string, label: string | null, source: string): void {
    const a = normAddr(address);
    if (!ADDR_RE.test(a)) throw new Error("Invalid address");
    this.db
      .prepare(
        `INSERT OR IGNORE INTO trusted_addresses (address, label, source, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(a, label, source, Date.now());
  }

  removeTrustedAddress(address: string): boolean {
    const a = normAddr(address);
    const r = this.db.prepare("DELETE FROM trusted_addresses WHERE address = ?").run(a);
    return r.changes > 0;
  }

  listContacts(): DesktopContactRow[] {
    return this.db
      .prepare(
        `SELECT name, chain, address FROM desktop_contacts ORDER BY name ASC, chain ASC`,
      )
      .all() as DesktopContactRow[];
  }

  upsertContact(name: string, chain: string, address: string): DesktopContactRow {
    const n = name.trim();
    const c = chain.trim().toLowerCase();
    const a = normAddr(address);
    if (!n) throw new Error("Contact name required");
    if (!ADDR_RE.test(a)) throw new Error("Invalid address");
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO desktop_contacts (name, chain, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(name, chain) DO UPDATE SET
           address = excluded.address,
           updated_at = excluded.updated_at`,
      )
      .run(n, c, a, now, now);
    return { name: n, chain: c, address: a };
  }

  removeContactsByName(name: string): number {
    const n = name.trim();
    const r = this.db.prepare("DELETE FROM desktop_contacts WHERE name = ? COLLATE NOCASE").run(n);
    return r.changes;
  }

  resolveContact(
    name: string,
    chain: string,
  ): { address: string; chain: string; exactMatch: boolean } | null {
    const n = name.trim();
    const c = chain.trim().toLowerCase();
    const row = this.db
      .prepare(
        `SELECT chain, address FROM desktop_contacts WHERE name = ? COLLATE NOCASE AND chain = ?`,
      )
      .get(n, c) as { chain: string; address: string } | undefined;
    if (row) {
      return { address: row.address, chain: row.chain, exactMatch: true };
    }
    const anyRow = this.db
      .prepare(`SELECT chain, address FROM desktop_contacts WHERE name = ? COLLATE NOCASE LIMIT 1`)
      .get(n) as { chain: string; address: string } | undefined;
    if (anyRow) {
      return { address: anyRow.address, chain: anyRow.chain, exactMatch: false };
    }
    return null;
  }
}
