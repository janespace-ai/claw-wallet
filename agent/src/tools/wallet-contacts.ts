import { ContactsManager } from "../contacts.js";
import type { WalletConnection } from "../wallet-connection.js";
import type { ToolDefinition, SupportedChain } from "../types.js";
import type { Address } from "viem";
import { validateContactName, validateAddress } from "../validation.js";

interface DesktopContactRow {
  name: string;
  chain: string;
  address: string;
  trusted?: boolean;
}

function mirrorDesktopToLocal(contacts: ContactsManager, rows: DesktopContactRow[]): void {
  for (const r of rows) {
    const ch = r.chain as SupportedChain;
    contacts.addContact(r.name, { [ch]: r.address as Address });
    if (r.trusted === true) {
      contacts.setTrustedOnChain(r.name, ch, true);
    }
  }
}

export function createWalletContactsTools(
  walletConnection: WalletConnection,
  contacts: ContactsManager,
  defaultChain: SupportedChain,
): ToolDefinition[] {
  return [
    {
      name: "wallet_contacts_list",
      description:
        "List contacts from the paired Desktop wallet (authoritative). Falls back to local cache if offline. Updates local contacts.json as a non-authoritative mirror.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        if (walletConnection.hasPairing()) {
          try {
            const res = (await walletConnection.sendToWallet("wallet_contacts_list", {})) as {
              contacts: DesktopContactRow[];
            };
            const rows = res.contacts ?? [];
            for (const r of rows) {
              contacts.addContact(r.name, { [r.chain as SupportedChain]: r.address as Address });
            }
            await contacts.save().catch(() => {});
            if (rows.length === 0) return { contacts: [], message: "No contacts on Desktop." };
            return { contacts: rows, source: "desktop" };
          } catch {
            /* fall through */
          }
        }
        const list = contacts.listContacts();
        if (list.length === 0) return { contacts: [], message: "No contacts stored (local cache)." };
        return { contacts: list, source: "local_cache" };
      },
    },
    {
      name: "wallet_contacts_add",
      description:
        "Propose a contact to the Desktop wallet. The user must choose normal contact, trusted contact, or reject in the app before it is saved. Mirrors to local contacts.json on success.",
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
        validateContactName(args.name as string);
        validateAddress(args.address);
        if (!walletConnection.hasPairing()) {
          const contact = contacts.addContact(args.name as string, {
            [chain]: args.address as Address,
          });
          await contacts.save();
          return { contact, message: `Contact saved locally only (no Desktop paired).` };
        }
        const result = (await walletConnection.sendToWallet("wallet_contacts_add", {
          name: args.name,
          address: args.address,
          chain,
        })) as { contact: DesktopContactRow };
        const row = result.contact;
        mirrorDesktopToLocal(contacts, [row]);
        await contacts.save();
        return {
          contact: row,
          trusted: row.trusted === true,
          message: `Contact "${row.name}" saved on Desktop (user confirmed).`,
        };
      },
    },
    {
      name: "wallet_contacts_resolve",
      description:
        "Look up a contact's wallet address by name (Desktop first, then local cache).",
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
        if (walletConnection.hasPairing()) {
          try {
            const resolved = (await walletConnection.sendToWallet("wallet_contacts_resolve", {
              name: args.name,
              chain,
            })) as { address: string; chain: string; exactMatch: boolean; trusted?: boolean };
            mirrorDesktopToLocal(contacts, [
              {
                name: args.name as string,
                chain: resolved.chain,
                address: resolved.address,
                trusted: resolved.trusted === true,
              },
            ]);
            await contacts.save().catch(() => {});
            return {
              address: resolved.address,
              chain: resolved.chain,
              exactMatch: resolved.exactMatch,
              trusted: resolved.trusted === true,
              source: "desktop",
            };
          } catch {
            /* local fallback */
          }
        }
        const result = contacts.resolveContact(args.name as string, chain);
        if (!result) return { error: `Contact "${args.name}" not found.` };
        return {
          address: result.address,
          chain: result.chain,
          exactMatch: result.exact,
          source: "local_cache",
        };
      },
    },
    {
      name: "wallet_contacts_remove",
      description: "Remove a contact by name on Desktop and locally.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name to remove" },
        },
        required: ["name"],
      },
      execute: async (args) => {
        if (walletConnection.hasPairing()) {
          try {
            await walletConnection.sendToWallet("wallet_contacts_remove", { name: args.name });
          } catch {
            /* continue with local removal */
          }
        }
        const removed = contacts.removeContact(args.name as string);
        if (!removed) return { error: `Contact "${args.name}" not found locally.` };
        await contacts.save();
        return { message: `Contact "${args.name}" removed.` };
      },
    },
  ];
}
