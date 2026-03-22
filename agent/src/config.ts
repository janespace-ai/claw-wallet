import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface AgentPolicyConfig {
  /** Maximum USD value per single transaction before requiring approval (default: 100) */
  perTxLimitUsd: number;
  /** Maximum total USD value of transactions per day (default: 500) */
  dailyLimitUsd: number;
  /** Policy mode: "supervised" requires whitelist, "autonomous" allows any address within limits (default: "supervised") */
  mode: "supervised" | "autonomous";
}

export interface AgentConfig {
  /** Timeout in ms for pairing code validation (default: 10000 = 10s) */
  pairTimeoutMs: number;
  /** Timeout in ms for general relay requests (default: 30000 = 30s) */
  relayTimeoutMs: number;
  /** Timeout in ms waiting for Desktop Wallet to sign a transaction (default: 120000 = 2min) */
  signTimeoutMs: number;
  /** Base delay in ms before first reconnect attempt (default: 1000) */
  reconnectBaseMs: number;
  /** Maximum reconnect delay in ms, caps exponential backoff (default: 30000) */
  reconnectMaxMs: number;
  /** Default policy parameters */
  policy: AgentPolicyConfig;
}

const DEFAULTS: AgentConfig = {
  pairTimeoutMs: 10_000,
  relayTimeoutMs: 30_000,
  signTimeoutMs: 120_000,
  reconnectBaseMs: 1000,
  reconnectMaxMs: 30000,
  policy: {
    perTxLimitUsd: 100,
    dailyLimitUsd: 500,
    mode: "supervised",
  },
};

function loadConfigFile(): Record<string, unknown> {
  const candidates = [
    join(process.cwd(), "config.json"),
  ];

  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      console.log(`[agent-config] Loaded from ${path}`);
      return parsed;
    } catch {
      continue;
    }
  }

  return {};
}

function resolveConfig(): AgentConfig {
  const file = loadConfigFile();
  const filePolicy = (file.policy ?? {}) as Partial<AgentPolicyConfig>;

  const envInt = (key: string): number | undefined => {
    const v = process.env[key];
    return v ? parseInt(v, 10) : undefined;
  };

  return {
    pairTimeoutMs: envInt("CLAW_AGENT_PAIR_TIMEOUT_MS") ?? (file.pairTimeoutMs as number) ?? DEFAULTS.pairTimeoutMs,
    relayTimeoutMs: envInt("CLAW_AGENT_RELAY_TIMEOUT_MS") ?? (file.relayTimeoutMs as number) ?? DEFAULTS.relayTimeoutMs,
    signTimeoutMs: envInt("CLAW_AGENT_SIGN_TIMEOUT_MS") ?? (file.signTimeoutMs as number) ?? DEFAULTS.signTimeoutMs,
    reconnectBaseMs: envInt("CLAW_AGENT_RECONNECT_BASE_MS") ?? (file.reconnectBaseMs as number) ?? DEFAULTS.reconnectBaseMs,
    reconnectMaxMs: envInt("CLAW_AGENT_RECONNECT_MAX_MS") ?? (file.reconnectMaxMs as number) ?? DEFAULTS.reconnectMaxMs,
    policy: {
      perTxLimitUsd: filePolicy.perTxLimitUsd ?? DEFAULTS.policy.perTxLimitUsd,
      dailyLimitUsd: filePolicy.dailyLimitUsd ?? DEFAULTS.policy.dailyLimitUsd,
      mode: filePolicy.mode ?? DEFAULTS.policy.mode,
    },
  };
}

export const agentConfig = resolveConfig();
