/**
 * Account Manager - Manage multiple derived accounts from one mnemonic
 * 
 * Supports up to 10 accounts using BIP-44 derivation path:
 * m/44'/60'/0'/0/{accountIndex} where accountIndex ranges from 0 to 9
 */

import { ethers } from 'ethers';
import { DatabaseService } from './database-service.js';

export interface Account {
  index: number;
  address: string;
  nickname: string;
  createdAt: number;
  lastUsedAt: number | null;
}

const MAX_ACCOUNTS = 10;

export class AccountManager {
  private db: DatabaseService;
  private accounts: Map<number, Account> = new Map();
  private activeAccountIndex: number = 0;

  constructor(db: DatabaseService) {
    this.db = db;
    this.initializeAccountsTable();
  }

  /**
   * Initialize accounts table in database
   */
  private initializeAccountsTable(): void {
    const tableExists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
    ).get();

    if (!tableExists) {
      this.db.prepare(`
        CREATE TABLE accounts (
          account_index INTEGER PRIMARY KEY,
          nickname TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_used_at INTEGER
        )
      `).run();

      console.log('[AccountManager] Created accounts table');
    }
  }

  /**
   * Derive account from mnemonic using BIP-44 path
   */
  deriveAccount(mnemonic: string, accountIndex: number): { address: string; privateKey: string } {
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error('Account index must be 0-9');
    }

    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }

  /**
   * Create a new account
   */
  createAccount(mnemonic: string, nickname?: string): Account {
    const existingAccounts = this.listAccounts();
    
    if (existingAccounts.length >= MAX_ACCOUNTS) {
      throw new Error('Maximum 10 accounts allowed');
    }

    // Find next available index
    const usedIndices = new Set(existingAccounts.map(acc => acc.index));
    let accountIndex = 0;
    while (usedIndices.has(accountIndex) && accountIndex < MAX_ACCOUNTS) {
      accountIndex++;
    }

    if (accountIndex >= MAX_ACCOUNTS) {
      throw new Error('Maximum 10 accounts allowed');
    }

    const { address } = this.deriveAccount(mnemonic, accountIndex);
    const defaultNickname = nickname || `Account ${accountIndex}`;

    const account: Account = {
      index: accountIndex,
      address,
      nickname: defaultNickname,
      createdAt: Date.now(),
      lastUsedAt: null
    };

    this.db.prepare(`
      INSERT INTO accounts (account_index, nickname, created_at, last_used_at)
      VALUES (?, ?, ?, ?)
    `).run(accountIndex, defaultNickname, account.createdAt, null);

    this.accounts.set(accountIndex, account);

    console.log(`[AccountManager] Created account ${accountIndex}: ${address}`);

    return account;
  }

  /**
   * Get or create default account (Account 0)
   */
  ensureDefaultAccount(mnemonic: string): Account {
    const account = this.getAccount(0);
    if (account) {
      return account;
    }

    return this.createAccount(mnemonic, 'Main Account');
  }

  /**
   * List all accounts
   */
  listAccounts(): Account[] {
    const rows = this.db.prepare(`
      SELECT account_index, nickname, created_at, last_used_at
      FROM accounts
      ORDER BY account_index ASC
    `).all() as Array<{
      account_index: number;
      nickname: string;
      created_at: number;
      last_used_at: number | null;
    }>;

    const accounts = rows.map(row => ({
      index: row.account_index,
      address: '', // Address derived on demand
      nickname: row.nickname,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at
    }));

    // Cache accounts
    for (const account of accounts) {
      this.accounts.set(account.index, account);
    }

    return accounts;
  }

  /**
   * Get account by index
   */
  getAccount(accountIndex: number): Account | null {
    if (this.accounts.has(accountIndex)) {
      return this.accounts.get(accountIndex)!;
    }

    const row = this.db.prepare(`
      SELECT account_index, nickname, created_at, last_used_at
      FROM accounts
      WHERE account_index = ?
    `).get(accountIndex) as {
      account_index: number;
      nickname: string;
      created_at: number;
      last_used_at: number | null;
    } | undefined;

    if (!row) {
      return null;
    }

    const account: Account = {
      index: row.account_index,
      address: '', // Address derived on demand
      nickname: row.nickname,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at
    };

    this.accounts.set(accountIndex, account);
    return account;
  }

  /**
   * Get active account index
   */
  getActiveAccountIndex(): number {
    return this.activeAccountIndex;
  }

  /**
   * Switch active account
   */
  switchAccount(accountIndex: number): void {
    const account = this.getAccount(accountIndex);
    if (!account) {
      throw new Error(`Account ${accountIndex} not found`);
    }

    this.activeAccountIndex = accountIndex;

    // Update last used timestamp
    this.db.prepare(`
      UPDATE accounts
      SET last_used_at = ?
      WHERE account_index = ?
    `).run(Date.now(), accountIndex);

    account.lastUsedAt = Date.now();

    console.log(`[AccountManager] Switched to account ${accountIndex}`);
  }

  /**
   * Update account nickname
   */
  updateNickname(accountIndex: number, nickname: string): void {
    const account = this.getAccount(accountIndex);
    if (!account) {
      throw new Error(`Account ${accountIndex} not found`);
    }

    this.db.prepare(`
      UPDATE accounts
      SET nickname = ?
      WHERE account_index = ?
    `).run(nickname, accountIndex);

    account.nickname = nickname;

    console.log(`[AccountManager] Updated account ${accountIndex} nickname to: ${nickname}`);
  }

  /**
   * Get account count
   */
  getAccountCount(): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM accounts
    `).get() as { count: number };

    return result.count;
  }

  /**
   * Check if account exists
   */
  hasAccount(accountIndex: number): boolean {
    return this.getAccount(accountIndex) !== null;
  }

  /**
   * Get address for account index
   */
  getAddress(mnemonic: string, accountIndex: number): string {
    const { address } = this.deriveAccount(mnemonic, accountIndex);
    return address;
  }

  /**
   * Get all addresses for existing accounts
   */
  getAllAddresses(mnemonic: string): string[] {
    const accounts = this.listAccounts();
    return accounts.map(acc => this.getAddress(mnemonic, acc.index));
  }
}
