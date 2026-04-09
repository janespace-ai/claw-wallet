import { formatEther, formatUnits } from "ethers";
import type { PriceService } from "./price-service.js";

const ERC20_TRANSFER_SELECTOR = "a9059cbb";
const ERC20_APPROVE_SELECTOR = "095ea7b3";
const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);

/** Decimals for symbols supported by desktop PriceService / typical transfers */
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  WETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
};

function decodeErc20TransferAmount(dataHex: string): bigint | null {
  const d = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  if (d.length < 8 + 128) return null;
  const sel = d.slice(0, 8).toLowerCase();
  if (sel !== ERC20_TRANSFER_SELECTOR) return null;
  const amountHex = d.slice(8 + 64, 8 + 128);
  try {
    return BigInt("0x" + amountHex);
  } catch {
    return null;
  }
}

/**
 * Decode the allowance amount from ERC-20 approve calldata.
 * approve(address spender, uint256 amount): selector + 32B spender + 32B amount
 */
function decodeErc20ApproveAmount(dataHex: string): bigint | null {
  const d = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  if (d.length < 8 + 128) return null;
  const sel = d.slice(0, 8).toLowerCase();
  if (sel !== ERC20_APPROVE_SELECTOR) return null;
  const amountHex = d.slice(8 + 64, 8 + 128); // skip selector + spender (padded to 32B)
  try {
    return BigInt("0x" + amountHex);
  } catch {
    return null;
  }
}

/** For ERC-20 approve, returns "Unlimited" for MaxUint256 or the raw amount for finite approvals. */
export function getApproveDisplayAmount(dataHex: string): string | null {
  const amount = decodeErc20ApproveAmount(dataHex);
  if (amount === null) return null;
  return amount >= MAX_UINT256 ? "Unlimited" : amount.toString();
}

function formatHumanCryptoAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n === 0) return "0";
  const maxFrac = Math.abs(n) >= 1 ? 6 : 8;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
    useGrouping: false,
  });
}

/**
 * Human-readable token amount for `sign_transaction` (native ETH value or standard ERC-20 transfer calldata).
 * Matches rules used for policy USD estimate.
 */
function computeSignTxHumanUnits(params: Record<string, unknown>): number | null {
  const tokenRaw = (params.token as string) || "ETH";
  const symbol = tokenRaw.trim().toUpperCase();
  const data = typeof params.data === "string" ? params.data : "";
  const hasErc20Transfer =
    data.length >= 138 && data.slice(0, 10).toLowerCase() === "0xa9059cbb";

  if (hasErc20Transfer) {
    const amountWei = decodeErc20TransferAmount(data);
    const decimals = TOKEN_DECIMALS[symbol];
    if (amountWei === null || decimals === undefined) return null;
    return parseFloat(formatUnits(amountWei, decimals));
  }
  if (symbol === "ETH") {
    const valueRaw = params.value;
    if (valueRaw === undefined || valueRaw === null) return null;
    let wei: bigint;
    try {
      wei = BigInt(String(valueRaw));
    } catch {
      return null;
    }
    return parseFloat(formatEther(wei));
  }
  return null;
}

/** e.g. `{ amount: "100.5", symbol: "USDC" }` for approval UI (same basis as USD estimate). */
export function getSignTransactionTransferDisplay(
  params: Record<string, unknown>,
): { amount: string; symbol: string } | null {
  const tokenRaw = (params.token as string) || "ETH";
  const symbol = tokenRaw.trim().toUpperCase();
  const data = typeof params.data === "string" ? params.data : "";

  // ERC-20 approve: show "Unlimited" or the raw allowance amount (symbol left blank
  // because the contract address is the token, not the params.token field)
  const isApprove = data.length >= 10 && data.slice(0, 10).toLowerCase() === "0x095ea7b3";
  if (isApprove) {
    const approveDisplay = getApproveDisplayAmount(data);
    if (approveDisplay !== null) return { amount: approveDisplay, symbol: "" };
    return null;
  }

  const humanUnits = computeSignTxHumanUnits(params);
  if (humanUnits === null || !Number.isFinite(humanUnits) || humanUnits < 0) return null;
  return { amount: formatHumanCryptoAmount(humanUnits), symbol };
}

export interface TxUsdEstimate {
  usd: number;
  /** False when price missing or token/calldata cannot be interpreted for policy */
  priceAvailable: boolean;
}

/**
 * Compute USD value for signing allowance checks. Does not trust Agent "USD" hints.
 */
export async function estimateSignTransactionUsd(
  params: Record<string, unknown>,
  priceService: PriceService,
): Promise<TxUsdEstimate> {
  const tokenRaw = (params.token as string) || "ETH";
  const symbol = tokenRaw.trim().toUpperCase();
  const humanUnits = computeSignTxHumanUnits(params);
  if (humanUnits === null || !Number.isFinite(humanUnits) || humanUnits < 0) {
    return { usd: 0, priceAvailable: false };
  }

  const prices = await priceService.getTokenPrices([symbol]);
  const unit = prices[symbol];
  if (typeof unit !== "number" || !Number.isFinite(unit) || unit <= 0) {
    return { usd: 0, priceAvailable: false };
  }

  return { usd: humanUnits * unit, priceAvailable: true };
}
