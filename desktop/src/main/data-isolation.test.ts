/**
 * Unit tests for Account Data Isolation
 * 
 * Verifies that data from different accounts cannot cross-contaminate
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SigningHistory } from './signing-history';
import { WalletAuthorityStore } from './wallet-authority-store';
import type { DatabaseService } from './database-service';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Account Data Isolation', () => {
  let db: Database.Database;
  let dbPath: string;
  let dbService: DatabaseService;
  let signingHistory: SigningHistory;
  let authorityStore: WalletAuthorityStore;

  beforeEach(() => {
    // Create temporary database
    dbPath = path.join(os.tmpdir(), `test-isolation-${Date.now()}.db`);
    db = new Database(dbPath);
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS signing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        method TEXT NOT NULL,
        tx_to TEXT,
        tx_value TEXT,
        tx_token TEXT NOT NULL,
        tx_chain TEXT NOT NULL,
        estimated_usd REAL DEFAULT 0,
        tx_hash TEXT,
        tx_status TEXT,
        block_number INTEGER,
        block_timestamp INTEGER,
        gas_used INTEGER,
        account_index INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS desktop_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        chain TEXT NOT NULL,
        address TEXT NOT NULL,
        trusted INTEGER NOT NULL DEFAULT 0,
        account_index INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX idx_signing_history_account ON signing_history(account_index);
      CREATE INDEX idx_contacts_account ON desktop_contacts(account_index);
    `);

    dbService = {
      getDatabase: () => db,
    } as DatabaseService;

    signingHistory = new SigningHistory(dbService);
    authorityStore = new WalletAuthorityStore(dbService);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('SigningHistory Isolation', () => {
    it('should isolate signing records between accounts', () => {
      // Add records for account 0
      signingHistory.addRecord({
        requestId: 'req-account0-1',
        type: 'manual',
        method: 'sign_transaction',
        to: '0xAccount0Recipient',
        value: '1000000000000000000',
        token: 'ETH',
        chain: 'ethereum',
        estimatedUSD: 100,
        accountIndex: 0,
      });

      // Add records for account 1
      signingHistory.addRecord({
        requestId: 'req-account1-1',
        type: 'auto',
        method: 'sign_transaction',
        to: '0xAccount1Recipient',
        value: '2000000000000000000',
        token: 'ETH',
        chain: 'base',
        estimatedUSD: 200,
        accountIndex: 1,
      });

      // Verify account 0 only sees its records
      const account0Records = signingHistory.getRecords(0);
      expect(account0Records).toHaveLength(1);
      expect(account0Records[0].request_id).toBe('req-account0-1');
      expect(account0Records[0].tx_to).toBe('0xAccount0Recipient');
      expect(account0Records[0].tx_chain).toBe('ethereum');

      // Verify account 1 only sees its records
      const account1Records = signingHistory.getRecords(1);
      expect(account1Records).toHaveLength(1);
      expect(account1Records[0].request_id).toBe('req-account1-1');
      expect(account1Records[0].tx_to).toBe('0xAccount1Recipient');
      expect(account1Records[0].tx_chain).toBe('base');
    });

    it('should not allow cross-account record access', () => {
      // Add multiple records for different accounts
      for (let i = 0; i < 5; i++) {
        signingHistory.addRecord({
          requestId: `req-account${i}`,
          type: 'manual',
          method: 'sign_transaction',
          to: `0xRecipient${i}`,
          value: '1000000000000000000',
          token: 'ETH',
          chain: 'ethereum',
          estimatedUSD: 100,
          accountIndex: i,
        });
      }

      // Each account should only see 1 record (its own)
      for (let i = 0; i < 5; i++) {
        const records = signingHistory.getRecords(i);
        expect(records).toHaveLength(1);
        expect(records[0].request_id).toBe(`req-account${i}`);
      }
    });

    it('should isolate getRecordByType between accounts', () => {
      // Account 0: auto + manual
      signingHistory.addRecord({
        requestId: 'auto-0',
        type: 'auto',
        method: 'sign_transaction',
        to: '0xAuto0',
        value: '1',
        token: 'ETH',
        chain: 'ethereum',
        estimatedUSD: 1,
        accountIndex: 0,
      });

      signingHistory.addRecord({
        requestId: 'manual-0',
        type: 'manual',
        method: 'sign_transaction',
        to: '0xManual0',
        value: '1',
        token: 'ETH',
        chain: 'ethereum',
        estimatedUSD: 1,
        accountIndex: 0,
      });

      // Account 1: only manual
      signingHistory.addRecord({
        requestId: 'manual-1',
        type: 'manual',
        method: 'sign_transaction',
        to: '0xManual1',
        value: '1',
        token: 'ETH',
        chain: 'ethereum',
        estimatedUSD: 1,
        accountIndex: 1,
      });

      // Verify type filtering respects account isolation
      const account0Auto = signingHistory.getRecordsByType(0, 'auto');
      expect(account0Auto).toHaveLength(1);
      expect(account0Auto[0].request_id).toBe('auto-0');

      const account0Manual = signingHistory.getRecordsByType(0, 'manual');
      expect(account0Manual).toHaveLength(1);
      expect(account0Manual[0].request_id).toBe('manual-0');

      const account1Auto = signingHistory.getRecordsByType(1, 'auto');
      expect(account1Auto).toHaveLength(0);

      const account1Manual = signingHistory.getRecordsByType(1, 'manual');
      expect(account1Manual).toHaveLength(1);
      expect(account1Manual[0].request_id).toBe('manual-1');
    });

    it('should isolate record counts', () => {
      // Add different numbers of records for each account
      for (let i = 0; i < 3; i++) {
        signingHistory.addRecord({
          requestId: `account0-${i}`,
          type: 'manual',
          method: 'sign_transaction',
          to: '0xTest',
          value: '1',
          token: 'ETH',
          chain: 'ethereum',
          estimatedUSD: 1,
          accountIndex: 0,
        });
      }

      for (let i = 0; i < 5; i++) {
        signingHistory.addRecord({
          requestId: `account1-${i}`,
          type: 'manual',
          method: 'sign_transaction',
          to: '0xTest',
          value: '1',
          token: 'ETH',
          chain: 'ethereum',
          estimatedUSD: 1,
          accountIndex: 1,
        });
      }

      expect(signingHistory.getRecordCount(0)).toBe(3);
      expect(signingHistory.getRecordCount(1)).toBe(5);
      expect(signingHistory.getRecordCount(2)).toBe(0);
    });
  });

  describe('Contacts Isolation', () => {
    it('should isolate contacts between accounts', () => {
      const now = Date.now();

      // Add contact for account 0
      authorityStore.upsertContact(
        0,
        'Alice',
        'ethereum',
        '0xAliceAddress',
        { trusted: true }
      );

      // Add contact for account 1
      authorityStore.upsertContact(
        1,
        'Bob',
        'base',
        '0xBobAddress',
        { trusted: false }
      );

      // Verify account 0 only sees Alice
      const account0Contacts = authorityStore.listContacts(0);
      expect(account0Contacts).toHaveLength(1);
      expect(account0Contacts[0].name).toBe('Alice');
      expect(account0Contacts[0].address).toBe('0xaliceaddress');
      expect(account0Contacts[0].chain).toBe('ethereum');
      expect(account0Contacts[0].trusted).toBe(true);

      // Verify account 1 only sees Bob
      const account1Contacts = authorityStore.listContacts(1);
      expect(account1Contacts).toHaveLength(1);
      expect(account1Contacts[0].name).toBe('Bob');
      expect(account1Contacts[0].address).toBe('0xbobaddress');
      expect(account1Contacts[0].chain).toBe('base');
      expect(account1Contacts[0].trusted).toBe(false);
    });

    it('should not allow duplicate contact names across accounts', () => {
      // Same contact name can exist in different accounts
      authorityStore.upsertContact(0, 'Charlie', 'ethereum', '0xCharlie1', {});
      authorityStore.upsertContact(1, 'Charlie', 'base', '0xCharlie2', {});

      const account0Contacts = authorityStore.listContacts(0);
      const account1Contacts = authorityStore.listContacts(1);

      expect(account0Contacts[0].name).toBe('Charlie');
      expect(account0Contacts[0].address).toBe('0xcharlie1');

      expect(account1Contacts[0].name).toBe('Charlie');
      expect(account1Contacts[0].address).toBe('0xcharlie2');
    });

    it('should isolate trusted recipient checks', () => {
      authorityStore.upsertContact(
        0,
        'TrustedForAccount0',
        'ethereum',
        '0xTrusted0',
        { trusted: true }
      );

      authorityStore.upsertContact(
        1,
        'NotTrustedForAccount1',
        'ethereum',
        '0xTrusted0',
        { trusted: false }
      );

      // Same address, different trust status per account
      expect(
        authorityStore.isTrustedRecipientForChain(0, '0xTrusted0', 'ethereum')
      ).toBe(true);

      expect(
        authorityStore.isTrustedRecipientForChain(1, '0xTrusted0', 'ethereum')
      ).toBe(false);
    });
  });

  describe('Defensive Validation', () => {
    it('should reject undefined account_index in SigningHistory', () => {
      expect(() => {
        signingHistory.addRecord({
          requestId: 'test',
          type: 'manual',
          method: 'sign_transaction',
          to: '0xTest',
          value: '1',
          token: 'ETH',
          chain: 'ethereum',
          estimatedUSD: 1,
          accountIndex: undefined as any,
        });
      }).toThrow('account_index is required');
    });

    it('should reject invalid account_index range in SigningHistory', () => {
      expect(() => {
        signingHistory.addRecord({
          requestId: 'test',
          type: 'manual',
          method: 'sign_transaction',
          to: '0xTest',
          value: '1',
          token: 'ETH',
          chain: 'ethereum',
          estimatedUSD: 1,
          accountIndex: 10, // Out of range (0-9)
        });
      }).toThrow('Invalid account_index');
    });

    it('should reject undefined account_index in WalletAuthorityStore', () => {
      expect(() => {
        authorityStore.upsertContact(
          undefined as any,
          'Test',
          'ethereum',
          '0xTest'
        );
      }).toThrow('account_index is required');
    });

    it('should reject invalid account_index range in WalletAuthorityStore', () => {
      expect(() => {
        authorityStore.upsertContact(
          -1,
          'Test',
          'ethereum',
          '0xTest'
        );
      }).toThrow('Invalid account_index');
    });
  });
});
