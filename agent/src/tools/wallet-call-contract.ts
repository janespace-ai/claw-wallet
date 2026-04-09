import { encodeFunctionData, parseAbiItem, type Abi, type Hex } from "viem";
import { formatUnits } from "viem";
import type { Address } from "viem";
import type { WalletConnection } from "../wallet-connection.js";
import type { ChainAdapter } from "../chain.js";
import type { ContactsManager } from "../contacts.js";
import type { SupportedChain, ToolDefinition } from "../types.js";

/** Static map: lowercase contract address → { symbol, decimals } for known tokens across chains. */
const KNOWN_TOKEN_CONTRACTS: Record<string, { symbol: string; decimals: number }> = {
  // Arbitrum
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 },
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": { symbol: "WETH", decimals: 18 },
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": { symbol: "USDT", decimals: 6 },
  "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": { symbol: "DAI", decimals: 18 },
  // Ethereum
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18 },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6 },
  // Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 },
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18 },
};

const MAX_UINT256 = 2n ** 256n - 1n;

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

Use this for DeFi protocol interactions: ERC-20 approvals, Uniswap swaps,
Aave deposits/borrows, staking, governance voting, etc.

Provide the contract address, a human-readable function signature, and arguments as a JSON array.
Use decimal strings for uint256 values (e.g. "10000000" not 10000000).

Most DeFi interactions require a two-step pattern:
1. Approve the protocol to spend your tokens (ERC-20 approve)
2. Call the protocol method (swap, deposit, stake...)

═══ UNISWAP V3 SWAP GUIDE ═══════════════════════════════════════════

SwapRouter02 exactInputSingle signature (NO deadline field):
  exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))
  args: [tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96]

Key rules:
• tokenOut = WETH address (NOT native ETH address) — you get WETH, not ETH
• sqrtPriceLimitX96 = "0" (no price limit)
• amountOutMinimum = expected_output * (1 - slippage) — use 10-15% slippage to avoid revert
• First call wallet_balance to get current ETH/USDC price, then compute amountOutMinimum

Fee tiers — ALWAYS try multiple if one fails:
  500  (0.05%) — stable pairs: USDC/USDT, ETH/WBTC
  3000 (0.3%)  — most pairs: USDC/WETH ← try this first for USDC/ETH
  10000 (1%)  — exotic/low-liquidity pairs

If gas estimation fails with "revert" or "TooLittleReceived":
  → Reduce amountOutMinimum (use 15-20% slippage)
  → Try fee tier 3000 instead of 500
  → Verify both token addresses are correct for the chain

═══ KNOWN ADDRESSES ════════════════════════════════════════════════

Arbitrum:
- USDC:              0xaf88d065e77c8cC2239327C5EDb3A432268e5831
- WETH:              0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
- USDT:              0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
- Uniswap SwapRouter02: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
- Aave V3 Pool:      0x794a61358D6845594F94dc1DB02A252b5b4814aD

Base:
- USDC:              0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- WETH:              0x4200000000000000000000000000000000000006
- Uniswap SwapRouter02: 0x2626664c2603336E57B271c5C0b26F421741e481

Ethereum:
- USDC:              0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- WETH:              0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

Examples:
- ERC-20 approve: functionSignature="approve(address,uint256)", args='["0xRouter...", "10000000"]'
- Uniswap USDC→WETH (Arbitrum, fee=3000, 15% slippage):
    to=0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
    functionSignature="exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))"
    args='[["0xaf88d065e77c8cC2239327C5EDb3A432268e5831","0x82aF49447D8a07e3bd95BD0d56f35241523fBab1","3000","<recipient>","10000000","<minOut>","0"]]'`,

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

      // Detect ERC-20 approve and resolve the token symbol for proper display in signing UI
      const isApprove = args.functionSignature.trim().startsWith("approve(") && parsedArgs.length >= 2;
      const tokenInfo = KNOWN_TOKEN_CONTRACTS[args.to.toLowerCase()];
      const effectiveToken = isApprove && tokenInfo ? tokenInfo.symbol : "ETH";

      // For approve: compute human-readable amount for the activity record
      let amountToken: string | undefined;
      if (isApprove && tokenInfo) {
        const rawAmount = typeof parsedArgs[1] === "bigint" ? parsedArgs[1] : BigInt(String(parsedArgs[1]));
        amountToken = rawAmount >= MAX_UINT256
          ? "Unlimited"
          : parseFloat(formatUnits(rawAmount, tokenInfo.decimals)).toString();
      }

      // Fetch chain metadata needed for a valid signed tx (nonce, chainId, gas)
      const chain = (args.chain ?? defaultChain) as SupportedChain;
      const walletAddress = getAddress()!;
      const valueWei = BigInt(args.value ?? "0");

      let nonce: number, chainId: number;
      let gasEstimate: Awaited<ReturnType<ChainAdapter["estimateGas"]>>;
      try {
        [nonce, chainId, gasEstimate] = await Promise.all([
          chainAdapter.getNonce(walletAddress, chain),
          chainAdapter.getChainId(chain),
          chainAdapter.estimateGas(
            { from: walletAddress, to: args.to as Address, value: valueWei, data },
            chain,
          ),
        ]);
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        return { error: `GAS_ESTIMATE_ERROR: 预估 gas 失败，请检查合约地址和参数是否正确: ${msg}` };
      }

      const gasFeeFields = gasEstimate.maxFeePerGas
        ? {
            type: 2,
            maxFeePerGas: gasEstimate.maxFeePerGas.toString(),
            maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas!.toString(),
          }
        : {
            type: 0,
            gasPrice: gasEstimate.gasPrice.toString(),
          };

      // Sign via relay, broadcast, then notify wallet of result
      let signResult: { signedTx: Hex; requestId: string; address: string };
      try {
        signResult = await walletConnection.sendToWallet("sign_transaction", {
          to: args.to,
          data,
          value: valueWei.toString(),
          gas: ((gasEstimate.gas * 120n) / 100n).toString(), // +20% buffer for DeFi contract complexity
          nonce: nonce.toString(),
          chainId,
          chain,
          token: effectiveToken,
          ...(amountToken !== undefined ? { amount_token: amountToken } : {}),
          method: "wallet_call_contract",
          ...gasFeeFields,
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
