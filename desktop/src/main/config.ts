import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ChainConfig {
  /** RPC URL for this chain */
  rpcUrl: string;
}

export interface RelayConfig {
  /** Base delay in ms before first reconnect attempt (default: 1000) */
  reconnectBaseMs: number;
  /** Maximum reconnect delay in ms, caps exponential backoff (default: 30000) */
  reconnectMaxMs: number;
}

export interface SigningConfig {
  /** Maximum total USD value of auto-approved transactions per day (default: 100) */
  dailyLimitUsd: number;
  /** Maximum USD value per single auto-approved transaction (default: 50) */
  perTxLimitUsd: number;
  /** Token symbols allowed for auto-approval (default: ["ETH","USDC","USDT"]) */
  tokenWhitelist: string[];
  /**
   * When true, `sign_transaction` within per-tx/daily allowance may be signed without a desktop prompt.
   * When false, every chain transaction requires an in-app approval (recommended for wallets).
   */
  autoApproveWithinBudget: boolean;
}

export interface LockConfig {
  /** Idle timeout in ms before auto-lock in strict mode (default: 300000 = 5min) */
  strictIdleTimeoutMs: number;
}

export interface SecurityConfig {
  /** Maximum number of security events to retain in memory (default: 1000) */
  maxEvents: number;
}

/** Keystore KDF; keep N within OpenSSL/Electron memory limits (avoid 2^18). */
export interface KeyringConfig {
  /** scrypt cost parameter N (default 16384). Env CLAW_DESKTOP_SCRYPT_N overrides when set. */
  scryptN: number;
}

export interface AppConfig {
  /** Relay server WebSocket URL, e.g. "ws://localhost:8080" */
  relayUrl: string;
  /** IP change policy: "block" rejects, "warn" alerts, "allow" ignores */
  ipChangePolicy: "block" | "warn" | "allow";
  /** Lock mode: "convenience" allows biometric, "strict" enforces password + idle timeout */
  lockMode: "convenience" | "strict";
  /** Web3 network RPC configuration (optional) */
  chains?: Partial<Record<"ethereum" | "base", ChainConfig>>;
  /** Relay connection tuning */
  relay: RelayConfig;
  /** Signing engine budget parameters */
  signing: SigningConfig;
  /** Lock manager parameters */
  lock: LockConfig;
  /** Security monitor parameters */
  security: SecurityConfig;
  /** Wallet keystore (scrypt) parameters */
  keyring: KeyringConfig;
}

const DEFAULTS: AppConfig = {
  relayUrl: "wss://wallet.janespace.xyz/relay",
  ipChangePolicy: "warn",
  lockMode: "convenience",
  relay: {
    reconnectBaseMs: 1000,
    reconnectMaxMs: 30000,
  },
  signing: {
    dailyLimitUsd: 100,
    perTxLimitUsd: 50,
    tokenWhitelist: ["ETH", "USDC", "USDT"],
    autoApproveWithinBudget: false,
  },
  lock: {
    strictIdleTimeoutMs: 5 * 60 * 1000,
  },
  security: {
    maxEvents: 1000,
  },
  keyring: {
    /** 2^14: fits Electron/BoringSSL scrypt memory cap; 2^16+ often hits MEMORY_LIMIT_EXCEEDED */
    scryptN: 16384,
  },
};

function loadConfigFile(): Record<string, unknown> {
  const candidates = [join(process.cwd(), "config.json")];

  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      console.log(`[config] Loaded from ${path}`);
      return parsed;
    } catch {
      continue;
    }
  }

  console.log("[config] No config.json found, using defaults");
  return {};
}

function resolveConfig(): AppConfig {
  const file = loadConfigFile();
  const fileRelay = (file.relay ?? {}) as Partial<RelayConfig>;
  const fileSigning = (file.signing ?? {}) as Partial<SigningConfig>;
  const fileLock = (file.lock ?? {}) as Partial<LockConfig>;
  const fileSecurity = (file.security ?? {}) as Partial<SecurityConfig>;
  const fileKeyring = (file.keyring ?? {}) as Partial<KeyringConfig>;
  const fileChains = file.chains as Partial<Record<"ethereum" | "base", ChainConfig>> | undefined;

  // Validate chains structure if present
  if (fileChains) {
    for (const [chainName, chainConfig] of Object.entries(fileChains)) {
      if (!chainConfig.rpcUrl || typeof chainConfig.rpcUrl !== "string") {
        console.warn(`[config] Invalid rpcUrl for chain ${chainName}, skipping`);
        delete fileChains[chainName as keyof typeof fileChains];
      }
    }
  }

  const envScrypt = process.env.CLAW_DESKTOP_SCRYPT_N;
  const parsedEnvScrypt =
    envScrypt && /^\d+$/.test(envScrypt) ? parseInt(envScrypt, 10) : undefined;

  return {
    relayUrl: (process.env.CLAW_DESKTOP_RELAY_URL as string) || (file.relayUrl as string) || DEFAULTS.relayUrl,
    ipChangePolicy: (process.env.CLAW_DESKTOP_IP_POLICY as AppConfig["ipChangePolicy"]) || (file.ipChangePolicy as AppConfig["ipChangePolicy"]) || DEFAULTS.ipChangePolicy,
    lockMode: (process.env.CLAW_DESKTOP_LOCK_MODE as AppConfig["lockMode"]) || (file.lockMode as AppConfig["lockMode"]) || DEFAULTS.lockMode,
    chains: fileChains && Object.keys(fileChains).length > 0 ? fileChains : undefined,
    relay: {
      reconnectBaseMs: fileRelay.reconnectBaseMs ?? DEFAULTS.relay.reconnectBaseMs,
      reconnectMaxMs: fileRelay.reconnectMaxMs ?? DEFAULTS.relay.reconnectMaxMs,
    },
    signing: {
      dailyLimitUsd: fileSigning.dailyLimitUsd ?? DEFAULTS.signing.dailyLimitUsd,
      perTxLimitUsd: fileSigning.perTxLimitUsd ?? DEFAULTS.signing.perTxLimitUsd,
      tokenWhitelist: fileSigning.tokenWhitelist ?? DEFAULTS.signing.tokenWhitelist,
      autoApproveWithinBudget:
        fileSigning.autoApproveWithinBudget ?? DEFAULTS.signing.autoApproveWithinBudget,
    },
    lock: {
      strictIdleTimeoutMs: fileLock.strictIdleTimeoutMs ?? DEFAULTS.lock.strictIdleTimeoutMs,
    },
    security: {
      maxEvents: fileSecurity.maxEvents ?? DEFAULTS.security.maxEvents,
    },
    keyring: {
      scryptN: clampScryptN(parsedEnvScrypt ?? fileKeyring.scryptN ?? DEFAULTS.keyring.scryptN),
    },
  };
}

/** Electron often rejects N≥2^17; N=2^16 can still exceed OpenSSL cap on some builds — cap at 2^16. */
function clampScryptN(n: number): number {
  const min = 2 ** 14;
  const max = 2 ** 16;
  if (!Number.isFinite(n) || n < min) return DEFAULTS.keyring.scryptN;
  return Math.min(Math.max(Math.floor(n), min), max);
}

export const config = resolveConfig();
