import { ContactsManager } from "../contacts.js";
import type { ToolDefinition, SupportedChain } from "../types.js";
import type { Address } from "viem";

export function createWalletContactsTools(
  contacts: ContactsManager,
  defaultChain: SupportedChain
): ToolDefinition[] {
  return [
    {
      name: "wallet_contacts_list",
      description: "List all saved contacts with their wallet addresses.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const list = contacts.listContacts();
        if (list.length === 0) return { contacts: [], message: "No contacts stored." };
        return { contacts: list };
      },
    },
    {
      name: "wallet_contacts_add",
      description: "Add or update a contact with a wallet address. Supports multiple chains.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name (e.g., trading-bot)" },
          address: { type: "string", description: "Wallet address (0x...)" },
          chain: { type: "string", description: "Chain for this address (base, ethereum)" },
        },
        required: ["name", "address"],
      },
      execute: async (args) => {
        const chain = (args.chain as SupportedChain) || defaultChain;
        const contact = contacts.addContact(
          args.name as string,
          { [chain]: args.address as Address }
        );
        await contacts.save();
        return { contact, message: `Contact "${args.name}" saved.` };
      },
    },
    {
      name: "wallet_contacts_resolve",
      description: "Look up a contact's wallet address by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name to look up" },
          chain: { type: "string", description: "Preferred chain (base, ethereum)" },
        },
        required: ["name"],
      },
      execute: async (args) => {
        const chain = (args.chain as SupportedChain) || defaultChain;
        const result = contacts.resolveContact(args.name as string, chain);
        if (!result) return { error: `Contact "${args.name}" not found.` };
        return {
          address: result.address,
          chain: result.chain,
          exactMatch: result.exact,
        };
      },
    },
    {
      name: "wallet_contacts_remove",
      description: "Remove a contact by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name to remove" },
        },
        required: ["name"],
      },
      execute: async (args) => {
        const removed = contacts.removeContact(args.name as string);
        if (!removed) return { error: `Contact "${args.name}" not found.` };
        await contacts.save();
        return { message: `Contact "${args.name}" removed.` };
      },
    },
  ];
}
