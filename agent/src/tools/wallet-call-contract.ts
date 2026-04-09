import { encodeFunctionData, parseAbiItem, type Abi, type Hex } from "viem";
import type { Address } from "viem";
import type { WalletConnection } from "../wallet-connection.js";
import type { ChainAdapter } from "../chain.js";
import type { ContactsManager } from "../contacts.js";
import type { SupportedChain, ToolDefinition } from "../types.js";

/**
 * wallet_call_contract — Call any EVM smart contract function.
 *
 * Encodes calldata using a human-readable function signature and typed arguments
 * via viem, then routes through the existing relay → desktop signing flow.
 */
export function createWalletCallContractTool(
  walletConnection: WalletConnection,
  chainAdapter: ChainAdapter,
  contacts: ContactsManager,
  getAddress: () => Address | null,
  defaultChain: SupportedChain,
): ToolDefinition {
  return {
    name: "wallet_call_contract",
    description: `Call any smart contract function on EVM chains.

Use this for DeFi protocol interactions beyond simple token transfers:
token approvals (ERC-20 approve), Uniswap swaps, Aave deposits/borrows,
staking, governance voting, or any on-chain contract interaction.

Provide the contract address, a human-readable function signature, and arguments as a JSON array.
Use decimal strings for uint256 values to avoid overflow (e.g. "10000000" not 10000000).

Most DeFi interactions require a two-step pattern:
1. Approve the protocol to spend your tokens (ERC-20 approve)
2. Call the protocol method (swap, deposit, stake...)

Known Arbitrum addresses:
- USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
- WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
- Uniswap V3 SwapRouter: 0xE592427A0AEce92De3Edee1F18E0157C05861564
- Uniswap V3 SwapRouter02: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
- Aave V3 Pool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD

Examples:
- ERC-20 approve: functionSignature="approve(address,uint256)", args='["0xRouter...", "10000000"]'
- Uniswap swap:   functionSignature="exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))"
- Stake tokens:   functionSignature="stake(uint256)", args='["1000000000000000000"]'`,

    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Contract address to call (0x...)",
        },
        functionSignature: {
          type: "string",
          description:
            'Human-readable function signature, e.g. "approve(address,uint256)"',
        },
        args: {
          type: "string",
          description:
            'JSON array of arguments, e.g. \'["0xABC...", "1000000"]\'. Use decimal strings for uint256.',
        },
        value: {
          type: "string",
          description:
            'ETH value in wei as decimal string for payable functions (default "0").',
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
        value?: string;
        chain?: string;
      };

      if (!getAddress()) {
        return { error: "No wallet paired. Use wallet_pair to connect." };
      }

      // Parse JSON args array
      let parsedArgs: unknown[];
      try {
        parsedArgs = JSON.parse(args.args);
        if (!Array.isArray(parsedArgs)) {
          return { error: 'ABI_ENCODE_ERROR: args must be a JSON array, e.g. ["0xABC", "1000000"]' };
        }
      } catch (e) {
        return {
          error: `ABI_ENCODE_ERROR: 合约参数编码失败 — args is not valid JSON: ${(e as Error).message}`,
        };
      }

      // Convert string number args to BigInt for uint/int types
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

      // ABI-encode using viem
      let data: `0x${string}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const abiItem = parseAbiItem(`function ${args.functionSignature}` as any);
        const abi: Abi = [abiItem as Abi[number]];
        const fnName = args.functionSignature.split("(")[0].trim();
        data = encodeFunctionData({ abi, functionName: fnName, args: coercedArgs as never[] });
      } catch (e) {
        return {
          error: `ABI_ENCODE_ERROR: 合约参数编码失败，请检查 functionSignature 和 args 格式: ${(e as Error).message}`,
        };
      }

      // Sign via relay, broadcast, then notify wallet of result
      const chain = (args.chain ?? defaultChain) as SupportedChain;
      let signResult: { signedTx: Hex; requestId: string; address: string };
      try {
        signResult = await walletConnection.sendToWallet("sign_transaction", {
          to: args.to,
          data,
          value: args.value ?? "0",
          chain,
          token: "ETH",
          method: "wallet_call_contract",
        }) as typeof signResult;
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        if (msg.includes("rejected by user") || msg.includes("USER_REJECTED")) {
          return { error: "您在桌面应用中拒绝了该操作。" };
        }
        if (msg.includes("CALL_EXCEPTION") || msg.includes("execution reverted")) {
          return { error: `CALL_EXCEPTION: 合约调用失败（交易 reverted），请检查参数是否正确: ${msg}` };
        }
        return { error: msg };
      }

      // Broadcast the signed transaction
      let receipt: Awaited<ReturnType<ChainAdapter["broadcastTransaction"]>>;
      try {
        receipt = await chainAdapter.broadcastTransaction(signResult.signedTx, chain);
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        return { error: `BROADCAST_ERROR: 广播交易失败: ${msg}` };
      }

      const success = receipt.status === "success";

      // Notify wallet so trust-after-success contact saving works
      try {
        const notifyRaw = await walletConnection.sendToWallet("wallet_notify_tx_result", {
          requestId: signResult.requestId,
          success,
          txHash: receipt.transactionHash,
          chain,
        });
        const notifyRes = notifyRaw as {
          ok?: boolean;
          newContact?: { name: string; address: string; chain: string; trusted: boolean };
        };
        if (notifyRes?.newContact?.trusted) {
          const nc = notifyRes.newContact;
          contacts.addContact(nc.name, { [nc.chain]: nc.address as Address });
          contacts.setTrustedOnChain(nc.name, nc.chain as SupportedChain, true);
          await contacts.save().catch(() => {});
        }
      } catch {
        // Non-fatal: contact mirroring is best-effort
      }

      return {
        hash: receipt.transactionHash,
        status: success ? "confirmed" : "failed",
        blockNumber: receipt.blockNumber?.toString(),
        gasUsed: receipt.gasUsed?.toString(),
        message: `Transaction ${success ? "confirmed" : "failed"}. Hash: ${receipt.transactionHash}`,
      };
    },
  };
}
