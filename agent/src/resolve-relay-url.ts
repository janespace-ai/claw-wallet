import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads relayUrl from cwd `config.json` merged with `config.local.json` (local overrides).
 * Used when RELAY_URL / ClawWalletOptions.relayUrl are not set. `config.local.json` is gitignored.
 */
export function readRelayUrlFromCwdConfig(): string | undefined {
  let merged: { relayUrl?: unknown } = {};
  for (const name of ["config.json", "config.local.json"]) {
    try {
      const p = join(process.cwd(), name);
      const raw = readFileSync(p, "utf8");
      merged = { ...merged, ...JSON.parse(raw) };
    } catch {
      /* optional files */
    }
  }
  const u = merged.relayUrl;
  return typeof u === "string" && u.trim() !== "" ? u.trim() : undefined;
}
