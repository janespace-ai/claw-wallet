import { describe, it, expect } from "vitest";
import { BalanceService, type TokenBalance } from "./balance-service.js";
import type { NetworkConfigService } from "./network-config-service.js";
import type { RPCProviderManager } from "./rpc-provider-manager.js";

function makeService(): BalanceService {
  return new BalanceService({} as NetworkConfigService, {} as RPCProviderManager);
}

function row(
  partial: Pick<TokenBalance, "symbol" | "rawAmount" | "chainId" | "chainName" | "decimals"> &
    Partial<Omit<TokenBalance, "symbol" | "rawAmount" | "chainId" | "chainName" | "decimals">>,
): TokenBalance {
  const sym = partial.symbol.toUpperCase();
  return {
    token: partial.token ?? sym,
    symbol: partial.symbol,
    amount: partial.amount ?? "0",
    rawAmount: partial.rawAmount,
    chainId: partial.chainId,
    chainName: partial.chainName,
    decimals: partial.decimals,
  };
}

describe("BalanceService.aggregateBalances", () => {
  it("sums raw amounts for the same symbol on multiple chains (same decimals)", () => {
    const agg = makeService().aggregateBalances([
      row({
        symbol: "USDC",
        amount: "1.5",
        rawAmount: "1500000",
        chainId: 1,
        chainName: "Ethereum",
        decimals: 6,
      }),
      row({
        symbol: "USDC",
        amount: "2.5",
        rawAmount: "2500000",
        chainId: 8453,
        chainName: "Base",
        decimals: 6,
      }),
    ]);
    expect(agg).toHaveLength(1);
    expect(agg[0].symbol).toBe("USDC");
    expect(agg[0].totalAmount).toBe("4.0");
    expect(agg[0].networks.map((n) => n.chainId).sort()).toEqual([1, 8453]);
  });

  it("keeps separate aggregates per symbol", () => {
    const agg = makeService().aggregateBalances([
      row({
        symbol: "ETH",
        amount: "1",
        rawAmount: "1000000000000000000",
        chainId: 1,
        chainName: "Ethereum",
        decimals: 18,
      }),
      row({
        symbol: "USDC",
        amount: "1",
        rawAmount: "1000000",
        chainId: 1,
        chainName: "Ethereum",
        decimals: 6,
      }),
    ]);
    expect(agg.map((a) => a.symbol).sort()).toEqual(["ETH", "USDC"]);
    expect(agg.find((a) => a.symbol === "ETH")?.totalAmount).toBe("1");
    expect(agg.find((a) => a.symbol === "USDC")?.totalAmount).toBe("1");
  });

  it("appends a third network to an existing aggregate", () => {
    const agg = makeService().aggregateBalances([
      row({
        symbol: "DAI",
        rawAmount: "1000000000000000000",
        amount: "1",
        chainId: 1,
        chainName: "A",
        decimals: 18,
      }),
      row({
        symbol: "DAI",
        rawAmount: "2000000000000000000",
        amount: "2",
        chainId: 10,
        chainName: "B",
        decimals: 18,
      }),
      row({
        symbol: "DAI",
        rawAmount: "500000000000000000",
        amount: "0.5",
        chainId: 8453,
        chainName: "C",
        decimals: 18,
      }),
    ]);
    expect(agg).toHaveLength(1);
    expect(agg[0].totalAmount).toBe("3.5");
    expect(agg[0].networks).toHaveLength(3);
  });
});
