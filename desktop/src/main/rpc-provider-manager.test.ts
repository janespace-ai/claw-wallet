import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";
import { RPCProviderManager } from "./rpc-provider-manager";
import type { NetworkConfigService, RPCProvider } from "./network-config-service";

const CHAIN_ID = 424242;

function rpcUrl(path: string): string {
  return `http://rpc-test.invalid/${path}`;
}

function mockNetworkConfig(rpcs: RPCProvider[]): NetworkConfigService {
  return {
    getSupportedChainIds: () => [CHAIN_ID],
    getRPCProviders: (chainId: number) => (chainId === CHAIN_ID ? rpcs : []),
    getNetwork: (chainId: number) => ({ name: "Mock", chainId: chainId }),
  } as NetworkConfigService;
}

function providerUrl(p: ethers.JsonRpcProvider): string {
  return (p as unknown as { _getConnection: () => { url: string } })._getConnection().url;
}

describe("RPCProviderManager failover", () => {
  let getBlockSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getBlockSpy = vi.spyOn(ethers.JsonRpcProvider.prototype, "getBlockNumber");
  });

  afterEach(() => {
    getBlockSpy.mockRestore();
  });

  it("selects secondary RPC when primary health check fails", async () => {
    const primary = rpcUrl("primary");
    const secondary = rpcUrl("secondary");
    const rpcs: RPCProvider[] = [
      { url: primary, priority: 0, custom: false },
      { url: secondary, priority: 1, custom: false },
    ];
    const manager = new RPCProviderManager(mockNetworkConfig(rpcs));

    getBlockSpy.mockImplementation(async function (this: ethers.JsonRpcProvider) {
      const url = (this as unknown as { _getConnection: () => { url: string } })._getConnection().url;
      if (url.includes("/primary")) throw new Error("unreachable");
      return 12345;
    });

    await manager.manualHealthCheck(primary, CHAIN_ID);
    await manager.manualHealthCheck(secondary, CHAIN_ID);

    const selected = await manager.getProvider(CHAIN_ID);
    expect(providerUrl(selected)).toBe(secondary);
  });

  it("throws when all RPCs for the chain are unhealthy", async () => {
    const a = rpcUrl("a");
    const b = rpcUrl("b");
    const rpcs: RPCProvider[] = [
      { url: a, priority: 0, custom: false },
      { url: b, priority: 1, custom: false },
    ];
    const manager = new RPCProviderManager(mockNetworkConfig(rpcs));

    getBlockSpy.mockRejectedValue(new Error("down"));

    await manager.manualHealthCheck(a, CHAIN_ID);
    await manager.manualHealthCheck(b, CHAIN_ID);

    await expect(manager.getProvider(CHAIN_ID)).rejects.toThrow(/All RPC providers/);
  });

  it("among same priority, prefers lower-latency healthy RPC", async () => {
    const fast = rpcUrl("fast");
    const slow = rpcUrl("slow");
    const rpcs: RPCProvider[] = [
      { url: slow, priority: 0, custom: false },
      { url: fast, priority: 0, custom: false },
    ];
    const manager = new RPCProviderManager(mockNetworkConfig(rpcs));

    getBlockSpy.mockImplementation(async function (this: ethers.JsonRpcProvider) {
      const url = (this as unknown as { _getConnection: () => { url: string } })._getConnection().url;
      if (url.includes("/slow")) {
        await new Promise((r) => setTimeout(r, 120));
        return 1;
      }
      await new Promise((r) => setTimeout(r, 5));
      return 1;
    });

    await manager.manualHealthCheck(slow, CHAIN_ID);
    await manager.manualHealthCheck(fast, CHAIN_ID);

    const selected = await manager.getProvider(CHAIN_ID);
    expect(providerUrl(selected)).toBe(fast);
  });

  it("reuses cached JsonRpcProvider until failover target URL changes", async () => {
    const primary = rpcUrl("p1");
    const secondary = rpcUrl("p2");
    const rpcs: RPCProvider[] = [
      { url: primary, priority: 0, custom: false },
      { url: secondary, priority: 1, custom: false },
    ];
    const manager = new RPCProviderManager(mockNetworkConfig(rpcs));

    getBlockSpy.mockImplementation(async function (this: ethers.JsonRpcProvider) {
      const url = (this as unknown as { _getConnection: () => { url: string } })._getConnection().url;
      if (url.includes("/p1")) throw new Error("down");
      return 1;
    });

    await manager.manualHealthCheck(primary, CHAIN_ID);
    await manager.manualHealthCheck(secondary, CHAIN_ID);

    const first = await manager.getProvider(CHAIN_ID);
    const second = await manager.getProvider(CHAIN_ID);
    expect(first).toBe(second);
    expect(providerUrl(first)).toBe(secondary);
  });
});
