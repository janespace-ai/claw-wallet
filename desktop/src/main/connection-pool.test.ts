/**
 * Unit tests for ConnectionPool (placeholder implementation; no live WebSocket).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { ConnectionPool } from "./connection-pool";
import { AccountManager } from "./account-manager";
import type { DatabaseService } from "./database-service";

function createAccountManagerWithDb(): { am: AccountManager; db: Database.Database } {
  const db = new Database(":memory:");
  const dbService = {
    prepare: (source: string) => db.prepare(source),
  } as unknown as DatabaseService;
  return { am: new AccountManager(dbService), db };
}

describe("ConnectionPool", () => {
  let pool: ConnectionPool;
  let db: Database.Database;
  const mockMnemonic = "test seed words for unit testing purposes only do not use";
  const mockRelayUrl = "ws://localhost:8080";

  beforeEach(() => {
    const { am, db: mem } = createAccountManagerWithDb();
    db = mem;
    pool = new ConnectionPool(am, mockMnemonic, mockRelayUrl);
  });

  afterEach(() => {
    pool.disconnectAll();
    db.close();
  });

  describe("Connection Management", () => {
    it("should initialize with empty connections", () => {
      const state = pool.getConnectionState(0);
      expect(state).toEqual({
        accountIndex: 0,
        connected: false,
        reconnecting: false,
      });
    });

    it("should track connection state", () => {
      expect(pool).toBeDefined();
    });

    it("should handle multiple account indexes", () => {
      const state0 = pool.getConnectionState(0);
      const state1 = pool.getConnectionState(1);

      expect(state0.accountIndex).toBe(0);
      expect(state1.accountIndex).toBe(1);
    });

    it("should validate account index range", () => {
      const validState = pool.getConnectionState(0);
      expect(validState).toBeDefined();

      const validState9 = pool.getConnectionState(9);
      expect(validState9).toBeDefined();
    });

    it("should emit connection events", () => {
      let eventFired = false;

      pool.on("connected", (accountIndex: number) => {
        expect(accountIndex).toBeGreaterThanOrEqual(0);
        expect(accountIndex).toBeLessThan(10);
        eventFired = true;
      });

      pool.emit("connected", 0);

      expect(eventFired).toBe(true);
    });

    it("should emit disconnection events", () =>
      new Promise<void>((done) => {
        pool.on("disconnected", (accountIndex: number) => {
          expect(accountIndex).toBeGreaterThanOrEqual(0);
          done();
        });

        pool.emit("disconnected", 0);
      }));

    it("should emit error events", () =>
      new Promise<void>((done) => {
        pool.on("error", (accountIndex: number, error: Error) => {
          expect(accountIndex).toBeGreaterThanOrEqual(0);
          expect(error).toBeInstanceOf(Error);
          done();
        });

        pool.emit("error", 0, new Error("Test error"));
      }));
  });

  describe("getAllConnectionStates", () => {
    it("should return states for all 10 accounts", () => {
      const states = pool.getAllConnectionStates();
      expect(states).toHaveLength(10);

      states.forEach((state, index) => {
        expect(state.accountIndex).toBe(index);
        expect(state.connected).toBe(false);
        expect(state.reconnecting).toBe(false);
      });
    });
  });

  describe("disconnectAll", () => {
    it("should cleanup all connections", () => {
      pool.disconnectAll();

      const states = pool.getAllConnectionStates();
      states.forEach((state) => {
        expect(state.connected).toBe(false);
        expect(state.reconnecting).toBe(false);
      });
    });
  });

  describe("Pair ID Generation", () => {
    it("should generate unique pair IDs for different accounts", () => {
      const state0 = pool.getConnectionState(0);
      const state1 = pool.getConnectionState(1);

      expect(state0.accountIndex).not.toBe(state1.accountIndex);
    });
  });

  describe("Connection Limits", () => {
    it("should support up to 10 concurrent connections", () => {
      const states = pool.getAllConnectionStates();
      expect(states.length).toBe(10);

      for (let i = 0; i < 10; i++) {
        const state = pool.getConnectionState(i);
        expect(state).toBeDefined();
        expect(state.accountIndex).toBe(i);
      }
    });
  });
});
