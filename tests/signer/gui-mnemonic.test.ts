import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, access } from "node:fs/promises";
import { SignerDaemon } from "../../src/signer/daemon.js";
import { SignerClient } from "../../src/signer/ipc-client.js";
import type { AuthProvider, SigningContext, PasswordValidator } from "../../src/signer/auth-provider.js";

class MnemonicTestAuthProvider implements AuthProvider {
  pin = "Str0ngT3stP@ss!";
  displayedSecrets: Array<{ title: string; secret: string }> = [];
  calls: string[] = [];

  async requestPin(_ctx: SigningContext): Promise<string> {
    this.calls.push("requestPin");
    return this.pin;
  }
  async requestConfirm(_ctx: SigningContext): Promise<boolean> {
    this.calls.push("requestConfirm");
    return true;
  }
  async requestSecretInput(_prompt: string): Promise<string> {
    this.calls.push("requestSecretInput");
    return "";
  }
  async requestPasswordWithConfirmation(_ctx: SigningContext, _validator: PasswordValidator): Promise<string> {
    this.calls.push("requestPasswordWithConfirmation");
    return this.pin;
  }
  async displaySecretToUser(title: string, secret: string): Promise<void> {
    this.calls.push("displaySecretToUser");
    this.displayedSecrets.push({ title, secret });
  }
  notify(message: string): void {
    this.calls.push(`notify:${message.slice(0, 30)}`);
  }
}

describe("gui-mnemonic integration", () => {
  let tempDir: string;
  let auth: MnemonicTestAuthProvider;
  let daemon: SignerDaemon;
  let client: SignerClient;
  let socketPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gui-mnemonic-test-"));
    socketPath = join(tempDir, "signer.sock");
    auth = new MnemonicTestAuthProvider();
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

  it("8.5 — create_wallet generates both keystore.json and mnemonic.enc", async () => {
    const result = await client.call("create_wallet") as { address: string };
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);

    await access(join(tempDir, "keystore.json"));
    await access(join(tempDir, "mnemonic.enc"));
  });

  it("8.4 — export_mnemonic displays secret via AuthProvider, not IPC", async () => {
    await client.call("create_wallet");

    const result = await client.call("export_mnemonic") as { exported: boolean };
    expect(result.exported).toBe(true);
    expect((result as any).mnemonic).toBeUndefined();

    expect(auth.calls).toContain("displaySecretToUser");
    expect(auth.displayedSecrets).toHaveLength(1);
    const { title, secret } = auth.displayedSecrets[0];
    expect(title).toContain("Recovery");
    const words = secret.split(" ");
    expect(words).toHaveLength(12);
  });

  it("8.4 — export_mnemonic returns error when no mnemonic.enc exists", async () => {
    try {
      await client.call("export_mnemonic");
      expect.unreachable("Should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("No mnemonic available");
    }
  });

  it("8.4 — export_mnemonic rejects wrong password", async () => {
    await client.call("create_wallet");
    auth.pin = "Wr0ngP@ssword!!";
    try {
      await client.call("export_mnemonic");
      expect.unreachable("Should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("Invalid password");
    }
  });

  it("8.5 — mnemonic is deterministic (same address derives from exported mnemonic)", async () => {
    await client.call("create_wallet");
    const { address } = await client.call("get_address") as { address: string };

    await client.call("export_mnemonic");
    const mnemonic = auth.displayedSecrets[0].secret;

    const { deriveFromMnemonic } = await import("../../src/mnemonic.js");
    const derived = deriveFromMnemonic(mnemonic);
    expect(derived.address).toBe(address);
  });
});
