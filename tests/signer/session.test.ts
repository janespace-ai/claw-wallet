import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../../src/signer/session.js";

describe("Session management", () => {
  it("starts locked", () => {
    const session = new SessionManager();
    expect(session.isUnlocked()).toBe(false);
    expect(session.getDerivedKey()).toBeNull();
  });

  it("unlocks with derived key", () => {
    const session = new SessionManager();
    const key = Buffer.alloc(32, 0xaa);
    session.unlock(key);
    expect(session.isUnlocked()).toBe(true);
    expect(session.getDerivedKey()).not.toBeNull();
  });

  it("lock zeros the key", () => {
    const session = new SessionManager();
    const key = Buffer.alloc(32, 0xaa);
    session.unlock(key);
    const cached = session.getDerivedKey()!;
    session.lock();
    expect(session.isUnlocked()).toBe(false);
    expect(cached.every((b) => b === 0)).toBe(true);
  });

  it("TTL auto-expires", async () => {
    const session = new SessionManager(100);
    const key = Buffer.alloc(32, 0xbb);
    session.unlock(key);
    expect(session.isUnlocked()).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    expect(session.isUnlocked()).toBe(false);
  });
});
