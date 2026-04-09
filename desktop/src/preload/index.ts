import { contextBridge, ipcRenderer } from "electron";

export interface WalletAPI {
  createWallet: (password: string) => Promise<{ address: string; mnemonic: string }>;
  importWallet: (mnemonic: string, password: string) => Promise<{ address: string }>;
  unlock: (password: string) => Promise<void>;
  unlockBiometric: () => Promise<void>;
  lock: () => Promise<void>;
  getStatus: () => Promise<WalletStatus>;
  generatePairCode: () => Promise<{ code: string; expiresAt: number }>;
  /** Active account’s pending pair code (after switch / tab open). */
  getPendingPairing: () => Promise<{ code: string | null; expiresAt: number | null }>;
  revokePairing: (deviceId: string) => Promise<void>;
  repairDevice: (deviceId: string) => Promise<{ code: string; expiresAt: number }>;
  getIpChangePolicy: () => Promise<"block" | "warn" | "allow">;
  setIpChangePolicy: (policy: "block" | "warn" | "allow") => Promise<void>;
  getPairedDevices: () => Promise<PairedDevice[]>;
  approveTransaction: (
    requestId: string,
    options?: { trustRecipientAfterSuccess?: boolean; trustRecipientName?: string },
  ) => Promise<void>;
  rejectTransaction: (requestId: string) => Promise<void>;
  respondContactAdd: (requestId: string, choice: "normal" | "trusted" | "reject") => Promise<void>;
  setAllowance: (config: AllowanceConfig) => Promise<void>;
  getAllowance: () => Promise<AllowanceConfig>;
  setLockMode: (mode: "convenience" | "strict") => Promise<void>;
  getLockMode: () => Promise<"convenience" | "strict">;
  setBiometricEnabled: (enabled: boolean, password?: string) => Promise<void>;
  getBiometricAvailable: () => Promise<boolean>;
  getBiometricLabel: () => Promise<string | null>;
  canEnableBiometric: () => Promise<boolean>;
  getSecurityEvents: () => Promise<SecurityEvent[]>;
  respondToAlert: (alertId: string, action: "freeze" | "allow_once" | "trust") => Promise<void>;
  exportMnemonic: (password: string) => Promise<{ mnemonic: string }>;
  getTokenPrices: (tokens: string[]) => Promise<Record<string, number>>;
  getWalletBalances: (address: string) => Promise<TokenBalance[]>;
  /** Read persistent asset cache for an address (instant, no RPC). */
  getCachedAssets: (address: string) => Promise<CachedAssetEntry[]>;
  /** Trigger two-phase background cache refresh (fire-and-forget). */
  startBackgroundRefresh: (address: string) => Promise<void>;
  /** Persist balances + prices to SQLite cache after a full on-chain fetch. */
  persistCachedAssets: (address: string, balances: TokenBalance[], prices: Record<string, number>) => Promise<void>;
  /** Subscribe to background refresh completion events. */
  onAssetsRefreshed: (callback: (payload: { address: string; assets: CachedAssetEntry[] }) => void) => () => void;
  /** Add user ERC-20 on a supported chain (saved to user config, clears balance cache). */
  addCustomToken: (input: CustomTokenInput) => Promise<CustomTokenConfig>;
  listCustomTokens: () => Promise<CustomTokenConfig[]>;
  removeCustomToken: (symbol: string, chainId: number) => Promise<void>;
  getSigningHistory: (accountIndex?: number) => Promise<SigningRecord[]>;
  getActivityRecords: (accountIndex?: number, limit?: number, offset?: number) => Promise<ActivityRecord[]>;
  getActivityByType: (
    accountIndex: number | undefined,
    type: "auto" | "manual" | "rejected",
  ) => Promise<ActivityRecord[]>;
  getActivityByStatus: (
    accountIndex: number | undefined,
    status: "pending" | "success" | "failed",
  ) => Promise<ActivityRecord[]>;
  listDesktopContacts: (accountIndex?: number) => Promise<DesktopContactEntry[]>;
  removeDesktopContact: (name: string, accountIndex?: number) => Promise<void>;
  updateDesktopContactTrust: (name: string, trusted: boolean, accountIndex?: number) => Promise<void>;

  listWalletAccounts: () => Promise<WalletAccountSummary[]>;
  /** Chains from network-config (for home network filter before balances load). */
  listConfiguredNetworks: () => Promise<Array<{ chainId: number; name: string }>>;
  switchWalletAccount: (index: number) => Promise<void>;
  createWalletSubAccount: (nickname?: string) => Promise<WalletAccountSummary[]>;
  updateWalletAccountNickname: (index: number, nickname: string) => Promise<WalletAccountSummary[]>;
  recoverScanNext: (fromIndex: number) => Promise<RecoverScanResult>;
  importRecoveredAccount: (index: number, nickname?: string) => Promise<WalletAccountSummary[]>;

