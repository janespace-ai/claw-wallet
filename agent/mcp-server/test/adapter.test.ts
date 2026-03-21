import { describe, it, expect } from "vitest";
import { registerTools } from "../src/adapter.js";
import type { ToolDefinition } from "claw-wallet";

function makeDummyTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "test_tool",
    description: "A test tool",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "test input" },
      },
    },
    execute: async () => ({ result: "ok" }),
    ...overrides,
  };
}

describe("registerTools adapter", () => {
  it("registers tools on a mock MCP server", () => {
    const registered: { name: string; description: string }[] = [];
    const mockServer = {
      tool(name: string, description: string, _schema: any, _handler: any) {
        registered.push({ name, description });
      },
    };

    const tools = [
      makeDummyTool({ name: "wallet_balance", description: "Check balance" }),
      makeDummyTool({ name: "wallet_send", description: "Send tokens" }),
    ];

    registerTools(mockServer as any, tools);

    expect(registered).toHaveLength(2);
    expect(registered[0].name).toBe("wallet_balance");
    expect(registered[1].name).toBe("wallet_send");
  });

  it("wraps execute result into MCP content format", async () => {
    let capturedHandler: ((args: any) => Promise<any>) | null = null;
    const mockServer = {
      tool(_name: string, _desc: string, _schema: any, handler: any) {
        capturedHandler = handler;
      },
    };

    const tool = makeDummyTool({
      execute: async () => ({ balance: "2.5", token: "ETH" }),
    });

    registerTools(mockServer as any, [tool]);

    const result = await capturedHandler!({});
    expect(result.isError).toBe(false);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.balance).toBe("2.5");
    expect(parsed.token).toBe("ETH");
  });

  it("marks error results with isError: true", async () => {
    let capturedHandler: ((args: any) => Promise<any>) | null = null;
    const mockServer = {
      tool(_name: string, _desc: string, _schema: any, handler: any) {
        capturedHandler = handler;
      },
    };

    const tool = makeDummyTool({
      execute: async () => ({ error: "No wallet configured" }),
    });

    registerTools(mockServer as any, [tool]);

    const result = await capturedHandler!({});
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("No wallet configured");
  });

  it("registers all 17 wallet tools from createAllTools", async () => {
    const { createAllTools } = await import("claw-wallet");

    const mockDeps = {
      signerClient: { call: async () => ({}) } as any,
      chainAdapter: {} as any,
      getAddress: () => null,
      getTransferService: () => null,
      contacts: { listContacts: () => [], addContact: () => ({}), resolveContact: () => null, removeContact: () => false, save: async () => {} } as any,
      policy: { getConfig: () => ({}), updateConfig: () => {}, autoExpire: () => {}, listPending: () => [], approve: () => null, reject: () => null, save: async () => {} } as any,
      history: { getHistory: () => [] } as any,
      defaultChain: "base" as const,
    };

    const tools = createAllTools(mockDeps);
    const registered: string[] = [];
    const mockServer = {
      tool(name: string, _desc: string, _schema: any, _handler: any) {
        registered.push(name);
      },
    };

    registerTools(mockServer as any, tools);

    expect(registered.length).toBe(17);
    expect(registered).toContain("wallet_balance");
    expect(registered).toContain("wallet_send");
    expect(registered).toContain("wallet_create");
    expect(registered).toContain("wallet_pair");
    expect(registered).toContain("wallet_history");
  });
});
