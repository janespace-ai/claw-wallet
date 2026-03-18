#!/usr/bin/env node

import { join } from "node:path";
import { homedir } from "node:os";
import { SignerDaemon } from "../src/signer/daemon.js";
import { TuiAuthProvider } from "../src/signer/tui-auth.js";

const args = process.argv.slice(2);
const command = args[0];

if (command !== "start") {
  console.error("Usage: claw-signer start [--auth tui|gui|webhook] [--socket-path <path>] [--ttl <ms>] [--data-dir <path>]");
  process.exit(1);
}

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const authType = getArg("--auth") ?? "tui";
const socketPath = getArg("--socket-path");
const ttl = getArg("--ttl");
const dataDir = getArg("--data-dir") ?? join(homedir(), ".openclaw", "wallet");

let authProvider;
switch (authType) {
  case "tui":
    authProvider = new TuiAuthProvider();
    break;
  case "gui":
    const { GuiAuthProvider } = await import("../src/signer/gui-auth.js");
    authProvider = new GuiAuthProvider();
    break;
  case "webhook":
    const webhookUrl = getArg("--webhook-url");
    if (!webhookUrl) {
      console.error("--webhook-url required for webhook auth");
      process.exit(1);
    }
    const { WebhookAuthProvider } = await import("../src/signer/webhook-auth.js");
    authProvider = new WebhookAuthProvider(webhookUrl);
    break;
  default:
    console.error(`Unknown auth type: ${authType}`);
    process.exit(1);
}

const daemon = new SignerDaemon({
  dataDir,
  socketPath,
  authProvider,
  sessionTtlMs: ttl ? parseInt(ttl, 10) : undefined,
});

console.log(`Starting claw-signer (auth: ${authType})...`);
await daemon.start();
console.log(`Signer listening on ${daemon.getSocketPath()}`);
console.log("Press Ctrl+C to stop.");