  deregisterWallet: (password: string) => Promise<void>;
  onDeregistered: (callback: () => void) => () => void;

  onTransactionRequest: (callback: (req: TransactionRequest) => void) => () => void;
  onContactAddRequest: (callback: (req: ContactAddRequest) => void) => () => void;
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => () => void;
  onAgentStatus: (callback: (status: AgentStatus) => void) => () => void;
  onSecurityAlert: (callback: (alert: SecurityAlert) => void) => () => void;
  onLockStateChange: (callback: (locked: boolean) => void) => () => void;
  onBiometricPrompt: (callback: (password: string) => void) => () => void;
  onWalletAccountChanged: (
    callback: (payload: { address: string | null; accountIndex: number }) => void,
  ) => () => void;

  /** When non-null (E2E / dev harness), renderer uses this locale instead of storage / navigator. */
  e2eUiLang: string | null;

  /**
   * E2E only: fixed nickname for “+ Account” — `window.prompt` is unavailable in Electron renderer.
   * Override with env `E2E_SUB_ACCOUNT_NICKNAME`.
   */
  e2eSubAccountNickname: string | null;

  /** Load i18n JSON from disk (`file://` blocks `fetch`; preload reads via Node). */
  loadI18nResource: (language: string, namespace: string) => Promise<Record<string, unknown>>;
}

export interface WalletStatus {
  hasWallet: boolean;
  isUnlocked: boolean;
  address: string | null;
  /** BIP-44 account index (0–9) when unlocked */
  activeAccountIndex?: number;
  connectedAgents: number;
  lockMode: "convenience" | "strict";
  sameMachineWarning: boolean;
}

export interface WalletAccountSummary {
  index: number;
  nickname: string;
  address: string;
  isActive: boolean;
}

export interface PairedDevice {
  deviceId: string;
  pairId: string;
  machineId: string;
  agentPublicKey: string;
  lastIP: string;
  pairedAt: string;
  lastSeen: string;
  /** Which BIP-44 sub-account this pairing belongs to (separate Relay WebSocket). */
  accountIndex: number;
}

export interface AllowanceConfig {
  dailyLimitUSD: number;
  perTxLimitUSD: number;
  tokenWhitelist: string[];
  addressWhitelist: string[];
}

export interface TransactionRequest {
  requestId: string;
  method: string;
  to: string;
  value: string;
  token: string;
  chain: string;
  fromDevice: string;
  sourceIP: string;
  withinBudget: boolean;
  allowSaveTrustedContact: boolean;
  counterpartyContact?: { name: string; trusted: boolean } | null;
  transferDisplay: string | null;
  isUnlimitedApproval?: boolean;
  estimatedUsd: number;
  priceAvailable: boolean;
  fromAccountIndex?: number;
  fromAccountNickname?: string;
  fromAccountAddress?: string;
  isActiveAccount?: boolean;
  signingAccountIndex?: number;
}

export interface ContactAddRequest {
  requestId: string;
  name: string;
  address: string;
  chain: string;
}

export interface ConnectionStatus {
  connected: boolean;
  relayUrl: string;
  connectedDevices: number;
}

export interface AgentStatus {
  paired: boolean;
  online: boolean;
}

export interface SecurityAlert {
  alertId: string;
  type: "ip_change" | "fingerprint_change" | "same_machine" | "key_mismatch" | "device_mismatch";
  message: string;
  details: Record<string, string>;
  timestamp: number;
}

export interface SecurityEvent {
  type: string;
  message: string;
  timestamp: number;
  details?: Record<string, string>;
}

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  rawAmount: string;
  chain: string;
  decimals: number;
}

export interface CachedAssetEntry {
  symbol: string;
  token: string;
  chain_id: number;
  chain_name: string;
  decimals: number;
  amount: string;
  raw_amount: string;
  price_usd: number;
  updated_at: number;
}

export type RecoverScanResult =
  | { status: "found"; index: number; address: string; balances: TokenBalance[] }
  | { status: "empty"; nextIndex: number }
  | { status: "already-registered"; nextIndex: number }
  | { status: "done" };

export interface CustomTokenInput {
  chainId: number;
  contractAddress: string;
  symbol: string;
  name?: string;
  decimals?: number;
}

export interface CustomTokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  contracts: Record<string, string>;
}

