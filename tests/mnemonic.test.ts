import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import {
  generateWalletWithMnemonic,
  deriveFromMnemonic,
  encryptMnemonic,
  decryptMnemonic,
  saveMnemonic,
  loadMnemonic,
} from "../src/mnemonic.js";

describe("mnemonic", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mnemonic-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("generates a 12-word mnemonic with valid address", () => {
    const result = generateWalletWithMnemonic();
    const words = result.mnemonic.split(" ");
    expect(words).toHaveLength(12);
    expect(result.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("deterministically derives same key from same mnemonic", () => {
    const { mnemonic } = generateWalletWithMnemonic();
    const d1 = deriveFromMnemonic(mnemonic);
    const d2 = deriveFromMnemonic(mnemonic);
    expect(d1.privateKey).toBe(d2.privateKey);
    expect(d1.address).toBe(d2.address);
  });

  it("generates unique wallets each time", () => {
    const addresses = new Set<string>();
    for (let i = 0; i < 10; i++) {
      addresses.add(generateWalletWithMnemonic().address);
    }
    expect(addresses.size).toBe(10);
  });

  it("rejects invalid mnemonic", () => {
    expect(() => deriveFromMnemonic("invalid mnemonic phrase here"))
      .toThrow("Invalid mnemonic");
  });

  it("encrypts and decrypts mnemonic correctly", () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const password = "Str0ngT3stP@ss!";
    const encrypted = encryptMnemonic(mnemonic, password);
    const decrypted = decryptMnemonic(encrypted, password);
    expect(decrypted).toBe(mnemonic);
  });

  it("rejects wrong password for mnemonic decryption", () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const encrypted = encryptMnemonic(mnemonic, "CorrectP@ss123!");
    expect(() => decryptMnemonic(encrypted, "Wr0ngP@ssword!!"))
      .toThrow("Invalid password or corrupted mnemonic");
  });

  it("produces different ciphertexts for same mnemonic", () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const password = "Str0ngT3stP@ss!";
    const e1 = encryptMnemonic(mnemonic, password);
    const e2 = encryptMnemonic(mnemonic, password);
    expect(e1.equals(e2)).toBe(false);
  });

  it("saves and loads mnemonic from file", async () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const password = "Str0ngT3stP@ss!";
    const encrypted = encryptMnemonic(mnemonic, password);
    const filePath = join(tempDir, "mnemonic.enc");

    await saveMnemonic(encrypted, filePath);
    const loaded = await loadMnemonic(filePath);
    const decrypted = decryptMnemonic(loaded, password);
    expect(decrypted).toBe(mnemonic);
  });
});
