import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { getAddress } from "viem";
import { ClawWallet } from "../src/index.js";

const TEST_PASSWORD = "e2e-test-password";

describe("claw-wallet E2E", () => {
  let tempDir: string;
  let wallet: ClawWallet;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "claw-wallet-e2e-"));
    wallet = new ClawWallet({
      dataDir: tempDir,
      defaultChain: "base",
      password: TEST_PASSWORD,
      pollIntervalMs: 999999,
    });
    await wallet.initialize();
  });

  afterAll(async () => {
    await wallet.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("1. wallet_create — creates a new wallet", async () => {
    const tools = wallet.getTools();
    const createTool = tools.find((t) => t.name === "wallet_create")!;
    const result = (await createTool.execute({ password: TEST_PASSWORD })) as any;

    expect(result.error).toBeUndefined();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    console.log(`  ✅ Wallet created: ${result.address}`);
  });

  it("2. wallet_address — returns the wallet address", async () => {
    const tools = wallet.getTools();
    const addressTool = tools.find((t) => t.name === "wallet_address")!;
    const result = (await addressTool.execute({})) as any;

    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    console.log(`  ✅ Address: ${result.address}`);
  });

  it("3. wallet_balance — queries balance (will be 0 on new wallet)", async () => {
    const tools = wallet.getTools();
    const balanceTool = tools.find((t) => t.name === "wallet_balance")!;

    const result = (await balanceTool.execute({ token: "ETH", chain: "base" })) as any;

    expect(result.balance).toBeDefined();
    expect(result.token).toBe("ETH");
    console.log(`  ✅ Balance: ${result.balance} ${result.token} (${result.chain})`);
  });

  it("4. wallet_policy_get — returns default policy", async () => {
    const tools = wallet.getTools();
    const policyTool = tools.find((t) => t.name === "wallet_policy_get")!;
    const result = (await policyTool.execute({})) as any;

    expect(result.policy.perTransactionLimitUsd).toBe(100);
    expect(result.policy.dailyLimitUsd).toBe(500);
    expect(result.policy.mode).toBe("supervised");
    console.log(`  ✅ Policy: $${result.policy.perTransactionLimitUsd}/tx, $${result.policy.dailyLimitUsd}/day, mode=${result.policy.mode}`);
  });

  it("5. wallet_policy_set — updates policy to autonomous mode", async () => {
    const tools = wallet.getTools();
    const setTool = tools.find((t) => t.name === "wallet_policy_set")!;
    const result = (await setTool.execute({
      mode: "autonomous",
      per_transaction_limit_usd: 200,
      daily_limit_usd: 1000,
    })) as any;

    expect(result.policy.mode).toBe("autonomous");
    expect(result.policy.perTransactionLimitUsd).toBe(200);
    console.log(`  ✅ Policy updated: $${result.policy.perTransactionLimitUsd}/tx, mode=${result.policy.mode}`);
  });

  it("6. wallet_contacts_add — adds a contact", async () => {
    const tools = wallet.getTools();
    const addTool = tools.find((t) => t.name === "wallet_contacts_add")!;
    const result = (await addTool.execute({
      name: "trading-bot",
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chain: "base",
    })) as any;

    expect(result.contact.name).toBe("trading-bot");
    console.log(`  ✅ Contact added: ${result.contact.name}`);
  });

  it("7. wallet_contacts_list — lists contacts", async () => {
    const tools = wallet.getTools();
    const listTool = tools.find((t) => t.name === "wallet_contacts_list")!;
    const result = (await listTool.execute({})) as any;

    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0].name).toBe("trading-bot");
    console.log(`  ✅ Contacts: ${result.contacts.length} contact(s)`);
  });

  it("8. wallet_contacts_resolve — resolves contact to address", async () => {
    const tools = wallet.getTools();
    const resolveTool = tools.find((t) => t.name === "wallet_contacts_resolve")!;
    const result = (await resolveTool.execute({ name: "trading-bot", chain: "base" })) as any;

    expect(result.address).toBe(getAddress("0x1234567890abcdef1234567890abcdef12345678"));
    expect(result.exactMatch).toBe(true);
    console.log(`  ✅ Resolved: trading-bot → ${result.address}`);
  });

  it("9. wallet_send — blocked by insufficient balance (expected)", async () => {
    const tools = wallet.getTools();
    const sendTool = tools.find((t) => t.name === "wallet_send")!;
    const result = (await sendTool.execute({
      to: "trading-bot",
      amount: "0.01",
      token: "ETH",
      chain: "base",
    })) as any;

    expect(result.error).toBeDefined();
    console.log(`  ✅ Send correctly rejected: ${result.error.substring(0, 60)}...`);
  });

  it("10. wallet_history — returns empty history for new wallet", async () => {
    const tools = wallet.getTools();
    const historyTool = tools.find((t) => t.name === "wallet_history")!;
    const result = (await historyTool.execute({})) as any;

    expect(result.transactions).toHaveLength(0);
    console.log(`  ✅ History: ${result.message}`);
  });

  it("11. wallet_approval_list — no pending approvals", async () => {
    const tools = wallet.getTools();
    const listTool = tools.find((t) => t.name === "wallet_approval_list")!;
    const result = (await listTool.execute({})) as any;

    expect(result.pending).toHaveLength(0);
    console.log(`  ✅ Approvals: ${result.message}`);
  });

  it("12. wallet_contacts_remove — removes a contact", async () => {
    const tools = wallet.getTools();
    const removeTool = tools.find((t) => t.name === "wallet_contacts_remove")!;
    const result = (await removeTool.execute({ name: "trading-bot" })) as any;

    expect(result.message).toContain("removed");
    console.log(`  ✅ Contact removed`);
  });

  it("13. all 16 tools are registered", () => {
    const tools = wallet.getTools();
    const toolNames = tools.map((t) => t.name).sort();

    expect(toolNames).toEqual([
      "wallet_address",
      "wallet_approval_approve",
      "wallet_approval_list",
      "wallet_approval_reject",
      "wallet_balance",
      "wallet_contacts_add",
      "wallet_contacts_list",
      "wallet_contacts_remove",
      "wallet_contacts_resolve",
      "wallet_create",
      "wallet_estimate_gas",
      "wallet_history",
      "wallet_import",
      "wallet_policy_get",
      "wallet_policy_set",
      "wallet_send",
    ]);
    console.log(`  ✅ All ${tools.length} tools registered`);
  });
});
