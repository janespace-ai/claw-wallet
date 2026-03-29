/**
 * Message Router - Route messages from all accounts to appropriate handlers
 * 
 * Receives messages from all active account WebSocket connections and routes them
 * to UI handlers regardless of currently active account. This enables cross-account
 * notifications (e.g., seeing approval requests from Account 0 while viewing Account 1).
 */

import { EventEmitter } from 'events';

export interface EncryptedMessage {
  type: string;
  payload: string;
  fromAccount?: number;
  timestamp?: number;
}

export interface DecryptedMessage {
  type: string;
  data: any;
  fromAccount: number;
}

export enum MessageType {
  SIGN_REQUEST = 'SIGN_REQUEST',
  BALANCE_UPDATE = 'BALANCE_UPDATE',
  PAIRING_STATUS = 'PAIRING_STATUS',
  TRANSACTION_CONFIRMED = 'TRANSACTION_CONFIRMED',
  SECURITY_ALERT = 'SECURITY_ALERT',
  CONTACT_ADD_REQUEST = 'CONTACT_ADD_REQUEST'
}

export enum MessagePriority {
  CRITICAL = 1,    // Signing requests, security alerts
  HIGH = 2,        // Contact requests
  MEDIUM = 3,      // Pairing status
  LOW = 4          // Balance updates
}

export class MessageRouter extends EventEmitter {
  private activeAccountIndex: number = 0;
  private messageQueue: Map<number, DecryptedMessage[]> = new Map();
  private decryptFn: (accountIndex: number, message: EncryptedMessage) => Promise<any> | null = () => null;

  constructor() {
    super();
  }

  /**
   * Set active account index
   */
  setActiveAccount(accountIndex: number): void {
    this.activeAccountIndex = accountIndex;
    console.log(`[MessageRouter] Active account set to: ${accountIndex}`);
  }

  /**
   * Get active account index
   */
  getActiveAccount(): number {
    return this.activeAccountIndex;
  }

  /**
   * Set decrypt function (provided by KeyManager/RelayBridge)
   */
  setDecryptFunction(fn: (accountIndex: number, message: EncryptedMessage) => Promise<any>): void {
    this.decryptFn = fn;
  }

  /**
   * Route incoming message from account
   */
  async route(fromAccountIndex: number, message: EncryptedMessage): Promise<void> {
    try {
      // Decrypt message using account-specific key
      const decrypted = await this.decryptFn(fromAccountIndex, message);
      
      if (!decrypted) {
        console.error(`[MessageRouter] Failed to decrypt message from account ${fromAccountIndex}`);
        return;
      }

      const decoratedMessage: DecryptedMessage = {
        type: decrypted.type || message.type,
        data: decrypted,
        fromAccount: fromAccountIndex
      };

      // Route based on message type and priority
      await this.routeByType(decoratedMessage);

    } catch (error) {
      console.error(`[MessageRouter] Error routing message from account ${fromAccountIndex}:`, error);
      this.emit('routing-error', { accountIndex: fromAccountIndex, error });
    }
  }

  /**
   * Route message based on type
   */
  private async routeByType(message: DecryptedMessage): Promise<void> {
    const { type, fromAccount } = message;

    switch (type) {
      case MessageType.SIGN_REQUEST:
        // Always show signing requests, even from inactive accounts
        await this.handleSignRequest(message);
        break;

      case MessageType.CONTACT_ADD_REQUEST:
        // Always show contact requests
        await this.handleContactRequest(message);
        break;

      case MessageType.SECURITY_ALERT:
        // Always show security alerts
        await this.handleSecurityAlert(message);
        break;

      case MessageType.PAIRING_STATUS:
        // Always process pairing status updates
        await this.handlePairingStatus(message);
        break;

      case MessageType.BALANCE_UPDATE:
        // Only process balance updates for active account
        if (fromAccount === this.activeAccountIndex) {
          await this.handleBalanceUpdate(message);
        } else {
          // Queue for later when account becomes active
          this.queueMessage(fromAccount, message);
        }
        break;

      case MessageType.TRANSACTION_CONFIRMED:
        // Process for all accounts but only show notification if from active
        await this.handleTransactionConfirmed(message);
        break;

      default:
        console.warn(`[MessageRouter] Unknown message type: ${type}`);
        this.emit('unknown-message', message);
    }
  }

  /**
   * Handle signing request (critical priority)
   */
  private async handleSignRequest(message: DecryptedMessage): Promise<void> {
    const { fromAccount, data } = message;
    
    console.log(`[MessageRouter] Sign request from account ${fromAccount}`);

    // Emit to UI with account context
    this.emit('sign-request', {
      fromAccount,
      fromAccountNickname: await this.getAccountNickname(fromAccount),
      fromAccountAddress: await this.getAccountAddress(fromAccount),
      isActiveAccount: fromAccount === this.activeAccountIndex,
      ...data
    });
  }

