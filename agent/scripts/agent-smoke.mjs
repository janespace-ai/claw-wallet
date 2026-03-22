#!/usr/bin/env node
/**
 * Agent 端冒烟：检查 Relay HTTP、加载 ClawWallet、列出工具。
 * 完整配对 / 转账需本机桌面生成配对码并设置环境变量后执行。
 *
 * Usage（在 agent 目录）:
 *   npm run build
 *   RELAY_URL=http://your-relay:8080 node scripts/agent-smoke.mjs
 *   PAIR_CODE=ABCD1234 node scripts/agent-smoke.mjs   # 可选，尝试 wallet_pair
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const agentRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(agentRoot);

const relayBase = (process.env.RELAY_URL || "http://localhost:8080").replace(/\/$/, "");

async function main() {
  const healthUrl = `${relayBase}/health`;
  const h = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
  const body = await h.text();
  console.log(`[smoke] GET ${healthUrl} -> ${h.status} ${body.slice(0, 200)}`);

  const { ClawWallet } = await import("../dist/index.js");
  const dataDir = mkdtempSync(join(tmpdir(), "claw-agent-smoke-"));
  const w = new ClawWallet({
    dataDir,
    relayUrl: relayBase,
    defaultChain: "base",
  });
  await w.initialize();
  const tools = w.getTools();
  const names = tools.map((t) => t.name);
  console.log(`[smoke] tools (${names.length}):`, names.join(", "));

  const code = process.env.PAIR_CODE?.trim();
  if (code) {
    const pairTool = tools.find((t) => t.name === "wallet_pair");
    if (!pairTool) throw new Error("wallet_pair missing");
    console.log(`[smoke] calling wallet_pair with code length=${code.length}`);
    const r = await pairTool.execute({ shortCode: code });
    console.log("[smoke] wallet_pair result:", JSON.stringify(r, null, 2));
  } else {
    console.log("[smoke] Skip wallet_pair (set PAIR_CODE=... to test pairing).");
  }

  await w.shutdown();
  console.log("[smoke] ok");
}

main().catch((e) => {
  console.error("[smoke] failed:", e);
  process.exit(1);
});
