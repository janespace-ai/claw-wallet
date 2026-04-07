import type { Address } from "viem";
import type { WalletConnection } from "../wallet-connection.js";
import type { ToolDefinition } from "../types.js";

/**
 * wallet_sign_typed_data — Sign EIP-712 typed data messages.
 *
 * Used for DeFi protocols that require off-chain signed messages:
 * Hyperliquid orders, Permit2 gasless approvals, CoW Protocol intents, etc.
 */
export function createWalletSignTypedDataTool(
  walletConnection: WalletConnection,
  getAddress: () => Address | null,
): ToolDefinition {
  return {
    name: "wallet_sign_typed_data",
    description: `Sign EIP-712 typed data messages for DeFi protocol interactions.

Use this tool when a protocol requires a signed message rather than an on-chain transaction:
- Hyperliquid: order placement and cancellation (signed → POST to API)
- Permit2: gasless ERC-20 approvals (PermitSingle / PermitBatch)
- CoW Protocol, 1inch Fusion: off-chain order intents
- Any protocol requiring eth_signTypedData_v4

The user will be prompted to confirm in the desktop app before signing.
Returns a 65-byte hex signature you send to the protocol's HTTP API or include in a contract call.

IMPORTANT: Do NOT include "EIP712Domain" in the types object — it is derived automatically from domain fields.

Example — Hyperliquid limit order:
  domain: { name: "Exchange", chainId: 42161, verifyingContract: "0x..." }
  types:  { Order: [{ name: "asset", type: "uint32" }, { name: "isBuy", type: "bool" }, ...] }
  value:  { asset: 0, isBuy: true, limitPx: 96420, sz: "4000", ... }`,

    parameters: {
      type: "object",
      properties: {
        domain: {
          type: "object",
          description: "EIP-712 domain separator. Common fields: name, version, chainId, verifyingContract.",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            chainId: { type: "number" },
            verifyingContract: { type: "string" },
          },
        },
        types: {
          type: "object",
          description:
            "Type definitions mapping type name → array of { name, type } fields. Do NOT include EIP712Domain.",
          additionalProperties: true,
        },
        value: {
          type: "object",
          description: "The actual data to sign, matching the primary type definition.",
          additionalProperties: true,
        },
        chain: {
          type: "string",
          description: "Chain name for context (e.g. 'arbitrum', 'base'). Defaults to configured default.",
        },
      },
      required: ["domain", "types", "value"],
    },

    execute: async (args) => {
      if (!getAddress()) {
        return { error: "No wallet paired. Use wallet_pair to connect." };
      }

      const { domain, types, value, chain } = args as {
        domain: Record<string, unknown>;
        types: Record<string, unknown>;
        value: Record<string, unknown>;
        chain?: string;
      };

      try {
        const result = await walletConnection.sendToWallet("sign_typed_data", {
          domain,
          types,
          value,
          chain,
        });
        return result;
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        if (msg.includes("rejected by user") || msg.includes("USER_REJECTED")) {
          return { error: "您在桌面应用中拒绝了该签名请求。" };
        }
        if (msg.includes("Invalid typed data") || msg.includes("INVALID_TYPED_DATA")) {
          return { error: `EIP-712 数据结构无效，请检查 domain/types/value 格式: ${msg}` };
        }
        return { error: msg };
      }
    },
  };
}