  /**
   * Handle contact add request
   */
  private async handleContactRequest(message: DecryptedMessage): Promise<void> {
    const { fromAccount, data } = message;
    
    console.log(`[MessageRouter] Contact request from account ${fromAccount}`);

    this.emit('contact-request', {
      fromAccount,
      fromAccountNickname: await this.getAccountNickname(fromAccount),
      isActiveAccount: fromAccount === this.activeAccountIndex,
      ...data
    });
  }

  /**
   * Handle security alert
   */
  private async handleSecurityAlert(message: DecryptedMessage): Promise<void> {
    const { fromAccount, data } = message;
    
    console.warn(`[MessageRouter] Security alert from account ${fromAccount}`);

    this.emit('security-alert', {
      fromAccount,
      fromAccountNickname: await this.getAccountNickname(fromAccount),
      ...data
    });
  }

  /**
   * Handle pairing status update
   */
  private async handlePairingStatus(message: DecryptedMessage): Promise<void> {
    const { fromAccount, data } = message;
    
    console.log(`[MessageRouter] Pairing status update from account ${fromAccount}`);

    this.emit('pairing-status', {
      fromAccount,
      ...data
    });
  }

  /**
   * Handle balance update (only for active account)
   */
  private async handleBalanceUpdate(message: DecryptedMessage): Promise<void> {
    const { fromAccount, data } = message;
    
    console.log(`[MessageRouter] Balance update from account ${fromAccount}`);

    this.emit('balance-update', {
      fromAccount,
      ...data
    });
  }

  /**
   * Handle transaction confirmed
   */
  private async handleTransactionConfirmed(message: DecryptedMessage): Promise<void> {
    const { fromAccount, data } = message;
    
    console.log(`[MessageRouter] Transaction confirmed for account ${fromAccount}`);

    this.emit('transaction-confirmed', {
      fromAccount,
      showNotification: fromAccount === this.activeAccountIndex,
      ...data
    });
  }

  /**
   * Queue message for inactive account
   */
  private queueMessage(accountIndex: number, message: DecryptedMessage): void {
    if (!this.messageQueue.has(accountIndex)) {
      this.messageQueue.set(accountIndex, []);
    }

    const queue = this.messageQueue.get(accountIndex)!;
    queue.push(message);

    // Limit queue size to prevent memory issues
    const MAX_QUEUE_SIZE = 50;
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.shift(); // Remove oldest message
    }

    console.log(`[MessageRouter] Queued message for account ${accountIndex} (queue size: ${queue.length})`);
  }

  /**
   * Process queued messages for account (called when switching to account)
   */
  async processQueuedMessages(accountIndex: number): Promise<void> {
    const queue = this.messageQueue.get(accountIndex);
    if (!queue || queue.length === 0) {
      return;
    }

    console.log(`[MessageRouter] Processing ${queue.length} queued messages for account ${accountIndex}`);

    // Process all queued messages
    for (const message of queue) {
      try {
        await this.routeByType(message);
      } catch (error) {
        console.error(`[MessageRouter] Error processing queued message:`, error);
      }
    }

    // Clear queue
    this.messageQueue.delete(accountIndex);
  }

  /**
   * Get account nickname (to be implemented by caller)
   */
  private async getAccountNickname(accountIndex: number): Promise<string> {
    // This will be set by the main application
    return `Account ${accountIndex}`;
  }

  /**
   * Get account address (to be implemented by caller)
   */
  private async getAccountAddress(accountIndex: number): Promise<string> {
    // This will be set by the main application
    return '0x...';
  }

  /**
   * Set account info resolver (called by main application)
   */
  setAccountInfoResolver(resolver: (accountIndex: number) => Promise<{ nickname: string; address: string }>): void {
    this.getAccountNickname = async (index: number) => {
      const info = await resolver(index);
      return info.nickname;
    };
    this.getAccountAddress = async (index: number) => {
      const info = await resolver(index);
      return info.address;
    };
  }

  /**
   * Get queued message count for account
   */
  getQueuedMessageCount(accountIndex: number): number {
    return this.messageQueue.get(accountIndex)?.length || 0;
  }

  /**
   * Clear queued messages for account
   */
  clearQueue(accountIndex: number): void {
    this.messageQueue.delete(accountIndex);
  }

  /**
   * Clear all queues
   */
  clearAllQueues(): void {
    this.messageQueue.clear();
  }
}
