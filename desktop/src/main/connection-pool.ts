/**
 * Connection Pool - Manage multiple WebSocket connections for multi-account support
 * 
 * Maintains up to 10 concurrent WebSocket connections (one per account).
 * Each connection has its own unique Pair ID and encryption session.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export interface ConnectionInfo {
  accountIndex: number;
  pairId: string;
  connected: boolean;
  lastActivity: number;
  reconnectAttempts: number;
}

export interface ConnectionPoolOptions {
  maxConnections?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  pingIntervalMs?: number;
}

export class ConnectionPool extends EventEmitter {
  private connections: Map<number, ConnectionInfo> = new Map();
  private maxConnections: number;
  private reconnectBaseMs: number;
  private reconnectMaxMs: number;
  private pingIntervalMs: number;
  private pingIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor(options: ConnectionPoolOptions = {}) {
    super();
    this.maxConnections = options.maxConnections || 10;
    this.reconnectBaseMs = options.reconnectBaseMs || 5000;
    this.reconnectMaxMs = options.reconnectMaxMs || 60000;
    this.pingIntervalMs = options.pingIntervalMs || 30000;
  }

  /**
   * Compute unique Pair ID for account
   * Uses BLAKE3-like hash of mnemonic + account index
   */
  computePairId(mnemonic: string, accountIndex: number): string {
    // For now, use SHA-256 as BLAKE3 requires additional dependency
    // In production, consider using @noble/hashes/blake3
    const hash = createHash('sha256');
    hash.update(mnemonic);
    hash.update(accountIndex.toString());
    const digest = hash.digest('hex');
    
    // Return first 32 characters (16 bytes) as hex string
    return digest.substring(0, 32);
  }

  /**
   * Connect account to relay server
   */
  async connectAccount(
    accountIndex: number,
    pairId: string,
    connectFn: (pairId: string) => Promise<boolean>
  ): Promise<void> {
    if (this.connections.size >= this.maxConnections) {
      throw new Error(`Maximum ${this.maxConnections} connections reached`);
    }

    if (this.connections.has(accountIndex)) {
      console.log(`[ConnectionPool] Account ${accountIndex} already connected`);
      return;
    }

    console.log(`[ConnectionPool] Connecting account ${accountIndex} with Pair ID ${pairId.substring(0, 8)}...`);

    try {
      const success = await connectFn(pairId);
      
      if (success) {
        this.connections.set(accountIndex, {
          accountIndex,
          pairId,
          connected: true,
          lastActivity: Date.now(),
          reconnectAttempts: 0
        });

        this.startPing(accountIndex);
        this.emit('connected', accountIndex);
        
        console.log(`[ConnectionPool] Account ${accountIndex} connected successfully`);
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      console.error(`[ConnectionPool] Failed to connect account ${accountIndex}:`, error);
      
      // Store connection info even if failed, for retry
      this.connections.set(accountIndex, {
        accountIndex,
        pairId,
        connected: false,
        lastActivity: Date.now(),
        reconnectAttempts: 0
      });

      // Schedule reconnection
      this.scheduleReconnect(accountIndex, connectFn);
      throw error;
    }
  }

  /**
   * Connect all accounts in parallel
   */
  async connectAllAccounts(
    accounts: Array<{ index: number; pairId: string }>,
    connectFn: (pairId: string) => Promise<boolean>
  ): Promise<void> {
    const connectPromises = accounts.map(account =>
      this.connectAccount(account.index, account.pairId, connectFn).catch(err => {
        console.error(`[ConnectionPool] Failed to connect account ${account.index}:`, err);
        // Don't fail entire batch if one connection fails
      })
    );

    await Promise.all(connectPromises);
    
    const connectedCount = Array.from(this.connections.values()).filter(c => c.connected).length;
    console.log(`[ConnectionPool] Connected ${connectedCount}/${accounts.length} accounts`);
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  private scheduleReconnect(
    accountIndex: number,
    connectFn: (pairId: string) => Promise<boolean>
  ): void {
    const connection = this.connections.get(accountIndex);
    if (!connection) return;

    const attempts = connection.reconnectAttempts;
    const delay = Math.min(
      this.reconnectBaseMs * Math.pow(2, attempts),
      this.reconnectMaxMs
    );

    console.log(`[ConnectionPool] Scheduling reconnect for account ${accountIndex} in ${delay}ms (attempt ${attempts + 1})`);

    setTimeout(async () => {
      const conn = this.connections.get(accountIndex);
      if (!conn || conn.connected) return;

      conn.reconnectAttempts++;
      
      try {
        const success = await connectFn(conn.pairId);
        
        if (success) {
          conn.connected = true;
          conn.reconnectAttempts = 0;
          conn.lastActivity = Date.now();
          
          this.startPing(accountIndex);
          this.emit('reconnected', accountIndex);
          
          console.log(`[ConnectionPool] Account ${accountIndex} reconnected successfully`);
        } else {
          throw new Error('Reconnection failed');
        }
      } catch (error) {
        console.error(`[ConnectionPool] Reconnection failed for account ${accountIndex}:`, error);
        this.scheduleReconnect(accountIndex, connectFn);
      }
    }, delay);
  }

  /**
   * Start ping/pong health monitoring for connection
   */
  private startPing(accountIndex: number): void {
    if (this.pingIntervals.has(accountIndex)) {
      clearInterval(this.pingIntervals.get(accountIndex)!);
    }

    const interval = setInterval(() => {
      const connection = this.connections.get(accountIndex);
      if (!connection || !connection.connected) {
        this.stopPing(accountIndex);
        return;
      }

      // Emit ping event for relay bridge to handle
      this.emit('ping', accountIndex);
      
      // Check if connection is still alive (lastActivity updated by pong)
      const timeSinceLastActivity = Date.now() - connection.lastActivity;
      if (timeSinceLastActivity > this.pingIntervalMs * 3) {
        console.warn(`[ConnectionPool] Account ${accountIndex} unresponsive, marking as disconnected`);
        this.markDisconnected(accountIndex);
      }
    }, this.pingIntervalMs);

    this.pingIntervals.set(accountIndex, interval);
  }

  /**
   * Stop ping interval for connection
   */
  private stopPing(accountIndex: number): void {
    const interval = this.pingIntervals.get(accountIndex);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(accountIndex);
    }
  }

  /**
   * Mark connection as disconnected
   */
  markDisconnected(accountIndex: number): void {
    const connection = this.connections.get(accountIndex);
    if (connection) {
      connection.connected = false;
      this.stopPing(accountIndex);
      this.emit('disconnected', accountIndex);
      console.log(`[ConnectionPool] Account ${accountIndex} marked as disconnected`);
    }
  }

  /**
   * Update last activity timestamp (called on receiving message/pong)
   */
  updateActivity(accountIndex: number): void {
    const connection = this.connections.get(accountIndex);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Disconnect specific account
   */
  async disconnectAccount(
    accountIndex: number,
    disconnectFn: (pairId: string) => Promise<void>
  ): Promise<void> {
    const connection = this.connections.get(accountIndex);
    if (!connection) return;

    this.stopPing(accountIndex);

    try {
      await disconnectFn(connection.pairId);
    } catch (error) {
      console.error(`[ConnectionPool] Error disconnecting account ${accountIndex}:`, error);
    }

    this.connections.delete(accountIndex);
    this.emit('disconnected', accountIndex);
    
    console.log(`[ConnectionPool] Account ${accountIndex} disconnected`);
  }

  /**
   * Disconnect all accounts gracefully
   */
  async disconnectAll(
    disconnectFn: (pairId: string) => Promise<void>
  ): Promise<void> {
    console.log(`[ConnectionPool] Disconnecting all ${this.connections.size} connections...`);

    const disconnectPromises = Array.from(this.connections.keys()).map(accountIndex =>
      this.disconnectAccount(accountIndex, disconnectFn).catch(err => {
        console.error(`[ConnectionPool] Failed to disconnect account ${accountIndex}:`, err);
      })
    );

    await Promise.all(disconnectPromises);
    
    console.log('[ConnectionPool] All connections disconnected');
  }

  /**
   * Get connection info for account
   */
  getConnection(accountIndex: number): ConnectionInfo | undefined {
    return this.connections.get(accountIndex);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if account is connected
   */
  isConnected(accountIndex: number): boolean {
    const connection = this.connections.get(accountIndex);
    return connection?.connected || false;
  }

  /**
   * Get connected account count
   */
  getConnectedCount(): number {
    return Array.from(this.connections.values()).filter(c => c.connected).length;
  }

  /**
   * Get Pair ID for account
   */
  getPairId(accountIndex: number): string | undefined {
    return this.connections.get(accountIndex)?.pairId;
  }
}
