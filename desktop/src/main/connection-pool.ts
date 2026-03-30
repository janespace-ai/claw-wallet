/**
 * Connection Pool — lightweight per-account slot helper (tests / future use).
 *
 * Live Relay traffic uses `RelayBridge` + `RelayAccountChannel` (one WebSocket per account).
 * This class does not open sockets; it only models slot state for unit tests.
 */

import { EventEmitter } from "events";
import type { AccountManager } from "./account-manager.js";

export interface ConnectionPoolOptions {
  maxConnections?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  pingIntervalMs?: number;
}

export class ConnectionPool extends EventEmitter {
  private readonly maxSlots: number;

  constructor(
    _accountManager: AccountManager,
    _mnemonic: string,
    _relayUrl: string,
    options: ConnectionPoolOptions = {},
  ) {
    super();
    this.maxSlots = options.maxConnections ?? 10;
  }

  getConnectionState(accountIndex: number): {
    accountIndex: number;
    connected: boolean;
    reconnecting: boolean;
  } {
    return {
      accountIndex,
      connected: false,
      reconnecting: false,
    };
  }

  getAllConnectionStates(): Array<{
    accountIndex: number;
    connected: boolean;
    reconnecting: boolean;
  }> {
    const n = Math.min(this.maxSlots, 10);
    return Array.from({ length: n }, (_, i) => this.getConnectionState(i));
  }

  disconnectAll(): void {
    // No live sockets in placeholder implementation
  }
}
