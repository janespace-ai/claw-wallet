import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { sanitizePath, secureWriteFile } from "../../agent/validation.js";
import { ContactsManager } from "../../agent/contacts.js";
import { TransactionHistory } from "../../agent/history.js";
import { PolicyEngine, createDefaultPolicy } from "../../agent/policy.js";

describe("security-file-system", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-sec-fs-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("path traversal", () => {
    it("sanitizePath normalizes and rejects path outside base", () => {
      const base = resolve(tempDir);
      expect(sanitizePath(base, "sub/file.json")).toBe(resolve(base, "sub/file.json"));
      expect(() => sanitizePath(base, "../../../etc/passwd")).toThrow(/outside/);
      expect(() => sanitizePath(base, "..")).toThrow(/outside/);
    });
  });

  describe("atomic write", () => {
    it("writing to new file then overwriting leaves valid content", async () => {
      const filePath = join(tempDir, "data.json");
      await secureWriteFile(filePath, '{"a":1}');
      const c1 = await readFile(filePath, "utf-8");
      expect(JSON.parse(c1)).toEqual({ a: 1 });
      await secureWriteFile(filePath, '{"b":2}');
      const c2 = await readFile(filePath, "utf-8");
      expect(JSON.parse(c2)).toEqual({ b: 2 });
    });
  });

  describe("JSON files use secure write", () => {
    it("contacts save uses secureWriteFile (file created with safe permissions)", async () => {
      const { getAddress } = await import("viem");
      const manager = new ContactsManager(join(tempDir, "contacts.json"));
      manager.addContact("alice", { base: getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") });
      await manager.save();
      const st = await stat(join(tempDir, "contacts.json"));
      if (process.platform !== "win32") {
        expect(st.mode & 0o777).toBe(0o600);
      }
    });

    it("history save produces valid file", async () => {
      const history = new TransactionHistory(join(tempDir, "history.json"));
      history.addRecord({
        hash: "0x00",
        direction: "sent",
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        amount: "0.1",
        token: "ETH",
        chain: "base",
        status: "confirmed",
        timestamp: Date.now(),
      });
      await history.save();
      const raw = await readFile(join(tempDir, "history.json"), "utf-8");
      expect(JSON.parse(raw)).toHaveLength(1);
    });

    it("policy save produces valid file", async () => {
      const policy = new PolicyEngine(join(tempDir, "policy.json"), createDefaultPolicy());
      await policy.save();
      const raw = await readFile(join(tempDir, "policy.json"), "utf-8");
      expect(JSON.parse(raw)).toHaveProperty("config");
    });
  });
});
