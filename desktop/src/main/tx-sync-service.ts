/**
 * Transaction Sync Service - Syncs transaction status from blockchain
 * 
 * Queries blockchain for transaction receipts and updates signing history
 * with actual on-chain status (pending → success/failed).
 */

import type { SigningHistory, TxStatus } from "./signing-history.js";

interface ChainAdapter {
  getTransactionReceipt(txHash: string, chain: string): Promise<TxStatus | null>;
}

export class TxSyncService {
  private signingHistory: SigningHistory;
  private chainAdapter: ChainAdapter;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private onTxFinalized?: (requestId: string, success: boolean) => void;
  private getActiveAccountIndexes: () => number[] = () => [0]; // Default to account 0

  constructor(signingHistory: SigningHistory, chainAdapter: ChainAdapter) {
    this.signingHistory = signingHistory;
    this.chainAdapter = chainAdapter;
  }

  /**
   * Set function to get active account indexes for syncing
   */
  setActiveAccountIndexes(fn: () => number[]): void {
    this.getActiveAccountIndexes = fn;
  }

  setOnTxFinalized(handler: ((requestId: string, success: boolean) => void) | undefined): void {
    this.onTxFinalized = handler;
  }

  /**
   * Sync transaction status immediately after signing
   */
  async syncImmediately(txHash: string, chain: string, accountIndex: number): Promise<void> {
    try {
      console.log(`[TxSync] Immediate sync for ${txHash} on ${chain} (account ${accountIndex})`);
      const receipt = await this.chainAdapter.getTransactionReceipt(txHash, chain);
      
      if (receipt) {
        const before = this.signingHistory.getRecordByTxHash(txHash, accountIndex);
        this.signingHistory.updateTxStatus(txHash, receipt);
        console.log(`[TxSync] Updated ${txHash}: ${receipt.status}`);
        const requestId = before?.request_id;
        if (requestId && this.onTxFinalized) {
          this.onTxFinalized(requestId, receipt.status === "success");
        }
      } else {
        console.log(`[TxSync] Transaction ${txHash} still pending`);
      }
    } catch (err) {
      console.error(`[TxSync] Failed to sync ${txHash}:`, err);
    }
  }

  /**
   * Start periodic sync every 30 seconds
   */
  startPeriodicSync(intervalMs = 30000): void {
    if (this.syncInterval) {
      console.log("[TxSync] Periodic sync already running");
      return;
    }

    console.log(`[TxSync] Starting periodic sync (every ${intervalMs}ms)`);
    
    // Run immediately
    this.syncPendingTransactions();
    
    // Then run periodically
    this.syncInterval = setInterval(() => {
      this.syncPendingTransactions();
    }, intervalMs);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("[TxSync] Periodic sync stopped");
    }
  }

  /**
   * Sync all pending transactions across all active accounts
   */
  private async syncPendingTransactions(): Promise<void> {
    if (this.isSyncing) {
      console.log("[TxSync] Sync already in progress, skipping");
      return;
    }

    this.isSyncing = true;

    try {
      const accountIndexes = this.getActiveAccountIndexes();
      let totalPending = 0;

      for (const accountIndex of accountIndexes) {
        const pending = this.signingHistory.getPendingTransactions(accountIndex);
        totalPending += pending.length;

        if (pending.length === 0) {
          continue;
        }

        console.log(`[TxSync] Syncing ${pending.length} pending transactions for account ${accountIndex}`);

        for (const record of pending) {
          if (record.tx_hash) {
            try {
              await this.syncImmediately(record.tx_hash, record.tx_chain, accountIndex);
              
              // Rate limit: 100ms delay between requests
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              console.error(`[TxSync] Error syncing ${record.tx_hash}:`, err);
            }
          }
        }
      }

      if (totalPending === 0) {
        console.log("[TxSync] No pending transactions to sync across all accounts");
      } else {
        console.log(`[TxSync] Sync cycle complete (${totalPending} total pending)`);
      }
    } catch (err) {
      console.error("[TxSync] Sync cycle failed:", err);
    } finally {
      this.isSyncing = false;
    }
  }
}
