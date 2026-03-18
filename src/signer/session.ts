export class SessionManager {
  private derivedKey: Buffer | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ttlMs: number;

  constructor(ttlMs = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  unlock(derivedKey: Buffer): void {
    this.lock();
    this.derivedKey = Buffer.from(derivedKey);
    this.timer = setTimeout(() => this.lock(), this.ttlMs);
  }

  lock(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.derivedKey) {
      this.derivedKey.fill(0);
      this.derivedKey = null;
    }
  }

  isUnlocked(): boolean {
    return this.derivedKey !== null;
  }

  getDerivedKey(): Buffer | null {
    return this.derivedKey;
  }

  getTtlMs(): number {
    return this.ttlMs;
  }
}
