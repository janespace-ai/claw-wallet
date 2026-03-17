import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import {
  generateWallet,
  encryptKey,
  decryptKey,
  loadKeystore,
  saveKeystore,
  signTransaction,
} from "../../src/keystore.js";
import type { KeystoreV3 } from "../../src/types.js";
import type { Hex } from "viem";

const TEST_PASSWORD = "test-password-123";

describe("security-keystore", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-sec-keystore-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("private key entropy", () => {
    it("100 generated keys are all unique", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { privateKey } = generateWallet();
        expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);
        keys.add(privateKey);
      }
      expect(keys.size).toBe(100);
    });

    it("no two consecutive keys share more than 4 leading hex chars", () => {
      const keys: string[] = [];
      for (let i = 0; i < 100; i++) {
        const { privateKey } = generateWallet();
        keys.push(privateKey.slice(2));
      }
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1];
        const b = keys[i];
        let leading = 0;
        for (let j = 0; j < a.length && a[j] === b[j]; j++) leading++;
        expect(leading).toBeLessThanOrEqual(4);
      }
    });
  });

  describe("encryption correctness", () => {
    it("ciphertext does not contain plaintext substring", () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const plainHex = privateKey.slice(2);
      expect(keystore.crypto.ciphertext).not.toContain(plainHex);
      expect(keystore.crypto.ciphertext.length).toBeGreaterThan(0);
    });

    it("same key and password produce different ciphertexts (random IV/salt)", () => {
      const { privateKey } = generateWallet();
      const k1 = encryptKey(privateKey, TEST_PASSWORD);
      const k2 = encryptKey(privateKey, TEST_PASSWORD);
      expect(k1.crypto.ciphertext).not.toBe(k2.crypto.ciphertext);
      expect(k1.crypto.cipherparams.iv).not.toBe(k2.crypto.cipherparams.iv);
      expect(k1.crypto.kdfparams.salt).not.toBe(k2.crypto.kdfparams.salt);
    });

    it("tampering with one byte of ciphertext causes decrypt to fail", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const hex = keystore.crypto.ciphertext;
      const tampered = hex.slice(0, 10) + (hex[10] === "a" ? "b" : "a") + hex.slice(11);
      const bad: KeystoreV3 = {
        ...keystore,
        crypto: { ...keystore.crypto, ciphertext: tampered },
      };
      expect(() => decryptKey(bad, TEST_PASSWORD)).toThrow(/Invalid password|corrupted|auth/);
    });
  });

  describe("memory clearing", () => {
    it("signTransaction completes without leaking key in error", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const invalidTx = {} as any;
      try {
        await signTransaction(keystore, TEST_PASSWORD, invalidTx);
      } catch (e: any) {
        expect(e?.message ?? String(e)).not.toMatch(privateKey.slice(2));
        expect(e?.message ?? String(e)).not.toContain("0x");
      }
    });
  });

  describe("KDF parameter validation", () => {
    it("rejects n=2^30 (DoS)", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const bad = JSON.parse(JSON.stringify(keystore)) as KeystoreV3;
      (bad.crypto.kdfparams as any).n = 2 ** 30;
      const path = join(tempDir, "keystore.json");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path, JSON.stringify(bad), "utf-8");
      await expect(loadKeystore(path)).rejects.toThrow(/n must be between|exceeds maximum|KDF/);
    });

    it("rejects dklen=0 and r=-1", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const badDklen = JSON.parse(JSON.stringify(keystore)) as KeystoreV3;
      (badDklen.crypto.kdfparams as any).dklen = 0;
      const path1 = join(tempDir, "k1.json");
      await (await import("node:fs/promises")).writeFile(path1, JSON.stringify(badDklen), "utf-8");
      await expect(loadKeystore(path1)).rejects.toThrow();

      const badR = JSON.parse(JSON.stringify(keystore)) as KeystoreV3;
      (badR.crypto.kdfparams as any).r = -1;
      const path2 = join(tempDir, "k2.json");
      await (await import("node:fs/promises")).writeFile(path2, JSON.stringify(badR), "utf-8");
      await expect(loadKeystore(path2)).rejects.toThrow();
    });

    it("rejects missing salt", async () => {
      const keystore = {
        version: 3,
        id: "test",
        address: "0x0000000000000000000000000000000000000001",
        crypto: {
          cipher: "aes-256-gcm",
          cipherparams: { iv: "0".repeat(32) },
          ciphertext: "0".repeat(64),
          kdf: "scrypt",
          kdfparams: { dklen: 32, n: 262144, r: 8, p: 1, salt: "" },
          mac: "0".repeat(64),
        },
      };
      const path = join(tempDir, "k.json");
      await (await import("node:fs/promises")).writeFile(path, JSON.stringify(keystore), "utf-8");
      await expect(loadKeystore(path)).rejects.toThrow(/salt/);
    });
  });

  describe("keystore schema validation", () => {
    it("rejects missing crypto field", async () => {
      const bad = { version: 3, id: "x", address: "0x0000000000000000000000000000000000000001" };
      const path = join(tempDir, "k.json");
      await (await import("node:fs/promises")).writeFile(path, JSON.stringify(bad), "utf-8");
      await expect(loadKeystore(path)).rejects.toThrow(/crypto/);
    });

    it("rejects version 2", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const bad = JSON.parse(JSON.stringify(keystore));
      bad.version = 2;
      const path = join(tempDir, "k.json");
      await (await import("node:fs/promises")).writeFile(path, JSON.stringify(bad), "utf-8");
      await expect(loadKeystore(path)).rejects.toThrow(/version/);
    });
  });

  describe("password brute-force resistance", () => {
    it("decryptKey takes at least 100ms", async () => {
      const { privateKey } = generateWallet();
      const keystore = encryptKey(privateKey, TEST_PASSWORD);
      const start = Date.now();
      decryptKey(keystore, TEST_PASSWORD);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95);
    });
  });
});
