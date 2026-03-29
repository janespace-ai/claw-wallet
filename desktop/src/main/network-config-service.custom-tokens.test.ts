import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_DATA = join(process.cwd(), ".vitest-network-config-userdata");

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => (name === "userData" ? TEST_USER_DATA : "/tmp"),
  },
}));

import { NetworkConfigService } from "./network-config-service.js";

const userConfigPath = () => join(TEST_USER_DATA, "network-config-user.json");

describe("NetworkConfigService custom ERC-20", () => {
  beforeEach(() => {
    mkdirSync(TEST_USER_DATA, { recursive: true });
    if (existsSync(userConfigPath())) {
      rmSync(userConfigPath());
    }
  });

  afterEach(() => {
    if (existsSync(userConfigPath())) {
      rmSync(userConfigPath());
    }
  });

  it("addCustomToken persists overlay and merges into getAllTokens", () => {
    const svc = new NetworkConfigService();
    svc.load();
    const addr = "0x1111111111111111111111111111111111111111";
    svc.addCustomToken({
      chainId: 1,
      contractAddress: addr,
      symbol: "MYTEST",
      name: "My Test",
      decimals: 18,
    });
    const t = svc.getToken("MYTEST");
    expect(t?.contracts["1"]).toBe(ethers.getAddress(addr));
    expect(svc.listCustomTokens().some((x) => x.symbol === "MYTEST")).toBe(true);
    const saved = JSON.parse(readFileSync(userConfigPath(), "utf-8")) as { tokens?: Record<string, { contracts?: Record<string, string> }> };
    expect(saved.tokens?.MYTEST?.contracts?.["1"]).toBeDefined();
  });

  it("removeCustomToken removes user contract and drops empty user file when alone", () => {
    const svc = new NetworkConfigService();
    svc.load();
    svc.addCustomToken({
      chainId: 1,
      contractAddress: "0x2222222222222222222222222222222222222222",
      symbol: "RMV",
      decimals: 18,
    });
    expect(existsSync(userConfigPath())).toBe(true);
    svc.removeCustomToken("RMV", 1);
    expect(svc.getToken("RMV")).toBeNull();
    expect(svc.listCustomTokens().length).toBe(0);
    expect(existsSync(userConfigPath())).toBe(false);
  });

  it("rejects invalid address and unsupported chain", () => {
    const svc = new NetworkConfigService();
    svc.load();
    expect(() =>
      svc.addCustomToken({
        chainId: 1,
        contractAddress: "not-an-address",
        symbol: "BAD",
      }),
    ).toThrow(/Invalid contract address/);
    expect(() =>
      svc.addCustomToken({
        chainId: 999999999,
        contractAddress: "0x3333333333333333333333333333333333333333",
        symbol: "BAD",
      }),
    ).toThrow(/Unsupported chain/);
  });
});
