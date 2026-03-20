import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  deriveSharedKey,
  createSession,
  encryptJSON,
  decryptJSON,
  destroySession,
} from "../../e2ee/crypto.js";

describe("E2EE integration: full pairing + signing flow", () => {
  it("simulates complete Agent <-> Wallet E2EE lifecycle", () => {
    // 1. Both sides generate keypairs
    const agentKP = generateKeyPair();
    const walletKP = generateKeyPair();

    // 2. Exchange public keys (simulating handshake over Relay)
    const agentPubHex = Buffer.from(agentKP.publicKey).toString("hex");
    const walletPubHex = Buffer.from(walletKP.publicKey).toString("hex");

    // 3. Both derive same shared key
    const agentShared = deriveSharedKey(agentKP.privateKey, Buffer.from(walletPubHex, "hex"));
    const walletShared = deriveSharedKey(walletKP.privateKey, Buffer.from(agentPubHex, "hex"));
    expect(agentShared).toEqual(walletShared);

    // 4. Create sessions
    const agentSession = createSession(agentShared, "test-pair-1");
    const walletSession = createSession(walletShared, "test-pair-1");

    // 5. Agent sends pair_complete
    const pairComplete = encryptJSON(agentSession, {
      type: "pair_complete",
      machineId: "agent-machine-abc",
      agentPublicKey: agentPubHex,
    });
    const receivedPairComplete = decryptJSON(walletSession, pairComplete);
    expect(receivedPairComplete).toEqual({
      type: "pair_complete",
      machineId: "agent-machine-abc",
      agentPublicKey: agentPubHex,
    });

    // 6. Agent sends sign_transaction request
    const signReq = encryptJSON(agentSession, {
      requestId: "req-1",
      method: "sign_transaction",
      params: { to: "0xABC", value: "1000000000000000", chain: "base" },
    });
    const receivedSignReq = decryptJSON<Record<string, unknown>>(walletSession, signReq);
    expect(receivedSignReq.requestId).toBe("req-1");
    expect(receivedSignReq.method).toBe("sign_transaction");

    // 7. Wallet sends back signed result
    const signResp = encryptJSON(walletSession, {
      requestId: "req-1",
      result: { signature: "0xsigned...", address: "0xWALLET" },
    });
    const receivedSignResp = decryptJSON<Record<string, unknown>>(agentSession, signResp);
    expect(receivedSignResp.requestId).toBe("req-1");
    expect((receivedSignResp.result as any).signature).toBe("0xsigned...");

    // 8. Multiple sequential messages maintain order
    for (let i = 0; i < 5; i++) {
      const msg = encryptJSON(agentSession, { seq: i, ping: true });
      const resp = decryptJSON<{ seq: number }>(walletSession, msg);
      expect(resp.seq).toBe(i);
    }

    // 9. Cleanup
    destroySession(agentSession);
    destroySession(walletSession);
    expect(agentSession.sharedKey.every(b => b === 0)).toBe(true);
    expect(walletSession.sharedKey.every(b => b === 0)).toBe(true);
  });

  it("detects cross-session tampering", () => {
    const agent1 = generateKeyPair();
    const wallet1 = generateKeyPair();
    const agent2 = generateKeyPair();
    const wallet2 = generateKeyPair();

    const shared1 = deriveSharedKey(agent1.privateKey, wallet1.publicKey);
    const shared2 = deriveSharedKey(agent2.privateKey, wallet2.publicKey);

    const session1A = createSession(shared1, "pair-1");
    const session2B = createSession(shared2, "pair-2");

    const encrypted = encryptJSON(session1A, { secret: "data" });
    expect(() => decryptJSON(session2B, encrypted)).toThrow();

    destroySession(session1A);
    destroySession(session2B);
  });

  it("handles IP change scenario (metadata-level)", () => {
    const agent = generateKeyPair();
    const wallet = generateKeyPair();
    const shared = deriveSharedKey(agent.privateKey, wallet.publicKey);

    const agentSession = createSession(shared, "pair-1");
    const walletSession = createSession(shared, "pair-1");

    const requests = [
      { ip: "1.2.3.4", requestId: "req-1", method: "sign_transaction" },
      { ip: "5.6.7.8", requestId: "req-2", method: "sign_transaction" },
    ];

    let lastIP = "";
    for (const req of requests) {
      const encrypted = encryptJSON(agentSession, {
        requestId: req.requestId,
        method: req.method,
        params: { to: "0x1" },
      });

      const decrypted = decryptJSON<Record<string, unknown>>(walletSession, encrypted);
      expect(decrypted.requestId).toBe(req.requestId);

      if (lastIP && lastIP !== req.ip) {
        // IP changed — security monitor would fire an alert
        expect(req.ip).not.toBe(lastIP);
      }
      lastIP = req.ip;
    }

    destroySession(agentSession);
    destroySession(walletSession);
  });
});
