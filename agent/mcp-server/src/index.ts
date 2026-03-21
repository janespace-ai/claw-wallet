#!/usr/bin/env node

import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ChainAdapter,
  PolicyEngine,
  ContactsManager,
  TransactionHistory,
  SignerClient,
  TransferService,
  createAllTools,
} from "claw-wallet";
import type { SupportedChain } from "claw-wallet";
import { registerTools } from "./adapter.js";

const RELAY_URL = process.env.RELAY_URL;
if (!RELAY_URL) {
  console.error("RELAY_URL environment variable is required");
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || join(homedir(), ".claw-wallet");
const defaultChain = (process.env.DEFAULT_CHAIN as SupportedChain) || "base";
const socketPath = process.env.SIGNER_SOCKET ||
  join("/tmp", `claw-signer-${process.getuid?.() ?? 0}.sock`);

await mkdir(dataDir, { recursive: true });

const chainAdapter = new ChainAdapter();
const signerClient = new SignerClient(socketPath);
const policy = new PolicyEngine(join(dataDir, "policy.json"));
const contacts = new ContactsManager(join(dataDir, "contacts.json"));
const history = new TransactionHistory(join(dataDir, "history.json"));

await policy.load();
await contacts.load();
await history.load();

let walletAddress: `0x${string}` | null = null;
try {
  const result = await signerClient.call("get_address") as { address: `0x${string}` };
  walletAddress = result.address;
} catch {
  // Signer not running or no wallet yet
}

const tools = createAllTools({
  signerClient,
  chainAdapter,
  getAddress: () => walletAddress,
  getTransferService: () => {
    if (!walletAddress) return null;
    return new TransferService(
      chainAdapter,
      walletAddress,
      signerClient,
      policy,
      contacts,
      history
    );
  },
  contacts,
  policy,
  history,
  defaultChain,
});

const server = new McpServer({
  name: "claw-wallet",
  version: "0.1.0",
});

registerTools(server, tools);

const transport = new StdioServerTransport();
await server.connect(transport);

async function shutdown() {
  await history.save();
  await contacts.save();
  await policy.save();
  await server.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
