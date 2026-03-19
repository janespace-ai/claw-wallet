import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  deriveSharedKey,
  createSession,
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  destroySession,
} from "../../agent/e2ee/crypto.js";

describe("E2EE crypto", () => {
  it("generates unique key pairs", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    expect(kp1.publicKey).not.toEqual(kp2.publicKey);
    expect(kp1.privateKey).not.toEqual(kp2.privateKey);
    expect(kp1.publicKey.length).toBe(32);
    expect(kp1.privateKey.length).toBe(32);
  });

  it("derives same shared key from both sides", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const sharedA = deriveSharedKey(alice.privateKey, bob.publicKey);
    const sharedB = deriveSharedKey(bob.privateKey, alice.publicKey);
    expect(sharedA).toEqual(sharedB);
    expect(sharedA.length).toBe(32);
  });

  it("encrypt and decrypt round-trip", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const shared = deriveSharedKey(alice.privateKey, bob.publicKey);

    const sessionA = createSession(shared, "pair1");
    const sessionB = createSession(shared, "pair1");

    const plaintext = new TextEncoder().encode("hello world");
    const envelope = encrypt(sessionA, plaintext);
    const decrypted = decrypt(sessionB, envelope);

    expect(new TextDecoder().decode(decrypted)).toBe("hello world");
  });

  it("encryptJSON and decryptJSON round-trip", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const shared = deriveSharedKey(alice.privateKey, bob.publicKey);

    const sessionA = createSession(shared, "pair1");
    const sessionB = createSession(shared, "pair1");

    const data = { method: "sign_transaction", params: { to: "0xabc", value: "1000" } };
    const envelope = encryptJSON(sessionA, data);
    const decrypted = decryptJSON(sessionB, envelope);

    expect(decrypted).toEqual(data);
  });

  it("multiple messages maintain sequence", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const shared = deriveSharedKey(alice.privateKey, bob.publicKey);

    const sessionA = createSession(shared, "pair1");
    const sessionB = createSession(shared, "pair1");

    for (let i = 0; i < 10; i++) {
      const envelope = encryptJSON(sessionA, { seq: i });
      const decrypted = decryptJSON<{ seq: number }>(sessionB, envelope);
      expect(decrypted.seq).toBe(i);
    }

    expect(sessionA.sendSeq).toBe(10);
    expect(sessionB.recvSeq).toBe(9);
  });

  it("rejects replayed message (duplicate sequence)", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const shared = deriveSharedKey(alice.privateKey, bob.publicKey);

    const sessionA = createSession(shared, "pair1");
    const sessionB = createSession(shared, "pair1");

    const msg1 = encryptJSON(sessionA, { data: "first" });
    const msg2 = encryptJSON(sessionA, { data: "second" });

    decryptJSON(sessionB, msg1);
    decryptJSON(sessionB, msg2);

    expect(() => decryptJSON(sessionB, msg1)).toThrow(/duplicate|replayed/);
  });

  it("rejects sequence gap > 100", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const shared = deriveSharedKey(alice.privateKey, bob.publicKey);

    const sessionA = createSession(shared, "pair1");
    const sessionB = createSession(shared, "pair1");

    const msg1 = encryptJSON(sessionA, { data: "first" });
    decryptJSON(sessionB, msg1);

    for (let i = 0; i < 105; i++) {
      encryptJSON(sessionA, { skip: true });
    }
    const farMsg = encryptJSON(sessionA, { data: "far" });

    expect(() => decryptJSON(sessionB, farMsg)).toThrow(/gap too large/);
  });

  it("different keys cannot decrypt each other's messages", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const charlie = generateKeyPair();

    const sharedAB = deriveSharedKey(alice.privateKey, bob.publicKey);
    const sharedAC = deriveSharedKey(alice.privateKey, charlie.publicKey);

    const sessionAB = createSession(sharedAB, "pair1");
    const sessionAC = createSession(sharedAC, "pair2");

    const envelope = encryptJSON(sessionAB, { secret: "data" });
    expect(() => decryptJSON(sessionAC, envelope)).toThrow();
  });

  it("destroySession zeros the shared key", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const shared = deriveSharedKey(alice.privateKey, bob.publicKey);
    const session = createSession(shared, "pair1");

    destroySession(session);

    expect(session.sharedKey.every(b => b === 0)).toBe(true);
    expect(session.sendSeq).toBe(0);
    expect(session.recvSeq).toBe(0);
  });
});
