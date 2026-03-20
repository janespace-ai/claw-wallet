import { KeyManager } from "./key-manager.js";

export type LockMode = "convenience" | "strict";

export interface LockManagerOptions {
  /** Idle timeout in ms before auto-lock in strict mode (default: 300000 = 5min) */
  strictIdleTimeoutMs?: number;
}

export class LockManager {
  private keyManager: KeyManager;
  private mode: LockMode = "convenience";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lockCallbacks: Array<() => void> = [];
  private strictIdleTimeoutMs: number;

  constructor(keyManager: KeyManager, options?: LockManagerOptions) {
    this.keyManager = keyManager;
    this.strictIdleTimeoutMs = options?.strictIdleTimeoutMs ?? 5 * 60 * 1000;
  }

  getMode(): LockMode {
    return this.mode;
  }

  setMode(mode: LockMode): void {
    this.mode = mode;
    this.resetIdleTimer();
  }

  onUnlock(): void {
    this.resetIdleTimer();
  }

  lock(): void {
    this.keyManager.lock();
    this.clearIdleTimer();
    for (const cb of this.lockCallbacks) {
      cb();
    }
  }

  onLock(callback: () => void): void {
    this.lockCallbacks.push(callback);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();

    if (this.mode === "strict") {
      this.idleTimer = setTimeout(() => {
        this.lock();
      }, this.strictIdleTimeoutMs);
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
