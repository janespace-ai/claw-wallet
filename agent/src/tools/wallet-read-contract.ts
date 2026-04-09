import { decodeFunctionResult, encodeFunctionData, parseAbiItem, type Abi } from "viem";
import type { Address } from "viem";
import type { ChainAdapter } from "../chain.js";
import type { SupportedChain, ToolDefinition } from "../types.js";

/**
 * wallet_read_contract — Call a view/pure smart contract function via eth_call.
 *
 * No signing or user approval required. Use this for any read-only contract call:
 * ERC-20 balanceOf, allowance, decimals, symbol, Uniswap slot0, etc.
 */
export function createWalletReadContractTool(
  chainAdapter: ChainAdapter,
  getAddress: () => Address | null,
  defaultChain: SupportedChain,
): ToolDefinition {
  return {
    name: "wallet_read_contract",
    description: `Call a view or pure smart contract function (read-only, no signing required).

Use this for ALL read-only queries: ERC-20 allowance/balanceOf/decimals/symbol,
Uniswap slot0/liquidity, Aave getUserAccountData, etc.

DO NOT use wallet_call_contract for view functions — that requires user signing approval.

Examples:
- Check USDC allowance for Uniswap router:
    to="0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
    functionSignature="allowance(address,address)"
    args='["<walletAddress>","0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"]'
- Check ERC-20 balance:
    functionSignature="balanceOf(address)"
    args='["<walletAddress>"]'
- Read token decimals:
    functionSignature="decimals()"
    args='[]'`,

    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Contract address to call (0x...)",
        },
        functionSignature: {
          type: "string",
          description: 'Human-readable function signature, e.g. "allowance(address,address)"',
        },
        args: {
          type: "string",
          description: 'JSON array of arguments, e.g. \'["0xABC...", "0xDEF..."]\'. Use decimal strings for uint256.',
        },
        chain: {
          type: "string",
          description: "Chain name (e.g. 'arbitrum', 'base'). Defaults to configured default.",
        },
      },
      required: ["to", "functionSignature", "args"],
    },

    execute: async (rawArgs) => {
      const args = rawArgs as {
        to: string;
        functionSignature: string;
        args: string;
        chain?: string;
      };

      // Parse JSON args array
      let parsedArgs: unknown[];
      try {
        parsedArgs = JSON.parse(args.args);
        if (!Array.isArray(parsedArgs)) {
          return { error: 'args must be a JSON array, e.g. ["0xABC", "0xDEF"]' };
        }
      } catch (e) {
        return { error: `args is not valid JSON: ${(e as Error).message}` };
      }

      // Convert numeric string args to BigInt for uint/int types
      const coercedArgs = parsedArgs.map((arg) => {
        if (typeof arg === "string" && /^\d+$/.test(arg)) {
          try { return BigInt(arg); } catch { return arg; }
        }
        if (Array.isArray(arg)) {
          return arg.map((a) => {
            if (typeof a === "string" && /^\d+$/.test(a)) {
              try { return BigInt(a); } catch { return a; }
            }
            return a;
          });
        }
        return arg;
      });

      // ABI-encode calldata
      let data: `0x${string}`;
      let abiItem: ReturnType<typeof parseAbiItem>;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abiItem = parseAbiItem(`function ${args.functionSignature}` as any);
        const abi: Abi = [abiItem as Abi[number]];
        const fnName = args.functionSignature.split("(")[0].trim();
        data = encodeFunctionData({ abi, functionName: fnName, args: coercedArgs as never[] });
      } catch (e) {
        return { error: `ABI encode failed — check functionSignature and args: ${(e as Error).message}` };
      }

      // Execute eth_call (no signing)
      const chain = (args.chain ?? defaultChain) as SupportedChain;
      const walletAddress = getAddress();

      try {
        const client = chainAdapter.getClient(chain);
        const resultHex = await client.call({
          account: walletAddress ?? undefined,
          to: args.to as Address,
          data,
        });

        // Decode the return value
        if (!resultHex.data || resultHex.data === "0x") {
          return { result: null, raw: "0x" };
        }

        try {
          const abi: Abi = [abiItem as Abi[number]];
          const fnName = args.functionSignature.split("(")[0].trim();
          const decoded = decodeFunctionResult({
            abi,
            functionName: fnName,
            data: resultHex.data,
          });
          // Convert BigInt values to strings for JSON serialisation
          const serialisable = JSON.parse(
            JSON.stringify(decoded, (_key, val) =>
              typeof val === "bigint" ? val.toString() : val
            )
          );
          return { result: serialisable };
        } catch {
          // Return raw hex if decoding fails
          return { result: resultHex.data };
        }
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        return { error: `eth_call failed: ${msg}` };
      }
    },
  };
}
