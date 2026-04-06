/**
 * Price Service - Multi-tier price fetching with caching
 * 
 * Fetches cryptocurrency prices from:
 * 1. Gate.com (primary)
 * 2. CoinGecko (fallback)
 * 
 * Caches prices for 5 minutes to reduce API calls.
 */

interface PriceCache {
  price: number;
  fetchedAt: number;
}

interface GateTickerResponse {
  currency_pair: string;
  last: string;
}

interface CoinGeckoResponse {
  [key: string]: { usd: number };
}

// Tokens that are USD-pegged — no API call needed, always $1
const USD_PEGGED: Set<string> = new Set(["USDT", "DAI", "USDC"]);

const TOKEN_TO_GATE_PAIR: Record<string, string> = {
  ETH:  "ETH_USDT",
  WETH: "ETH_USDT",
  BNB:  "BNB_USDT",
  MATIC:"MATIC_USDT",
  POL:  "POL_USDT",
  SEI:  "SEI_USDT",
};

const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  ETH:  "ethereum",
  WETH: "weth",
  BNB:  "binancecoin",
  MATIC:"matic-network",
  POL:  "matic-network",
  SEI:  "sei-network",
};

export class PriceService {
  private cache: Map<string, PriceCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current USD prices for multiple tokens
   * Uses multi-tier fallback: Gate.com -> CoinGecko -> cached
   */
  async getTokenPrices(tokens: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const tokensToFetch: string[] = [];

    for (const token of tokens) {
      const key = token.toUpperCase();
      // Stablecoins are always $1 — no API needed
      if (USD_PEGGED.has(key)) {
        result[token] = 1;
        continue;
      }
      const cached = this.getCachedPrice(token);
      if (cached !== null) {
        result[token] = cached;
      } else {
        tokensToFetch.push(token);
      }
    }

    if (tokensToFetch.length === 0) return result;

    // Primary: Gate.io
    let remaining = [...tokensToFetch];
    try {
      const gatePrices = await this.fetchFromGate(remaining);
      for (const [token, price] of Object.entries(gatePrices)) {
        result[token] = price;
        this.updateCache(token, price);
      }
      remaining = remaining.filter((t) => result[t] === undefined);
    } catch (gateError) {
      console.warn(`[PriceService] Gate.io failed: ${(gateError as Error).message ?? gateError}`);
    }

    // Fallback: CoinGecko for any tokens Gate couldn't price
    if (remaining.length > 0) {
      try {
        const geckoPrices = await this.fetchFromCoinGecko(remaining);
        for (const [token, price] of Object.entries(geckoPrices)) {
          result[token] = price;
          this.updateCache(token, price);
        }
      } catch (geckoError) {
        console.error(`[PriceService] CoinGecko failed: ${(geckoError as Error).message ?? geckoError}`);
      }
    }

    return result;
  }

  /**
   * Fetch prices from Gate.com API
   * Endpoint: https://api.gateio.ws/api/v4/spot/tickers
   */
  private async fetchFromGate(tokens: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    
    // Gate.com doesn't support batch requests well, so we fetch all tickers
    const response = await fetch("https://api.gateio.ws/api/v4/spot/tickers", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Gate.com API error: ${response.status}`);
    }

    const tickers = await response.json() as GateTickerResponse[];

    for (const token of tokens) {
      const pair = TOKEN_TO_GATE_PAIR[token.toUpperCase()];
      if (!pair) continue;

      const ticker = tickers.find((t) => t.currency_pair === pair);
      if (ticker && ticker.last) {
        result[token] = parseFloat(ticker.last);
      }
    }

    return result;
  }

  /**
   * Fetch prices from CoinGecko API
   * Endpoint: https://api.coingecko.com/api/v3/simple/price
   */
  private async fetchFromCoinGecko(tokens: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    const ids = tokens
      .map((t) => TOKEN_TO_COINGECKO_ID[t.toUpperCase()])
      .filter(Boolean)
      .join(",");

    if (!ids) {
      return result;
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json() as CoinGeckoResponse;

    for (const token of tokens) {
      const id = TOKEN_TO_COINGECKO_ID[token.toUpperCase()];
      if (id && data[id]?.usd) {
        result[token] = data[id].usd;
      }
    }

    return result;
  }

  private getCachedPrice(token: string): number | null {
    const cached = this.cache.get(token.toUpperCase());
    if (!cached) return null;

    const age = Date.now() - cached.fetchedAt;
    if (age > this.CACHE_TTL) {
      this.cache.delete(token.toUpperCase());
      return null;
    }

    return cached.price;
  }

  private updateCache(token: string, price: number): void {
    this.cache.set(token.toUpperCase(), {
      price,
      fetchedAt: Date.now(),
    });
  }
}
