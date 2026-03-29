import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { getAddress } from "viem";
import { ClawWallet } from "../src/index.js";
import { agentConfig } from "../src/config.js";

describe("claw-wallet E2E (Phase 2 — no local signer)", () => {
  let tempDir: string;
  let wallet: ClawWallet;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-wallet-e2e-"));

    wallet = new ClawWallet({
      dataDir: tempDir,
      defaultChain: "base",
      pollIntervalMs: 999999,
    });
    await wallet.initialize();
  });

  afterAll(async () => {
    await wallet.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("1. all 17 tools are registered (Phase 2: includes wallet_pair)", () => {
    const tools = wallet.getTools();
    const toolNames = tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      "wallet_address", "wallet_approval_approve", "wallet_approval_list",
      "wallet_approval_reject", "wallet_balance", "wallet_contacts_add",
      "wallet_contacts_list", "wallet_contacts_remove", "wallet_contacts_resolve",
      "wallet_create", "wallet_estimate_gas",
      "wallet_history", "wallet_import", "wallet_pair", "wallet_policy_get", "wallet_policy_set",
      "wallet_send",
    ]);
    console.log(`  Tools registered: ${tools.length}`);
  });

  it("2. wallet_create — returns guidance to use Desktop Wallet App", async () => {
    const tools = wallet.getTools();
    const createTool = tools.find((t) => t.name === "wallet_create")!;
    const result = (await createTool.execute({})) as any;

    expect(result.message).toBeDefined();
    expect(result.message).toContain("Desktop Wallet App");
    console.log(`  Create result: ${result.message?.substring(0, 80)}`);
  });

  it("3. wallet_policy_get — returns default policy", async () => {
    const tools = wallet.getTools();
    const policyTool = tools.find((t) => t.name === "wallet_policy_get")!;
    const result = (await policyTool.execute({})) as any;

    expect(result.policy.perTransactionLimitUsd).toBe(agentConfig.policy.perTxLimitUsd);
    expect(result.policy.dailyLimitUsd).toBe(agentConfig.policy.dailyLimitUsd);
    expect(result.policy.mode).toBe(agentConfig.policy.mode);
  });

  it("4. wallet_contacts_add — adds a contact", async () => {
    const tools = wallet.getTools();
    const addTool = tools.find((t) => t.name === "wallet_contacts_add")!;
    const result = (await addTool.execute({
      name: "trading-bot",
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chain: "base",
    })) as any;

    expect(result.contact.name).toBe("trading-bot");
  });

  it("5. wallet_contacts_resolve — resolves contact to address", async () => {
    const tools = wallet.getTools();
    const resolveTool = tools.find((t) => t.name === "wallet_contacts_resolve")!;
    const result = (await resolveTool.execute({ name: "trading-bot", chain: "base" })) as any;

    expect(result.address).toBe(getAddress("0x1234567890abcdef1234567890abcdef12345678"));
  });

  it("6. wallet_history — returns empty history", async () => {
    const tools = wallet.getTools();
    const historyTool = tools.find((t) => t.name === "wallet_history")!;
    const result = (await historyTool.execute({})) as any;

    expect(result.transactions).toHaveLength(0);
  });
});
