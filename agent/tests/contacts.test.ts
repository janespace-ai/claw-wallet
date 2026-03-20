import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { getAddress } from "viem";
import { ContactsManager } from "../contacts.js";
import type { Address } from "viem";

const ADDR_A = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") as Address;
const ADDR_B = getAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb") as Address;

describe("ContactsManager", () => {
  let tempDir: string;
  let manager: ContactsManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-contacts-test-"));
    manager = new ContactsManager(join(tempDir, "contacts.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("addContact", () => {
    it("adds a new contact", () => {
      const c = manager.addContact("alice", { base: ADDR_A });
      expect(c.name).toBe("alice");
      expect(c.addresses.base).toBe(ADDR_A);
    });

    it("merges addresses for existing contact", () => {
      manager.addContact("alice", { base: ADDR_A });
      const c = manager.addContact("alice", { ethereum: ADDR_B });
      expect(c.addresses.base).toBe(ADDR_A);
      expect(c.addresses.ethereum).toBe(ADDR_B);
    });
  });

  describe("listContacts", () => {
    it("returns all contacts", () => {
      manager.addContact("alice", { base: ADDR_A });
      manager.addContact("bob", { ethereum: ADDR_B });
      expect(manager.listContacts()).toHaveLength(2);
    });

    it("returns empty list when no contacts", () => {
      expect(manager.listContacts()).toHaveLength(0);
    });
  });

  describe("resolveContact", () => {
    it("resolves exact chain match", () => {
      manager.addContact("alice", { base: ADDR_A });
      const result = manager.resolveContact("alice", "base");
      expect(result).not.toBeNull();
      expect(result!.address).toBe(ADDR_A);
      expect(result!.exact).toBe(true);
    });

    it("falls back to another chain", () => {
      manager.addContact("alice", { base: ADDR_A });
      const result = manager.resolveContact("alice", "ethereum");
      expect(result).not.toBeNull();
      expect(result!.address).toBe(ADDR_A);
      expect(result!.exact).toBe(false);
    });

    it("returns null for unknown contact", () => {
      expect(manager.resolveContact("unknown", "base")).toBeNull();
    });

    it("is case-insensitive", () => {
      manager.addContact("Alice", { base: ADDR_A });
      expect(manager.resolveContact("alice", "base")).not.toBeNull();
      expect(manager.resolveContact("ALICE", "base")).not.toBeNull();
    });
  });

  describe("removeContact", () => {
    it("removes existing contact", () => {
      manager.addContact("alice", { base: ADDR_A });
      expect(manager.removeContact("alice")).toBe(true);
      expect(manager.listContacts()).toHaveLength(0);
    });

    it("returns false for non-existent contact", () => {
      expect(manager.removeContact("nope")).toBe(false);
    });
  });

  describe("save / load", () => {
    it("persists and restores contacts", async () => {
      manager.addContact("alice", { base: ADDR_A });
      await manager.save();

      const loaded = new ContactsManager(join(tempDir, "contacts.json"));
      await loaded.load();
      expect(loaded.listContacts()).toHaveLength(1);
      expect(loaded.resolveContact("alice", "base")!.address).toBe(ADDR_A);
    });
  });
});
