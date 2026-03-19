import { KeyManager } from "./key-manager.js";

export type LockMode = "convenience" | "strict";

const STRICT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export class LockManager {
  private keyManager: KeyManager;
  private mode: LockMode = "convenience";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lockCallbacks: Array<() => void> = [];

  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
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
      }, STRICT_IDLE_TIMEOUT_MS);
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
