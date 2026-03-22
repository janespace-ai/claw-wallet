#!/usr/bin/env node

import { join } from "node:path";
import { homedir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClawWallet } from "claw-wallet";
import type { SupportedChain } from "claw-wallet";
import { registerTools } from "./adapter.js";

const dataDir = process.env.DATA_DIR || join(homedir(), ".claw-wallet");
const defaultChain = (process.env.DEFAULT_CHAIN as SupportedChain) || "base";
const relayUrl = process.env.RELAY_URL || "ws://localhost:8080";

const wallet = new ClawWallet({
  dataDir,
  defaultChain,
  relayUrl,
});

await wallet.initialize();

const tools = wallet.getTools();

const server = new McpServer({
  name: "claw-wallet",
  version: "0.1.0",
});

registerTools(server, tools);

const transport = new StdioServerTransport();
await server.connect(transport);

async function shutdown() {
  await wallet.shutdown();
  await server.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
