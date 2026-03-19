import type { Address } from "viem";
import { ChainAdapter } from "./chain.js";
import type { SupportedChain, BalanceChangeCallback, BalanceChangeEvent } from "./types.js";
import { KNOWN_TOKENS } from "./types.js";
import { formatEther, formatUnits } from "./chain.js";

interface BalanceSnapshot {
  eth: bigint;
  tokens: Map<string, { raw: bigint; decimals: number; symbol: string }>;
}

export class BalanceMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastBalances: Map<SupportedChain, BalanceSnapshot> = new Map();
  private callbacks: BalanceChangeCallback[] = [];
  private recentSentTxAmounts: Set<string> = new Set();

  constructor(
    private chainAdapter: ChainAdapter,
    private address: Address,
    private chains: SupportedChain[],
    private pollIntervalMs: number = 30_000
  ) {}

  onBalanceChange(callback: BalanceChangeCallback): void {
    this.callbacks.push(callback);
  }

  markSentTransaction(token: string, amount: string): void {
    this.recentSentTxAmounts.add(`${token}:${amount}`);
  }

  start(): void {
    if (this.intervalId) return;

    this.poll().catch(() => {});

    this.intervalId = setInterval(() => {
      this.poll().catch(() => {});
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private async poll(): Promise<void> {
    for (const chain of this.chains) {
      try {
        await this.checkChain(chain);
      } catch {
        // RPC errors shouldn't crash the monitor
      }
    }
  }

  private async checkChain(chain: SupportedChain): Promise<void> {
    const previous = this.lastBalances.get(chain);

    const { wei: ethBalance } = await this.chainAdapter.getBalance(this.address, chain);

    const tokenBalances = new Map<string, { raw: bigint; decimals: number; symbol: string }>();
    const chainTokens = KNOWN_TOKENS[chain];
    if (chainTokens) {
      for (const [symbol, tokenAddress] of Object.entries(chainTokens)) {
        try {
          const info = await this.chainAdapter.getTokenBalance(this.address, tokenAddress, chain);
          tokenBalances.set(symbol, { raw: info.raw, decimals: info.decimals, symbol: info.symbol });
        } catch {
          // Token query failed, skip
        }
      }
    }

    const snapshot: BalanceSnapshot = { eth: ethBalance, tokens: tokenBalances };
    this.lastBalances.set(chain, snapshot);

    if (!previous) return;

    if (ethBalance !== previous.eth) {
      const diff = ethBalance - previous.eth;
      const direction = diff > 0n ? "increase" : "decrease";
      const absDiff = diff > 0n ? diff : -diff;

      const key = `ETH:${formatEther(absDiff)}`;
      if (direction === "decrease" && this.recentSentTxAmounts.has(key)) {
        this.recentSentTxAmounts.delete(key);
      } else {
        this.emit({
          token: "ETH",
          chain,
          previousBalance: formatEther(previous.eth),
          newBalance: formatEther(ethBalance),
          difference: formatEther(absDiff),
          direction,
        });
      }
    }

    for (const [symbol, current] of tokenBalances) {
      const prev = previous.tokens.get(symbol);
      if (!prev) continue;

      if (current.raw !== prev.raw) {
        const diff = current.raw - prev.raw;
        const direction = diff > 0n ? "increase" : "decrease";
        const absDiff = diff > 0n ? diff : -diff;

        const key = `${symbol}:${formatUnits(absDiff, current.decimals)}`;
        if (direction === "decrease" && this.recentSentTxAmounts.has(key)) {
          this.recentSentTxAmounts.delete(key);
        } else {
          this.emit({
            token: symbol,
            chain,
            previousBalance: formatUnits(prev.raw, prev.decimals),
            newBalance: formatUnits(current.raw, current.decimals),
            difference: formatUnits(absDiff, current.decimals),
            direction,
          });
        }
      }
    }
  }

  private emit(event: BalanceChangeEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch {
        // Don't let callback errors crash the monitor
      }
    }
  }
}
