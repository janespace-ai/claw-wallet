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
      description: "List all saved contacts. Fetches from Desktop wallet when paired (authoritative); falls back to local cache if offline.",
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
          return { contact, warning: "Wallet not paired — contact saved to local cache only. It will NOT appear in the desktop app. Pair the wallet first for permanent storage." };
        }
        try {
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
        } catch (e) {
          const code = (e as Error & { walletErrorCode?: string }).walletErrorCode;
          if (code === "DUPLICATE_RECIPIENT") {
            return { error: (e as Error).message, errorCode: code };
          }
          throw e;
        }
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
          } catch (e) {
            const code = (e as Error & { walletErrorCode?: string }).walletErrorCode;
            if (code === "CHAIN_MISMATCH") {
              const err = e as Error & { storedChain?: string };
              return {
                error: `Contact "${args.name}" exists but is saved on a different chain (${err.storedChain ?? "unknown"}). Either use chain: "${err.storedChain}" or ask the user to update the contact in the desktop app.`,
                errorCode: "CHAIN_MISMATCH",
                storedChain: err.storedChain,
                source: "desktop",
              };
            }
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