/** Matches `signing_history` rows from main process (snake_case). */
export interface SigningRecord {
  id: number;
  request_id: string;
  timestamp: number;
  type: "auto" | "manual" | "rejected";
  method: string;
  tx_to: string | null;
  tx_value: string | null;
  tx_token: string;
  tx_chain: string;
  estimated_usd: number;
  tx_hash: string | null;
  tx_status: "pending" | "success" | "failed" | null;
  block_number: number | null;
  block_timestamp: number | null;
  gas_used: number | null;
  created_at: number;
  updated_at: number;
}

export interface DesktopContactEntry {
  name: string;
  chain: string;
  address: string;
  trusted: boolean;
}

export interface ActivityRecord {
  id: number;
  request_id: string;
  timestamp: number;
  type: "auto" | "manual" | "rejected";
  method: string;
  tx_to: string | null;
  tx_value: string | null;
  tx_token: string;
  tx_chain: string;
  estimated_usd: number;
  tx_hash: string | null;
  tx_status: "pending" | "success" | "failed" | null;
  block_number: number | null;
  block_timestamp: number | null;
  gas_used: number | null;
  created_at: number;
  updated_at: number;
}

const api: WalletAPI = {
  createWallet: (password) => ipcRenderer.invoke("wallet:create", password),
  importWallet: (mnemonic, password) => ipcRenderer.invoke("wallet:import", mnemonic, password),
  unlock: (password) => ipcRenderer.invoke("wallet:unlock", password),
  unlockBiometric: () => ipcRenderer.invoke("wallet:unlock-biometric"),
  lock: () => ipcRenderer.invoke("wallet:lock"),
  getStatus: () => ipcRenderer.invoke("wallet:status"),
  generatePairCode: () => ipcRenderer.invoke("wallet:pair-code"),
  getPendingPairing: () => ipcRenderer.invoke("wallet:pending-pairing"),
  revokePairing: (deviceId) => ipcRenderer.invoke("wallet:revoke-pairing", deviceId),
  repairDevice: (deviceId) => ipcRenderer.invoke("wallet:repair-device", deviceId),
  getIpChangePolicy: () => ipcRenderer.invoke("wallet:get-ip-policy"),
  setIpChangePolicy: (policy) => ipcRenderer.invoke("wallet:set-ip-policy", policy),
  getPairedDevices: () => ipcRenderer.invoke("wallet:paired-devices"),
  approveTransaction: (requestId, options?) =>
    ipcRenderer.invoke("wallet:approve-tx", requestId, options),
  rejectTransaction: (requestId) => ipcRenderer.invoke("wallet:reject-tx", requestId),
  respondContactAdd: (requestId, choice) =>
    ipcRenderer.invoke("wallet:respond-contact-add", requestId, choice),
  setAllowance: (config) => ipcRenderer.invoke("wallet:set-allowance", config),
  getAllowance: () => ipcRenderer.invoke("wallet:get-allowance"),
  setLockMode: (mode) => ipcRenderer.invoke("wallet:set-lock-mode", mode),
  getLockMode: () => ipcRenderer.invoke("wallet:get-lock-mode"),
  setBiometricEnabled: (enabled, password?) => ipcRenderer.invoke("wallet:set-biometric", enabled, password),
  getBiometricAvailable: () => ipcRenderer.invoke("wallet:biometric-available"),
  getBiometricLabel: () => ipcRenderer.invoke("wallet:biometric-label"),
  canEnableBiometric: () => ipcRenderer.invoke("wallet:can-enable-biometric"),
  getSecurityEvents: () => ipcRenderer.invoke("wallet:security-events"),
  respondToAlert: (alertId, action) => ipcRenderer.invoke("wallet:respond-alert", alertId, action),
  exportMnemonic: (password) => ipcRenderer.invoke("wallet:export-mnemonic", password),
  getTokenPrices: (tokens) => ipcRenderer.invoke("wallet:get-token-prices", tokens),
  getWalletBalances: (address) => ipcRenderer.invoke("wallet:get-wallet-balances", address),
  getCachedAssets: (address) => ipcRenderer.invoke("cache:get-cached-assets", address),
  startBackgroundRefresh: (address) => ipcRenderer.invoke("cache:start-background-refresh", address),
  persistCachedAssets: (address, balances, prices) => ipcRenderer.invoke("cache:persist-assets", address, balances, prices),
  onAssetsRefreshed: (callback) => {
    const handler = (_: unknown, payload: { address: string; assets: CachedAssetEntry[] }) => callback(payload);
    ipcRenderer.on("cache:assets-refreshed", handler);
    return () => ipcRenderer.removeListener("cache:assets-refreshed", handler);
  },
  addCustomToken: (input) => ipcRenderer.invoke("wallet:add-custom-token", input),
  listCustomTokens: () => ipcRenderer.invoke("wallet:list-custom-tokens"),
  removeCustomToken: (symbol, chainId) => ipcRenderer.invoke("wallet:remove-custom-token", symbol, chainId),
  getSigningHistory: (accountIndex?) => ipcRenderer.invoke("wallet:get-signing-history", accountIndex),
  getActivityRecords: (accountIndex?, limit?, offset?) =>
    ipcRenderer.invoke("wallet:get-activity-records", accountIndex, limit, offset),
  getActivityByType: (accountIndex, type) =>
    ipcRenderer.invoke("wallet:get-activity-by-type", accountIndex, type),
  getActivityByStatus: (accountIndex, status) =>
    ipcRenderer.invoke("wallet:get-activity-by-status", accountIndex, status),
  listDesktopContacts: (accountIndex?) => ipcRenderer.invoke("wallet:list-contacts", accountIndex),
  removeDesktopContact: (name, accountIndex) =>
    ipcRenderer.invoke("wallet:remove-contact", accountIndex, name),
  updateDesktopContactTrust: (name, trusted, accountIndex) =>
    ipcRenderer.invoke("wallet:update-contact-trust", accountIndex, name, trusted),

  listWalletAccounts: () => ipcRenderer.invoke("wallet:list-accounts"),
  listConfiguredNetworks: () => ipcRenderer.invoke("wallet:list-configured-networks"),
  switchWalletAccount: (index) => ipcRenderer.invoke("wallet:switch-account", index),
  createWalletSubAccount: (nickname) => ipcRenderer.invoke("wallet:create-sub-account", nickname),
  updateWalletAccountNickname: (index, nickname) =>
    ipcRenderer.invoke("wallet:update-account-nickname", index, nickname),
  recoverScanNext: (fromIndex) => ipcRenderer.invoke("wallet:recover-scan-next", fromIndex),
  importRecoveredAccount: (index, nickname) =>
    ipcRenderer.invoke("wallet:import-recovered-account", index, nickname),

  deregisterWallet: (password) => ipcRenderer.invoke("wallet:deregister", password),
  onDeregistered: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("wallet:deregistered", handler);
    return () => ipcRenderer.removeListener("wallet:deregistered", handler);
  },

  onTransactionRequest: (callback) => {
    const handler = (_: unknown, req: TransactionRequest) => callback(req);
    ipcRenderer.on("wallet:tx-request", handler);
    return () => ipcRenderer.removeListener("wallet:tx-request", handler);
  },
  onContactAddRequest: (callback) => {
    const handler = (_: unknown, req: ContactAddRequest) => callback(req);
    ipcRenderer.on("wallet:contact-add-request", handler);
    return () => ipcRenderer.removeListener("wallet:contact-add-request", handler);
  },
  onConnectionStatus: (callback) => {
    const handler = (_: unknown, status: ConnectionStatus) => callback(status);
    ipcRenderer.on("wallet:connection-status", handler);
    return () => ipcRenderer.removeListener("wallet:connection-status", handler);
  },
  onAgentStatus: (callback) => {
    const handler = (_: unknown, status: AgentStatus) => callback(status);
    ipcRenderer.on("wallet:agent-status", handler);
    return () => ipcRenderer.removeListener("wallet:agent-status", handler);
  },
  onSecurityAlert: (callback) => {
    const handler = (_: unknown, alert: SecurityAlert) => callback(alert);
    ipcRenderer.on("wallet:security-alert", handler);
    return () => ipcRenderer.removeListener("wallet:security-alert", handler);
  },
  onLockStateChange: (callback) => {
    const handler = (_: unknown, locked: boolean) => callback(locked);
    ipcRenderer.on("wallet:lock-state", handler);
    return () => ipcRenderer.removeListener("wallet:lock-state", handler);
  },
  onBiometricPrompt: (callback) => {
    const handler = (_: unknown, password: string) => callback(password);
    ipcRenderer.on("wallet:biometric-prompt", handler);
    return () => ipcRenderer.removeListener("wallet:biometric-prompt", handler);
  },
  onWalletAccountChanged: (callback) => {
    const handler = (_: unknown, payload: { address: string | null; accountIndex: number }) =>
      callback(payload);
    ipcRenderer.on("wallet:account-changed", handler);
    return () => ipcRenderer.removeListener("wallet:account-changed", handler);
  },

  e2eUiLang: process.env.E2E_USER_DATA
    ? (process.env.E2E_UI_LANG?.trim() || "en")
    : null,

  e2eSubAccountNickname: process.env.E2E_USER_DATA
    ? (process.env.E2E_SUB_ACCOUNT_NICKNAME?.trim() || "E2E Sub Account")
    : null,

  loadI18nResource: (language, namespace) =>
    ipcRenderer.invoke("wallet:load-i18n-resource", language, namespace),
};

contextBridge.exposeInMainWorld("walletAPI", api);
