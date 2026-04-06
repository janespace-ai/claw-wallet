import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address } from "viem";
import type { Contact, ContactsStore, SupportedChain } from "./types.js";
import { validateContactName, validateAddress, secureWriteFile } from "./validation.js";

/**
 * All supported chains are EVM-compatible and share the same 0x address.
 * A contact saved on any of these chains can be used for transfers on any other.
 */
const EVM_CHAINS = new Set<SupportedChain>([
  "ethereum", "base", "arbitrum", "optimism", "polygon", "linea", "bsc", "sei",
]);

export class ContactsManager {
  private store: ContactsStore = { contacts: [] };
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  addContact(
    name: string,
    addresses: Partial<Record<SupportedChain, Address>>,
    supportedTokens?: string[]
  ): Contact {
    const validatedName = validateContactName(name);
    const validatedAddresses: Partial<Record<SupportedChain, Address>> = {};
    for (const [chain, addr] of Object.entries(addresses)) {
      if (addr) validatedAddresses[chain as SupportedChain] = validateAddress(addr);
    }
    const existing = this.store.contacts.find(
      (c) => c.name.toLowerCase() === validatedName.toLowerCase()
    );

    if (existing) {
      // One display name = one chain + address (matches Desktop authoritative store).
      existing.addresses = { ...validatedAddresses };
      if (supportedTokens) existing.supportedTokens = supportedTokens;
      existing.lastUpdated = new Date().toISOString();
      return existing;
    }

    const contact: Contact = {
      name: validatedName,
      addresses: validatedAddresses,
      supportedTokens,
      lastUpdated: new Date().toISOString(),
    };
    this.store.contacts.push(contact);
    return contact;
  }

  listContacts(): Contact[] {
    return [...this.store.contacts];
  }

  resolveContact(
    name: string,
    chain: SupportedChain
  ): { address: Address; chain: SupportedChain; exact: boolean } | null {
    const contact = this.store.contacts.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (!contact) return null;

    const address = contact.addresses[chain];
    if (address) {
      return { address, chain, exact: true };
    }

    // All supported chains are EVM-compatible (same 0x address across chains).
    // Fall back to any stored EVM address when the exact chain isn't recorded.
    if (EVM_CHAINS.has(chain)) {
      for (const evmChain of EVM_CHAINS) {
        const fallback = contact.addresses[evmChain];
        if (fallback) {
          return { address: fallback, chain, exact: false };
        }
      }
    }

    return null;
  }

  setTrustedOnChain(name: string, chain: SupportedChain, trusted: boolean): void {
    const c = this.store.contacts.find(
      (x) => x.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (!c) return;
    if (!c.trustedOnChain) c.trustedOnChain = {};
    c.trustedOnChain[chain] = trusted;
    c.lastUpdated = new Date().toISOString();
  }

  removeContact(name: string): boolean {
    const idx = this.store.contacts.findIndex(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (idx === -1) return false;
    this.store.contacts.splice(idx, 1);
    return true;
  }

  async save(): Promise<void> {
    await secureWriteFile(this.filePath, JSON.stringify(this.store, null, 2));
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      this.store = JSON.parse(content) as ContactsStore;
    } catch {
      this.store = { contacts: [] };
    }
  }
}
