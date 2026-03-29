/**
 * Authoritative contacts in SQLite (Desktop). Each display name is a single row
 * (one address + one chain). Trusted silent-sign uses `trusted=1`.
 */

import type Database from "better-sqlite3";
import type { DatabaseService } from "./database-service.js";

export interface DesktopContactRow {
  name: string;
  chain: string;
  address: string;
  trusted: boolean;
}

export class ContactConflictError extends Error {
  constructor(
    public readonly code: "DUPLICATE_RECIPIENT",
    message: string,
  ) {
    super(message);
    this.name = "ContactConflictError";
  }
}

export type ResolveContactResult =
  | { ok: true; address: string; chain: string; exactMatch: true; trusted: boolean }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: "chain_mismatch";
      storedChain: string;
      address: string;
      trusted: boolean;
    };

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

  /** Legacy allowance.json → one row per address on `base` */
  mergeLegacyAllowanceWhitelist(addresses: string[], accountIndex: number): void {
    const now = Date.now();
    for (const raw of addresses) {
      if (!raw || typeof raw !== "string") continue;
      const a = normAddr(raw);
      if (!ADDR_RE.test(a)) continue;
      const short = `${a.slice(0, 6)}…${a.slice(-4)}`;
      const name = `Allowance ${short}`;
      this.db
        .prepare(
          `INSERT INTO desktop_contacts (name, chain, address, trusted, account_index, created_at, updated_at)
           VALUES (?, 'base', ?, 1, ?, ?, ?)
           ON CONFLICT(name COLLATE NOCASE) DO UPDATE SET
             chain = excluded.chain,
             address = excluded.address,
             trusted = 1,
             account_index = excluded.account_index,
             updated_at = excluded.updated_at`,
        )
        .run(name, a, accountIndex, now, now);
    }
  }

  getTrustedRecipientKeys(accountIndex: number, legacyWhitelist: string[]): Set<string> {
    const keys = new Set<string>();
    for (const raw of legacyWhitelist) {
      const a = normAddr(raw);
      if (ADDR_RE.test(a)) keys.add(`*:${a}`);
    }
    const rows = this.db
      .prepare(`SELECT chain, address FROM desktop_contacts WHERE account_index = ? AND trusted = 1`)
      .all(accountIndex) as { chain: string; address: string }[];
    for (const r of rows) {
      keys.add(`${normChain(r.chain)}:${normAddr(r.address)}`);
    }
    return keys;
  }

  isTrustedRecipientForChain(accountIndex: number, address: string, chain: string): boolean {
    const a = normAddr(address);
    const c = normChain(chain);
    if (!ADDR_RE.test(a)) return false;
    const row = this.db
      .prepare(
        `SELECT 1 FROM desktop_contacts WHERE account_index = ? AND trusted = 1 AND address = ? AND chain = ? COLLATE NOCASE`,
      )
      .get(accountIndex, a, c);
    return Boolean(row);
  }

  /** Match counterparty for approval / labels (at most one row per address+chain). */
  lookupContactByAddressChain(
    accountIndex: number,
    address: string,
    chain: string,
  ): { name: string; trusted: boolean } | null {
    const a = normAddr(address);
    const c = normChain(chain);
    if (!ADDR_RE.test(a)) return null;
    const row = this.db
      .prepare(
        `SELECT name, trusted FROM desktop_contacts WHERE account_index = ? AND address = ? AND chain = ? COLLATE NOCASE`,
      )
      .get(accountIndex, a, c) as { name: string; trusted: number } | undefined;
    if (!row) return null;
    return { name: row.name, trusted: row.trusted === 1 };
  }

  listContacts(accountIndex: number): DesktopContactRow[] {
    // Defensive check
    if (accountIndex === undefined || accountIndex === null) {
      throw new Error("[WalletAuthorityStore] account_index is required for listContacts");
    }

    const rows = this.db
      .prepare(
        `SELECT name, chain, address, trusted FROM desktop_contacts WHERE account_index = ? ORDER BY name ASC, chain ASC`,
      )
      .all(accountIndex) as { name: string; chain: string; address: string; trusted: number }[];
    return rows.map((r) => ({
      name: r.name,
      chain: r.chain,
      address: r.address,
      trusted: r.trusted === 1,
    }));
  }

  upsertContact(
    accountIndex: number,
    name: string,
    chain: string,
    address: string,
    opts?: { trusted?: boolean },
  ): DesktopContactRow {
    // Defensive check
    if (accountIndex === undefined || accountIndex === null) {
      throw new Error("[WalletAuthorityStore] account_index is required for upsertContact");
    }
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error(`[WalletAuthorityStore] Invalid account_index: ${accountIndex} (must be 0-9)`);
    }

    const n = name.trim();
    const c = normChain(chain);
    const a = normAddr(address);
    if (!n) throw new Error("Contact name required");
    if (!ADDR_RE.test(a)) throw new Error("Invalid address");
    const trustedVal = opts?.trusted === true ? 1 : 0;
    const now = Date.now();

    const byName = this.db
      .prepare(`SELECT id, name, chain, address, trusted FROM desktop_contacts WHERE account_index = ? AND name = ? COLLATE NOCASE`)
      .get(accountIndex, n) as { id: number; name: string; chain: string; address: string; trusted: number } | undefined;

    const byRecipient = this.db
      .prepare(
        `SELECT id, name FROM desktop_contacts WHERE account_index = ? AND address = ? AND chain = ? COLLATE NOCASE`,
      )
      .get(accountIndex, a, c) as { id: number; name: string } | undefined;

    if (byName && byRecipient) {
      if (byName.id !== byRecipient.id) {
        throw new ContactConflictError(
          "DUPLICATE_RECIPIENT",
          "This address and chain are already saved under another contact name",
        );
      }
      this.db
        .prepare(
          `UPDATE desktop_contacts SET trusted = ?, updated_at = ? WHERE id = ?`,
        )
        .run(trustedVal, now, byName.id);
      return { name: n, chain: c, address: a, trusted: trustedVal === 1 };
    }

    if (!byName && byRecipient) {
      throw new ContactConflictError(
        "DUPLICATE_RECIPIENT",
        "This address and chain are already saved under another contact name",
      );
    }

    if (byName && !byRecipient) {
      this.db
        .prepare(
          `UPDATE desktop_contacts SET chain = ?, address = ?, trusted = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(c, a, trustedVal, now, byName.id);
      return { name: n, chain: c, address: a, trusted: trustedVal === 1 };
    }

    this.db
      .prepare(
        `INSERT INTO desktop_contacts (name, chain, address, trusted, account_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(n, c, a, trustedVal, accountIndex, now, now);
    return { name: n, chain: c, address: a, trusted: trustedVal === 1 };
  }

  removeContactsByName(accountIndex: number, name: string): number {
    const n = name.trim();
    return this.db.prepare("DELETE FROM desktop_contacts WHERE account_index = ? AND name = ? COLLATE NOCASE").run(accountIndex, n).changes;
  }

  resolveContact(accountIndex: number, name: string, chain: string): ResolveContactResult {
    const n = name.trim();
    const c = normChain(chain);
    const row = this.db
      .prepare(`SELECT chain, address, trusted FROM desktop_contacts WHERE account_index = ? AND name = ? COLLATE NOCASE`)
      .get(accountIndex, n) as { chain: string; address: string; trusted: number } | undefined;
    if (!row) return { ok: false, reason: "not_found" };
    if (normChain(row.chain) !== c) {
      return {
        ok: false,
        reason: "chain_mismatch",
        storedChain: row.chain,
        address: row.address,
        trusted: row.trusted === 1,
      };
    }
    return {
      ok: true,
      address: row.address,
      chain: row.chain,
      exactMatch: true,
      trusted: row.trusted === 1,
    };
  }
}
