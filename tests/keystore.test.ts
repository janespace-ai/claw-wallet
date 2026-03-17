import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import {
  generateWallet,
  encryptKey,
  decryptKey,
  getAddress,
  saveKeystore,
  loadKeystore,
  keystoreExists,
} from "../src/keystore.js";

const TEST_PASSWORD = "test-password-123";

describe("keystore", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-wallet-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("generateWallet", () => {
    it("generates a valid private key and address", () => {
      const { privateKey, address } = generateWallet();
      expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("generates different wallets each time", () => {
      const w1 = generateWallet();
      const w2 = generateWallet();
      expect(w1.privateKey).not.toBe(w2.privateKey);
      expect(w1.address).not.toBe(w2.address);
    });
  });

  describe("encryptKey / decryptKey", () => {
    it("encrypts and decrypts a private key", () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const decrypted = decryptKey(keystore, TEST_PASSWORD);
      expect(decrypted).toBe(privateKey);
    });

    it("rejects wrong password", () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      expect(() => decryptKey(keystore, "wrong-password")).toThrow(
        "Invalid password or corrupted keystore"
      );
    });

    it("produces valid keystore V3 structure", () => {
      const { privateKey, address } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      expect(keystore.version).toBe(3);
      expect(keystore.address).toBe(address);
      expect(keystore.crypto.cipher).toBe("aes-256-gcm");
      expect(keystore.crypto.kdf).toBe("scrypt");
      expect(keystore.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("getAddress", () => {
    it("returns address without decryption", () => {
      const { privateKey, address } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      expect(getAddress(keystore)).toBe(address);
    });
  });

  describe("saveKeystore / loadKeystore", () => {
    it("saves and loads keystore file", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const filePath = join(tempDir, "keystore.json");

      await saveKeystore(keystore, filePath);
      const loaded = await loadKeystore(filePath);

      expect(loaded.address).toBe(keystore.address);
      expect(loaded.crypto.ciphertext).toBe(keystore.crypto.ciphertext);

      const decrypted = decryptKey(loaded, TEST_PASSWORD);
      expect(decrypted).toBe(privateKey);
    });
  });

  describe("keystoreExists", () => {
    it("returns false for non-existent file", async () => {
      const result = await keystoreExists(join(tempDir, "nope.json"));
      expect(result).toBe(false);
    });

    it("returns true for existing file", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const filePath = join(tempDir, "keystore.json");
      await saveKeystore(keystore, filePath);
      expect(await keystoreExists(filePath)).toBe(true);
    });
  });
});
