/**
 * Authoritative contacts in SQLite (Desktop). Trusted silent-sign recipients are
 * contacts with `trusted=1` for a given chain + address.
 */

import type Database from "better-sqlite3";
import type { DatabaseService } from "./database-service.js";

export interface DesktopContactRow {
  name: string;
  chain: string;
  address: string;
  trusted: boolean;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function normAddr(a: string): string {
  return a.trim().toLowerCase();
}

function normChain(c: string): string {
  return c.trim().toLowerCase();
}

export class WalletAuthorityStore {
  private db: Database.Database;

  constructor(dbService: DatabaseService) {
    this.db = dbService.getDatabase();
  }

  /**
   * Legacy allowance.json address list → one contact per address on `base`, trusted.
   */
  mergeLegacyAllowanceWhitelist(addresses: string[]): void {
    const now = Date.now();
    for (const raw of addresses) {
      if (!raw || typeof raw !== "string") continue;
      const a = normAddr(raw);
      if (!ADDR_RE.test(a)) continue;
      const short = `${a.slice(0, 6)}…${a.slice(-4)}`;
      const name = `Allowance ${short}`;
      this.db
        .prepare(
          `INSERT INTO desktop_contacts (name, chain, address, trusted, created_at, updated_at)
           VALUES (?, 'base', ?, 1, ?, ?)
           ON CONFLICT(name, chain) DO UPDATE SET
             address = excluded.address,
             trusted = 1,
             updated_at = excluded.updated_at`,
        )
        .run(name, a, now, now);
    }
  }

  /** Keys `chain:address` (lowercase) for silent-sign address gate; empty set ⇒ no gate */
  getTrustedRecipientKeys(legacyWhitelist: string[]): Set<string> {
    const keys = new Set<string>();
    for (const raw of legacyWhitelist) {
      const a = normAddr(raw);
      if (ADDR_RE.test(a)) keys.add(`*:${a}`);
    }
    const rows = this.db
      .prepare(
        `SELECT chain, address FROM desktop_contacts WHERE trusted = 1`,
      )
      .all() as { chain: string; address: string }[];
    for (const r of rows) {
      keys.add(`${normChain(r.chain)}:${normAddr(r.address)}`);
    }
    return keys;
  }

  /** At least one trusted contact row exists with this address on this chain */
  isTrustedRecipientForChain(address: string, chain: string): boolean {
    const a = normAddr(address);
    const c = normChain(chain);
    if (!ADDR_RE.test(a)) return false;
    const row = this.db
      .prepare(
        `SELECT 1 FROM desktop_contacts WHERE trusted = 1 AND address = ? AND chain = ? COLLATE NOCASE`,
      )
      .get(a, c);
    return Boolean(row);
  }

  listContacts(): DesktopContactRow[] {
    const rows = this.db
      .prepare(
        `SELECT name, chain, address, trusted FROM desktop_contacts ORDER BY name ASC, chain ASC`,
      )
      .all() as { name: string; chain: string; address: string; trusted: number }[];
    return rows.map((r) => ({
      name: r.name,
      chain: r.chain,
      address: r.address,
      trusted: r.trusted === 1,
    }));
  }

  upsertContact(
    name: string,
    chain: string,
    address: string,
    opts?: { trusted?: boolean },
  ): DesktopContactRow {
    const n = name.trim();
    const c = normChain(chain);
    const a = normAddr(address);
    if (!n) throw new Error("Contact name required");
    if (!ADDR_RE.test(a)) throw new Error("Invalid address");
    const trusted = opts?.trusted === true ? 1 : 0;
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO desktop_contacts (name, chain, address, trusted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(name, chain) DO UPDATE SET
           address = excluded.address,
           trusted = excluded.trusted,
           updated_at = excluded.updated_at`,
      )
      .run(n, c, a, trusted, now, now);
    return { name: n, chain: c, address: a, trusted: trusted === 1 };
  }

  removeContactsByName(name: string): number {
    const n = name.trim();
    return this.db.prepare("DELETE FROM desktop_contacts WHERE name = ? COLLATE NOCASE").run(n).changes;
  }

  resolveContact(
    name: string,
    chain: string,
  ): { address: string; chain: string; exactMatch: boolean; trusted: boolean } | null {
    const n = name.trim();
    const c = normChain(chain);
    const row = this.db
      .prepare(
        `SELECT chain, address, trusted FROM desktop_contacts WHERE name = ? COLLATE NOCASE AND chain = ?`,
      )
      .get(n, c) as { chain: string; address: string; trusted: number } | undefined;
    if (row) {
      return {
        address: row.address,
        chain: row.chain,
        exactMatch: true,
        trusted: row.trusted === 1,
      };
    }
    const anyRow = this.db
      .prepare(
        `SELECT chain, address, trusted FROM desktop_contacts WHERE name = ? COLLATE NOCASE LIMIT 1`,
      )
      .get(n) as { chain: string; address: string; trusted: number } | undefined;
    if (anyRow) {
      return {
        address: anyRow.address,
        chain: anyRow.chain,
        exactMatch: false,
        trusted: anyRow.trusted === 1,
      };
    }
    return null;
  }
}
