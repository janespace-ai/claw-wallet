import { formatEther, formatUnits } from "ethers";
import type { PriceService } from "./price-service.js";

const ERC20_TRANSFER_SELECTOR = "a9059cbb";

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
  const data = typeof params.data === "string" ? params.data : "";
  const hasErc20Transfer =
    data.length >= 138 && data.slice(0, 10).toLowerCase() === "0xa9059cbb";

  let humanUnits: number | null = null;

  if (hasErc20Transfer) {
    const amountWei = decodeErc20TransferAmount(data);
    const decimals = TOKEN_DECIMALS[symbol];
    if (amountWei === null || decimals === undefined) {
      return { usd: 0, priceAvailable: false };
    }
    humanUnits = parseFloat(formatUnits(amountWei, decimals));
  } else if (symbol === "ETH") {
    const valueRaw = params.value;
    if (valueRaw === undefined || valueRaw === null) {
      return { usd: 0, priceAvailable: false };
    }
    let wei: bigint;
    try {
      wei = BigInt(String(valueRaw));
    } catch {
      return { usd: 0, priceAvailable: false };
    }
    humanUnits = parseFloat(formatEther(wei));
  } else {
    return { usd: 0, priceAvailable: false };
  }

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
