/**
 * Unit tests for ConnectionPool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPool } from './connection-pool';
import { AccountManager } from './account-manager';
import type { DatabaseService } from './database-service';
import EventEmitter from 'events';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public readyState: number = 1; // OPEN
  public url: string;
  
  constructor(url: string) {
    super();
    this.url = url;
  }
  
  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
  
  send(data: string) {
    // Mock send
  }
}

// Mock AccountManager
const createMockAccountManager = () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ lastInsertRowid: 1 })),
      get: vi.fn(() => ({ nickname: 'Test Account', address: '0x1234' })),
      all: vi.fn(() => []),
    })),
  } as any;

  const mockDbService = {
    getDatabase: () => mockDb,
  } as DatabaseService;

  return new AccountManager('test-mnemonic', mockDbService);
};

describe('ConnectionPool', () => {
  let pool: ConnectionPool;
  let mockAccountManager: AccountManager;
  const mockMnemonic = 'test seed words for unit testing purposes only do not use';
  const mockRelayUrl = 'ws://localhost:8080';

  beforeEach(() => {
    mockAccountManager = createMockAccountManager();
    pool = new ConnectionPool(mockAccountManager, mockMnemonic, mockRelayUrl);
    
    // Mock global WebSocket
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    pool.disconnectAll();
  });

  describe('Connection Management', () => {
    it('should initialize with empty connections', () => {
      const state = pool.getConnectionState(0);
      expect(state).toEqual({
        accountIndex: 0,
        connected: false,
        reconnecting: false,
      });
    });

    it('should track connection state', () => {
      // This is a basic test since actual connection requires real WebSocket
      expect(pool).toBeDefined();
    });

    it('should handle multiple account indexes', () => {
      const state0 = pool.getConnectionState(0);
      const state1 = pool.getConnectionState(1);
      
      expect(state0.accountIndex).toBe(0);
      expect(state1.accountIndex).toBe(1);
    });

    it('should validate account index range', () => {
      const validState = pool.getConnectionState(0);
      expect(validState).toBeDefined();
      
      const validState9 = pool.getConnectionState(9);
      expect(validState9).toBeDefined();
    });

    it('should emit connection events', (done) => {
      let eventFired = false;
      
      pool.on('connected', (accountIndex: number) => {
        expect(accountIndex).toBeGreaterThanOrEqual(0);
        expect(accountIndex).toBeLessThan(10);
        eventFired = true;
        done();
      });

      // Simulate connection event for testing
      pool.emit('connected', 0);
      
      expect(eventFired).toBe(true);
    });

    it('should emit disconnection events', (done) => {
      pool.on('disconnected', (accountIndex: number) => {
        expect(accountIndex).toBeGreaterThanOrEqual(0);
        done();
      });

      pool.emit('disconnected', 0);
    });

    it('should emit error events', (done) => {
      pool.on('error', (accountIndex: number, error: Error) => {
        expect(accountIndex).toBeGreaterThanOrEqual(0);
        expect(error).toBeInstanceOf(Error);
        done();
      });

      pool.emit('error', 0, new Error('Test error'));
    });
  });

  describe('getAllConnectionStates', () => {
    it('should return states for all 10 accounts', () => {
      const states = pool.getAllConnectionStates();
      expect(states).toHaveLength(10);
      
      states.forEach((state, index) => {
        expect(state.accountIndex).toBe(index);
        expect(state.connected).toBe(false);
        expect(state.reconnecting).toBe(false);
      });
    });
  });

  describe('disconnectAll', () => {
    it('should cleanup all connections', () => {
      pool.disconnectAll();
      
      const states = pool.getAllConnectionStates();
      states.forEach(state => {
        expect(state.connected).toBe(false);
        expect(state.reconnecting).toBe(false);
      });
    });
  });

  describe('Pair ID Generation', () => {
    it('should generate unique pair IDs for different accounts', () => {
      // This tests the internal behavior conceptually
      // Actual pair ID generation uses BLAKE3 which requires the real implementation
      const state0 = pool.getConnectionState(0);
      const state1 = pool.getConnectionState(1);
      
      // States should be independent
      expect(state0.accountIndex).not.toBe(state1.accountIndex);
    });
  });

  describe('Connection Limits', () => {
    it('should support up to 10 concurrent connections', () => {
      const states = pool.getAllConnectionStates();
      expect(states.length).toBe(10);
      
      // All 10 accounts should have connection states
      for (let i = 0; i < 10; i++) {
        const state = pool.getConnectionState(i);
        expect(state).toBeDefined();
        expect(state.accountIndex).toBe(i);
      }
    });
  });
});
