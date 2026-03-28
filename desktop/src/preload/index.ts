import { contextBridge, ipcRenderer } from "electron";

export interface WalletAPI {
  createWallet: (password: string) => Promise<{ address: string; mnemonic: string }>;
  importWallet: (mnemonic: string, password: string) => Promise<{ address: string }>;
  unlock: (password: string) => Promise<void>;
  unlockBiometric: () => Promise<void>;
  lock: () => Promise<void>;
  getStatus: () => Promise<WalletStatus>;
  generatePairCode: () => Promise<{ code: string; expiresAt: number }>;
  revokePairing: (deviceId: string) => Promise<void>;
  repairDevice: (deviceId: string) => Promise<{ code: string; expiresAt: number }>;
  getIpChangePolicy: () => Promise<"block" | "warn" | "allow">;
  setIpChangePolicy: (policy: "block" | "warn" | "allow") => Promise<void>;
  getPairedDevices: () => Promise<PairedDevice[]>;
  approveTransaction: (requestId: string) => Promise<void>;
  rejectTransaction: (requestId: string) => Promise<void>;
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
  getSigningHistory: () => Promise<SigningRecord[]>;

  onTransactionRequest: (callback: (req: TransactionRequest) => void) => () => void;
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => () => void;
  onSecurityAlert: (callback: (alert: SecurityAlert) => void) => () => void;
  onLockStateChange: (callback: (locked: boolean) => void) => () => void;
  onBiometricPrompt: (callback: (password: string) => void) => () => void;
}

export interface WalletStatus {
  hasWallet: boolean;
  isUnlocked: boolean;
  address: string | null;
  connectedAgents: number;
  lockMode: "convenience" | "strict";
  sameMachineWarning: boolean;
}

export interface PairedDevice {
  deviceId: string;
  machineId: string;
  lastIP: string;
  pairedAt: string;
  lastSeen: string;
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
}

export interface ConnectionStatus {
  connected: boolean;
  relayUrl: string;
  connectedDevices: number;
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

export interface SigningRecord {
  requestId: string;
  timestamp: number;
  type: "auto" | "manual" | "rejected";
  method: string;
  to: string;
  value: string;
  token: string;
  chain: string;
  estimatedUSD: number;
  txHash?: string;
}

const api: WalletAPI = {
  createWallet: (password) => ipcRenderer.invoke("wallet:create", password),
  importWallet: (mnemonic, password) => ipcRenderer.invoke("wallet:import", mnemonic, password),
  unlock: (password) => ipcRenderer.invoke("wallet:unlock", password),
  unlockBiometric: () => ipcRenderer.invoke("wallet:unlock-biometric"),
  lock: () => ipcRenderer.invoke("wallet:lock"),
  getStatus: () => ipcRenderer.invoke("wallet:status"),
  generatePairCode: () => ipcRenderer.invoke("wallet:pair-code"),
  revokePairing: (deviceId) => ipcRenderer.invoke("wallet:revoke-pairing", deviceId),
  repairDevice: (deviceId) => ipcRenderer.invoke("wallet:repair-device", deviceId),
  getIpChangePolicy: () => ipcRenderer.invoke("wallet:get-ip-policy"),
  setIpChangePolicy: (policy) => ipcRenderer.invoke("wallet:set-ip-policy", policy),
  getPairedDevices: () => ipcRenderer.invoke("wallet:paired-devices"),
  approveTransaction: (requestId) => ipcRenderer.invoke("wallet:approve-tx", requestId),
  rejectTransaction: (requestId) => ipcRenderer.invoke("wallet:reject-tx", requestId),
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
  getSigningHistory: () => ipcRenderer.invoke("wallet:get-signing-history"),

  onTransactionRequest: (callback) => {
    const handler = (_: unknown, req: TransactionRequest) => callback(req);
    ipcRenderer.on("wallet:tx-request", handler);
    return () => ipcRenderer.removeListener("wallet:tx-request", handler);
  },
  onConnectionStatus: (callback) => {
    const handler = (_: unknown, status: ConnectionStatus) => callback(status);
    ipcRenderer.on("wallet:connection-status", handler);
    return () => ipcRenderer.removeListener("wallet:connection-status", handler);
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
};

contextBridge.exposeInMainWorld("walletAPI", api);
