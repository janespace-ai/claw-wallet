import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { SignerDaemon } from "../../src/signer/daemon.js";
import { SignerClient } from "../../src/signer/ipc-client.js";
import type { AuthProvider, SigningContext } from "../../src/signer/auth-provider.js";
import type { Address } from "viem";

class MockAuthProvider implements AuthProvider {
  pin = "test-pin-123";
  confirmResult = true;
  secretInput = "";
  calls: string[] = [];

  async requestPin(_ctx: SigningContext): Promise<string> {
    this.calls.push("requestPin");
    return this.pin;
  }
  async requestConfirm(_ctx: SigningContext): Promise<boolean> {
    this.calls.push("requestConfirm");
    return this.confirmResult;
  }
  async requestSecretInput(_prompt: string): Promise<string> {
    this.calls.push("requestSecretInput");
    return this.secretInput;
  }
  notify(message: string): void {
    this.calls.push(`notify:${message.slice(0, 30)}`);
  }
}

describe("Signer integration", () => {
  let tempDir: string;
  let daemon: SignerDaemon;
  let client: SignerClient;
  let auth: MockAuthProvider;
  let socketPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-signer-test-"));
    socketPath = join(tempDir, "signer.sock");
    auth = new MockAuthProvider();
    daemon = new SignerDaemon({
      dataDir: tempDir,
      socketPath,
      authProvider: auth,
      sessionTtlMs: 60_000,
    });
    await daemon.start();
    client = new SignerClient(socketPath, 10_000);
  });

  afterEach(async () => {
    await daemon.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates wallet and returns address", async () => {
    const result = await client.call("create_wallet") as { address: string };
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(auth.calls).toContain("requestPin");
  });

  it("get_address returns address after creation", async () => {
    await client.call("create_wallet");
    const result = await client.call("get_address") as { address: string };
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("get_address errors when no wallet exists", async () => {
    await expect(client.call("get_address")).rejects.toThrow(/No wallet/);
  });

  it("create_wallet errors if wallet already exists", async () => {
    await client.call("create_wallet");
    await expect(client.call("create_wallet")).rejects.toThrow(/already exists/);
  });

  it("import_wallet via interactive mode", async () => {
    const { generateWallet } = await import("../../src/keystore.js");
    const { privateKey } = generateWallet();
    auth.secretInput = privateKey;
    const result = await client.call("import_wallet") as { address: string };
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(auth.calls).toContain("requestSecretInput");
    expect(auth.calls).toContain("requestPin");
  });

  it("lock and unlock session", async () => {
    await client.call("create_wallet");
    const unlockResult = await client.call("unlock") as { status: string };
    expect(unlockResult.status).toBe("unlocked");
    const lockResult = await client.call("lock") as { status: string };
    expect(lockResult.status).toBe("locked");
  });

  it("get_allowance returns default policy", async () => {
    const result = await client.call("get_allowance") as { policy: any };
    expect(result.policy.maxDailyUsd).toBe(500);
    expect(result.policy.maxPerTxUsd).toBe(100);
  });

  it("set_allowance requires PIN and updates policy", async () => {
    await client.call("create_wallet");
    const result = await client.call("set_allowance", {
      policy: { maxDailyUsd: 1000, maxPerTxUsd: 200, allowedTokens: ["ETH"], allowedRecipients: [], enabled: true }
    }) as { policy: any };
    expect(result.policy.maxDailyUsd).toBe(1000);
    expect(auth.calls.filter(c => c === "requestPin").length).toBeGreaterThanOrEqual(2);
  });

  it("sign_transaction auto-approves within allowance", async () => {
    await client.call("create_wallet");
    await client.call("unlock");

    const addr = await client.call("get_address") as { address: Address };
    const result = await client.call("sign_transaction", {
      to: "0x0000000000000000000000000000000000000002",
      value: "1000000000000000",
      gas: "21000",
      chainId: 1,
      amount: "0.001",
      amountUsd: 1,
      token: "ETH",
      chain: "base",
    }) as { signedTx: string };

    expect(result.signedTx).toMatch(/^0x/);
  });

  it("sign_transaction escalates beyond allowance", async () => {
    await client.call("create_wallet");
    await client.call("unlock");

    auth.confirmResult = true;
    const result = await client.call("sign_transaction", {
      to: "0x0000000000000000000000000000000000000002",
      value: "100000000000000000000",
      gas: "21000",
      chainId: 1,
      amount: "100",
      amountUsd: 200,
      token: "ETH",
      chain: "base",
    }) as { signedTx: string };

    expect(result.signedTx).toMatch(/^0x/);
    expect(auth.calls).toContain("requestConfirm");
  });

  it("sign_transaction rejected by user returns error", async () => {
    await client.call("create_wallet");
    await client.call("unlock");

    auth.confirmResult = false;
    await expect(
      client.call("sign_transaction", {
        to: "0x0000000000000000000000000000000000000002",
        value: "100000000000000000000",
        gas: "21000",
        chainId: 1,
        amount: "100",
        amountUsd: 200,
        token: "ETH",
        chain: "base",
      })
    ).rejects.toThrow(/rejected/);
  });
});
