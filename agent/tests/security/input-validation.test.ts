import { describe, it, expect } from "vitest";
import {
  validateAddress,
  validateAmount,
  validateTokenSymbol,
  validateContactName,
  validateKeystoreSchema,
  ValidationError,
} from "../../validation.js";
import { getAddress } from "viem";

describe("security-input-validation", () => {
  describe("address format", () => {
    it("accepts valid checksummed address", () => {
      const addr = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(validateAddress(addr)).toBe(addr);
    });

    it("rejects non-hex characters", () => {
      expect(() => validateAddress("0xGGGGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toThrow(ValidationError);
      expect(() => validateAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaGG")).toThrow();
    });

    it("rejects wrong length", () => {
      expect(() => validateAddress("0x" + "a".repeat(38))).toThrow(/40 hex|length/);
      expect(() => validateAddress("0x" + "a".repeat(42))).toThrow(/40 hex|length/);
    });

    it("rejects invalid checksum (mixed case but wrong)", () => {
      expect(() => validateAddress("0xAAAAAAAAaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toThrow();
    });

    it("accepts all-lowercase address", () => {
      const lower = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      expect(validateAddress(lower)).toBe(getAddress(lower));
    });
  });

  describe("amount boundary", () => {
    it("rejects zero", () => {
      expect(() => validateAmount("0")).toThrow(ValidationError);
      expect(() => validateAmount(0)).toThrow();
    });

    it("rejects negative", () => {
      expect(() => validateAmount("-1")).toThrow(ValidationError);
      expect(() => validateAmount(-0.01)).toThrow();
    });

    it("rejects NaN", () => {
      expect(() => validateAmount("abc")).toThrow(/Invalid amount|not a number/);
      expect(() => validateAmount("NaN")).toThrow();
    });

    it("rejects Infinity", () => {
      expect(() => validateAmount("Infinity")).toThrow(/Infinity|Invalid amount/);
      expect(() => validateAmount(Infinity)).toThrow();
    });

    it("handles very large amount string without throwing overflow", () => {
      const s = "999999999999999999999999";
      expect(() => validateAmount(s)).not.toThrow();
      expect(validateAmount(s)).toBe(s);
    });
  });

  describe("token input", () => {
    it("rejects token with path traversal or script chars", () => {
      expect(() => validateTokenSymbol("../foo")).toThrow();
      expect(() => validateTokenSymbol("<script>")).toThrow(/invalid/);
      expect(() => validateTokenSymbol("USDC\"")).toThrow();
    });

    it("rejects excessively long symbol (non-address)", () => {
      expect(() => validateTokenSymbol("A".repeat(21))).toThrow(/at most 20/);
    });

    it("accepts valid symbol and address", () => {
      expect(validateTokenSymbol("USDC")).toBe("USDC");
      const addr = "0x1234567890123456789012345678901234567890";
      expect(validateTokenSymbol(addr)).toBe(getAddress(addr));
    });
  });

  describe("contact name", () => {
    it("rejects path traversal in name", () => {
      expect(() => validateContactName("../../etc/passwd")).toThrow(/path|separators/);
      expect(() => validateContactName("a/b")).toThrow();
    });

    it("rejects empty name", () => {
      expect(() => validateContactName("")).toThrow(/empty/);
      expect(() => validateContactName("   ")).toThrow();
    });

    it("rejects name longer than 100 chars", () => {
      expect(() => validateContactName("a".repeat(101))).toThrow(/100/);
    });

    it("accepts valid name", () => {
      expect(validateContactName("alice")).toBe("alice");
      expect(validateContactName("  bob  ")).toBe("bob");
    });
  });

  describe("malicious keystore JSON", () => {
    it("rejects missing crypto", () => {
      expect(() => validateKeystoreSchema({ version: 3 })).toThrow(/crypto/);
    });

    it("rejects wrong version", () => {
      expect(() =>
        validateKeystoreSchema({
          version: 2,
          crypto: { cipher: "aes-256-gcm", cipherparams: { iv: "0" }, ciphertext: "0", kdf: "scrypt", kdfparams: { dklen: 32, n: 262144, r: 8, p: 1, salt: "00" }, mac: "0" },
        })
      ).toThrow(/version/);
    });

    it("rejects oversized kdfparams.n", () => {
      expect(() =>
        validateKeystoreSchema({
          version: 3,
          address: "0x0000000000000000000000000000000000000001",
          id: "x",
          crypto: {
            cipher: "aes-256-gcm",
            cipherparams: { iv: "0".repeat(32) },
            ciphertext: "0".repeat(64),
            kdf: "scrypt",
            kdfparams: { dklen: 32, n: 2 ** 25, r: 8, p: 1, salt: "a".repeat(64) },
            mac: "0".repeat(64),
          },
        })
      ).toThrow(/n must be between|KDF/);
    });
  });
});
