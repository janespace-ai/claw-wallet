#!/usr/bin/env node

import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClawWallet } from "claw-wallet";
import type { SupportedChain, ChainConfig } from "claw-wallet";
import { registerTools } from "./adapter.js";

function loadConfig(): Record<string, unknown> {
  try {
    const configPath = join(process.cwd(), "config.json");
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const config = loadConfig();

const dataDir = process.env.DATA_DIR || (config.dataDir as string) || join(homedir(), ".claw-wallet");
const defaultChain = (process.env.DEFAULT_CHAIN as SupportedChain) || (config.defaultChain as SupportedChain) || "base";
const relayUrl = process.env.RELAY_URL || (config.relayUrl as string) || "http://localhost:8080";
const chains = config.chains as Partial<Record<SupportedChain, ChainConfig>> | undefined;

const wallet = new ClawWallet({
  dataDir,
  defaultChain,
  relayUrl,
  chains,
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
