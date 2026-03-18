import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { SignerDaemon } from "../../src/signer/daemon.js";
import { SignerClient } from "../../src/signer/ipc-client.js";
import type { AuthProvider, SigningContext, PasswordValidator } from "../../src/signer/auth-provider.js";
import type { PasswordValidationResult } from "../../src/signer/password-strength.js";

class AuthHardeningMockProvider implements AuthProvider {
  pin = "Str0ngT3stP@ss!";
  confirmResult = true;
  passwordAttempts: string[] = [];
  passwordConfirmMismatch = false;
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
    return "";
  }
  async requestPasswordWithConfirmation(
    _ctx: SigningContext,
    validator: PasswordValidator,
  ): Promise<string> {
    this.calls.push("requestPasswordWithConfirmation");
    const result = validator(this.pin);
    if (!result.valid) {
      throw new Error(`Password rejected: ${result.errors.join(", ")}`);
    }
    return this.pin;
  }
  notify(message: string): void {
    this.calls.push(`notify:${message.slice(0, 30)}`);
  }
}

describe("auth-hardening integration", () => {
  let tempDir: string;
  let auth: AuthHardeningMockProvider;
  let daemon: SignerDaemon;
  let client: SignerClient;
  let socketPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "auth-hardening-test-"));
    socketPath = join(tempDir, "signer.sock");
    auth = new AuthHardeningMockProvider();
    daemon = new SignerDaemon({
      dataDir: tempDir,
      socketPath,
      authProvider: auth,
      sessionTtlMs: 600_000,
    });
    await daemon.start();
    client = new SignerClient(socketPath);
  });

  afterEach(async () => {
    await daemon.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("7.1 — creates wallet with strong password via requestPasswordWithConfirmation", async () => {
    const result = await client.call("create_wallet") as any;
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(auth.calls).toContain("requestPasswordWithConfirmation");
  });

  it("7.1 — rejects wallet creation when password is weak", async () => {
    auth.pin = "weak";
    try {
      await client.call("create_wallet");
      expect.unreachable("Should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("Password rejected");
    }
  });

  it("7.2 — wallet creation uses password with confirmation flow", async () => {
    const result = await client.call("create_wallet") as any;
    expect(result.address).toBeDefined();
    expect(auth.calls.filter((c) => c === "requestPasswordWithConfirmation")).toHaveLength(1);
  });

  it("7.3 — rate limiter blocks after multiple failed unlock attempts", async () => {
    auth.pin = "Str0ngT3stP@ss!";
    await client.call("create_wallet");

    auth.pin = "Wr0ngP@ssword!!";
    for (let i = 0; i < 11; i++) {
      try {
        await client.call("unlock");
      } catch {
        // expected failures
      }
    }

    try {
      await client.call("unlock");
      expect.unreachable("Should be rate limited");
    } catch (err: any) {
      expect(err.message).toContain("Rate limited");
    }
  });

  it("7.4 — Level 2 transaction bypasses session (requires re-auth)", async () => {
    auth.pin = "Str0ngT3stP@ss!";
    await client.call("create_wallet");

    await client.call("unlock");
    auth.calls = [];

    await client.call("sign_transaction", {
      to: "0x1234567890abcdef1234567890abcdef12345678",
      value: "1000000000000000000",
      amountUsd: 1500,
      token: "ETH",
      chain: "base",
      chainId: 8453,
    });

    expect(auth.calls.some((c) => c === "requestPin")).toBe(true);
  });

  it("7.5 — rate limiter resets on successful authentication", async () => {
    auth.pin = "Str0ngT3stP@ss!";
    await client.call("create_wallet");

    const wrongPin = "Wr0ngP@ssword!!";
    const rightPin = auth.pin;

    auth.pin = wrongPin;
    for (let i = 0; i < 3; i++) {
      try { await client.call("unlock"); } catch {}
    }

    auth.pin = rightPin;
    const result = await client.call("unlock") as any;
    expect(result.status).toBe("unlocked");

    auth.pin = wrongPin;
    try { await client.call("unlock"); } catch {}
    try { await client.call("unlock"); } catch {}
    try { await client.call("unlock"); } catch {}

    auth.pin = rightPin;
    const result2 = await client.call("unlock") as any;
    expect(result2.status).toBe("unlocked");
  });
});
