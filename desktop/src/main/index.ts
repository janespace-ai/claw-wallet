import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type * as Electron from "electron";
import { KeyManager } from "./key-manager.js";
import { SigningEngine } from "./signing-engine.js";
import { RelayBridge } from "./relay-bridge.js";
import { SecurityMonitor } from "./security-monitor.js";
import { LockManager } from "./lock-manager.js";
import { PriceService } from "./price-service.js";
import { BalanceService } from "./balance-service.js";
import { DatabaseService } from "./database-service.js";
import { SigningHistory } from "./signing-history.js";
import { WalletAuthorityStore } from "./wallet-authority-store.js";
import { ChainAdapter } from "./chain-adapter.js";
import { TxSyncService } from "./tx-sync-service.js";
import { NetworkConfigService } from "./network-config-service.js";
import { RPCProviderManager } from "./rpc-provider-manager.js";
import { AccountManager } from "./account-manager.js";
import { MessageRouter } from "./message-router.js";
import { config } from "./config.js";

/**
 * Disk locales are only `en/` and `zh-CN/`. i18next may pass `zh`, `zh-Hans`, `zh-Hans-CN`, etc.
 */
function normalizeLocaleDir(language: string): string {
  const t = (language ?? "").trim();
  if (!t) return "en";
  const lower = t.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "zh" || lower.startsWith("zh-")) return "zh-CN";
  return t;
}

async function readLocaleNamespace(language: string, namespace: string): Promise<Record<string, unknown>> {
  const base = join(app.getAppPath(), "dist", "renderer", "locales");
  const primary = normalizeLocaleDir(language);
  const candidates = [...new Set([primary, "en"])];
  let lastENOENT: NodeJS.ErrnoException | undefined;
  for (const dir of candidates) {
    const file = join(base, dir, `${namespace}.json`);
    try {
      const raw = await readFile(file, "utf-8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        lastENOENT = err;
        continue;
      }
      throw e;
    }
  }
  throw new Error(
    `Missing i18n ${namespace}.json under locales (tried ${candidates.join(", ")}): ${lastENOENT?.message ?? ""}`,
  );
}

/** Isolated profile + predictable window close behavior for Playwright E2E */
if (process.env.E2E_USER_DATA) {
  app.setPath("userData", process.env.E2E_USER_DATA);
}

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let tray: InstanceType<typeof Tray> | null = null;

const dataDir = join(app.getPath("userData"), "wallet-data");
const dbPath = join(dataDir, "wallet.db");
const dbService = DatabaseService.getInstance(dbPath);
const accountManager = new AccountManager(dbService);
const networkConfigService = new NetworkConfigService();
networkConfigService.load();
const rpcProviderManager = new RPCProviderManager(networkConfigService);
const keyManager = new KeyManager(dataDir, { scryptN: config.keyring.scryptN });
const signingHistory = new SigningHistory(dbService);
const authorityStore = new WalletAuthorityStore(dbService);
const chainAdapter = new ChainAdapter(config.chains);
const txSyncService = new TxSyncService(signingHistory, chainAdapter);
const signingEngine = new SigningEngine(keyManager, {
  dailyLimitUsd: config.signing.dailyLimitUsd,
  perTxLimitUsd: config.signing.perTxLimitUsd,
  tokenWhitelist: config.signing.tokenWhitelist,
  autoApproveWithinBudget: config.signing.autoApproveWithinBudget,
}, signingHistory);
signingEngine.setAuthorityStore(authorityStore);
const securityMonitor = new SecurityMonitor(dataDir, {
  maxEvents: config.security.maxEvents,
});
const lockManager = new LockManager(keyManager, {
  strictIdleTimeoutMs: config.lock.strictIdleTimeoutMs,
});
const priceService = new PriceService();
const balanceService = new BalanceService(networkConfigService, rpcProviderManager);
let relayBridge: RelayBridge | null = null;
/** Unified routing for Relay-driven UI events (all `RelayAccountChannel`s). */
let messageRouter: MessageRouter | null = null;

function syncMessageRouterActiveAccount(): void {
  if (!messageRouter) return;
  try {
    messageRouter.setActiveAccount(accountManager.getActiveAccountIndex());
  } catch {
    messageRouter.setActiveAccount(0);
  }
}

function syncWalletAccountsAfterUnlock(): void {
  const mnemonic = keyManager.getMnemonicIfUnlocked();
  if (!mnemonic) return;
  try {
    accountManager.ensureDefaultAccount(mnemonic);
    const idx = accountManager.resolveStartupAccountIndex();
    accountManager.setActiveAccountIndexSilent(idx);
    keyManager.setActiveAccountIndex(idx);
    syncMessageRouterActiveAccount();
  } catch (e) {
    console.error("[Desktop] syncWalletAccountsAfterUnlock:", e);
  }
}

function listWalletAccountsForRenderer(): Array<{
  index: number;
  nickname: string;
  address: string;
  isActive: boolean;
}> {
  const mnemonic = keyManager.getMnemonicIfUnlocked();
  if (!mnemonic) throw new Error("Wallet locked");
  accountManager.ensureDefaultAccount(mnemonic);
  const active = accountManager.getActiveAccountIndex();
  return accountManager.listAccounts().map((acc) => ({
    index: acc.index,
    nickname: acc.nickname,
    address: accountManager.getAddress(mnemonic, acc.index),
    isActive: acc.index === active,
  }));
}

/** Safely send an IPC message to the renderer, guarding against destroyed windows. */
function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function createWindow(): void {
  const base = app.getAppPath();
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 390,
    minHeight: 600,
    webPreferences: {
      preload: join(base, "dist", "preload", "index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: "hiddenInset",
    icon: join(base, "assets", "icon.png"),
    show: false,
  });

  mainWindow.loadFile(join(base, "dist", "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (e: Electron.Event) => {
    if (tray && process.platform !== "darwin") {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const updateTrayMenu = () => {
    const connected = relayBridge?.isConnected() ?? false;
    const template: Electron.MenuItemConstructorOptions[] = [
      { label: `Claw Wallet ${connected ? "(Connected)" : "(Disconnected)"}`, enabled: false },
      { type: "separator" },
      { label: "Show Window", click: () => mainWindow?.show() },
      { label: "Lock Wallet", click: () => lockManager.lock() },
      { type: "separator" },
      { label: "Quit", click: () => { tray = null; app.quit(); } },
    ];
    tray?.setContextMenu(Menu.buildFromTemplate(template));
    tray?.setToolTip(`Claw Wallet - ${connected ? "Connected" : "Disconnected"}`);
  };

  updateTrayMenu();
  setInterval(updateTrayMenu, 5000);
}

function registerIpcHandlers(): void {
  ipcMain.handle("wallet:load-i18n-resource", async (_evt, language: string, namespace: string) => {
    return readLocaleNamespace(language, namespace);
  });

  ipcMain.handle("wallet:create", async (_, password: string) => {
    const result = await keyManager.createWallet(password);
    syncWalletAccountsAfterUnlock();
    await relayBridge?.refreshChannels();
    return { address: result.address, mnemonic: result.mnemonic };
  });

  ipcMain.handle("wallet:import", async (_, mnemonic: string, password: string) => {
    const result = await keyManager.importWallet(mnemonic, password);
    syncWalletAccountsAfterUnlock();
    await relayBridge?.refreshChannels();
    return { address: result.address };
  });

  ipcMain.handle("wallet:unlock", async (_, password: string) => {
    await keyManager.unlock(password);
    syncWalletAccountsAfterUnlock();
    lockManager.onUnlock();
    await relayBridge?.refreshChannels();
    sendToRenderer("wallet:lock-state", false);
    if (keyManager.canEnableBiometric() && !keyManager.isBiometricAvailable()) {
      sendToRenderer("wallet:biometric-prompt", password);
    }
  });

  ipcMain.handle("wallet:unlock-biometric", async () => {
    await keyManager.unlockBiometric();
    syncWalletAccountsAfterUnlock();
    lockManager.onUnlock();
    await relayBridge?.refreshChannels();
    sendToRenderer("wallet:lock-state", false);
  });

  ipcMain.handle("wallet:lock", async () => {
    lockManager.lock();
    sendToRenderer("wallet:lock-state", true);
  });

  ipcMain.handle("wallet:status", async () => {
    let activeAccountIndex = 0;
    if (keyManager.isUnlocked()) {
      try {
        activeAccountIndex = accountManager.getActiveAccountIndex();
      } catch {
        activeAccountIndex = 0;
      }
    }
    return {
      hasWallet: keyManager.hasWallet(),
      isUnlocked: keyManager.isUnlocked(),
      address: keyManager.getAddress(),
      activeAccountIndex,
      connectedAgents: relayBridge?.connectedDeviceCount() ?? 0,
      lockMode: lockManager.getMode(),
      sameMachineWarning: securityMonitor.hasSameMachineWarning(),
    };
  });

  ipcMain.handle("wallet:list-accounts", async () => {
    return listWalletAccountsForRenderer();
  });

  ipcMain.handle("wallet:list-configured-networks", async () => {
    const ids = networkConfigService.getSupportedChainIds();
    return ids.map((chainId) => {
      const n = networkConfigService.getNetwork(chainId);
      return { chainId, name: n?.name ?? `Chain ${chainId}` };
    });
  });

  ipcMain.handle("wallet:switch-account", async (_, index: number) => {
    const mnemonic = keyManager.getMnemonicIfUnlocked();
    if (!mnemonic) throw new Error("Wallet locked");
    accountManager.switchAccount(index);
    keyManager.setActiveAccountIndex(index);
    messageRouter?.setActiveAccount(index);
    await messageRouter?.processQueuedMessages(index);
    balanceService.clearCache();
    const addr = keyManager.getAddress();
    sendToRenderer("wallet:account-changed", {
      address: addr,
      accountIndex: index,
    });
  });

  ipcMain.handle("wallet:create-sub-account", async (_, nickname?: string) => {
    const mnemonic = keyManager.getMnemonicIfUnlocked();
    if (!mnemonic) throw new Error("Wallet locked");
    accountManager.createAccount(mnemonic, nickname);
    balanceService.clearCache();
    await relayBridge?.refreshChannels();
    return listWalletAccountsForRenderer();
  });

  ipcMain.handle("wallet:update-account-nickname", async (_, index: number, nickname: string) => {
    accountManager.updateNickname(index, nickname.trim());
    return listWalletAccountsForRenderer();
  });

  ipcMain.handle("wallet:pair-code", async () => {
    if (!relayBridge) throw new Error("Relay not initialized");
    return relayBridge.generatePairCode();
  });

  ipcMain.handle("wallet:pending-pairing", async () => {
    if (!relayBridge) return { code: null, expiresAt: null };
    return relayBridge.getPendingPairingForActiveAccount();
  });

  ipcMain.handle("wallet:revoke-pairing", async (_, deviceId: string) => {
    if (!relayBridge) throw new Error("Relay not initialized");
    relayBridge.revokePairing(deviceId);
  });

  ipcMain.handle("wallet:repair-device", async (_, deviceId: string) => {
    if (!relayBridge) throw new Error("Relay not initialized");
    return relayBridge.repairDevice(deviceId);
  });

  ipcMain.handle("wallet:get-ip-policy", async () => {
    if (!relayBridge) return "warn";
    return relayBridge.getIpChangePolicy();
  });

  ipcMain.handle("wallet:set-ip-policy", async (_, policy: "block" | "warn" | "allow") => {
    if (!relayBridge) throw new Error("Relay not initialized");
    relayBridge.setIpChangePolicy(policy);
  });

  ipcMain.handle("wallet:paired-devices", async () => {
    if (!relayBridge) return [];
    return relayBridge.getPairedDevices();
  });

  ipcMain.handle(
    "wallet:approve-tx",
    async (
      _,
      requestId: string,
      opts?: { trustRecipientAfterSuccess?: boolean; trustRecipientName?: string },
    ) => {
      console.log(`[desktop] IPC approve-tx: requestId=${requestId}`, opts);
      if (!relayBridge) throw new Error("Relay not initialized");
      await signingEngine.approve(requestId, {
        trustRecipientAfterSuccess: opts?.trustRecipientAfterSuccess === true,
        trustRecipientName: opts?.trustRecipientName,
      });
      console.log(`[desktop] IPC approve-tx: done requestId=${requestId}`);
    },
  );

  ipcMain.handle(
    "wallet:respond-contact-add",
    (_, requestId: string, choice: "normal" | "trusted" | "reject") => {
      if (!relayBridge) throw new Error("Relay not initialized");
      relayBridge.resolveContactAddRequest(requestId, choice);
    },
  );

  ipcMain.handle("wallet:reject-tx", async (_, requestId: string) => {
    console.log(`[desktop] IPC reject-tx: requestId=${requestId}`);
    if (!relayBridge) throw new Error("Relay not initialized");
    signingEngine.reject(requestId);
  });

  ipcMain.handle("wallet:set-allowance", async (_, allowanceConfig) => {
    await signingEngine.setAllowance(allowanceConfig);
  });

  ipcMain.handle("wallet:get-allowance", async () => {
    return signingEngine.getAllowance();
  });

  ipcMain.handle("wallet:set-lock-mode", async (_, mode: "convenience" | "strict") => {
    lockManager.setMode(mode);
  });

  ipcMain.handle("wallet:get-lock-mode", async () => {
    return lockManager.getMode();
  });

  ipcMain.handle("wallet:set-biometric", async (_, enabled: boolean, password?: string) => {
    await keyManager.setBiometricEnabled(enabled, password);
  });

  ipcMain.handle("wallet:biometric-available", async () => {
    return keyManager.isBiometricAvailable();
  });

  ipcMain.handle("wallet:biometric-label", async () => {
    return keyManager.getBiometricLabel();
  });

  ipcMain.handle("wallet:can-enable-biometric", async () => {
    return keyManager.canEnableBiometric();
  });

  ipcMain.handle("wallet:security-events", async () => {
    return securityMonitor.getEvents();
  });

  ipcMain.handle("wallet:respond-alert", async (_, alertId: string, action: string) => {
    await securityMonitor.respondToAlert(alertId, action as "freeze" | "allow_once" | "trust");
  });

  ipcMain.handle("wallet:export-mnemonic", async (_, password: string) => {
    return keyManager.exportMnemonic(password);
  });

  ipcMain.handle("wallet:get-token-prices", async (_, tokens: string[]) => {
    return priceService.getTokenPrices(tokens);
  });

  ipcMain.handle("wallet:get-wallet-balances", async (_, address: string) => {
    return balanceService.getWalletBalances(address, config.signing.tokenWhitelist);
  });

  ipcMain.handle(
    "wallet:add-custom-token",
    async (
      _,
      input: { chainId: number; contractAddress: string; symbol: string; name?: string; decimals?: number },
    ) => {
      const token = networkConfigService.addCustomToken(input);
      balanceService.clearCache();
      return token;
    },
  );

  ipcMain.handle("wallet:list-custom-tokens", async () => {
    return networkConfigService.listCustomTokens();
  });

  ipcMain.handle("wallet:remove-custom-token", async (_, symbol: string, chainId: number) => {
    networkConfigService.removeCustomToken(symbol, chainId);
    balanceService.clearCache();
  });

  ipcMain.handle("wallet:get-signing-history", async (_, accountIndex?: number) => {
    const index = accountIndex ?? accountManager.getActiveAccountIndex();
    return signingHistory.getRecords(index);
  });

  ipcMain.handle("wallet:get-activity-records", async (_, accountIndex?: number, limit?: number, offset?: number) => {
    const index = accountIndex ?? accountManager.getActiveAccountIndex();
    return signingHistory.getRecords(index, limit, offset);
  });

  ipcMain.handle("wallet:get-activity-by-type", async (_, accountIndex: number | undefined, type: "auto" | "manual" | "rejected") => {
    const index = accountIndex ?? accountManager.getActiveAccountIndex();
    return signingHistory.getRecordsByType(index, type);
  });

  ipcMain.handle("wallet:get-activity-by-status", async (_, accountIndex: number | undefined, status: "pending" | "success" | "failed") => {
    const index = accountIndex ?? accountManager.getActiveAccountIndex();
    return signingHistory.getRecordsByStatus(index, status);
  });

  ipcMain.handle("wallet:list-contacts", async (_, accountIndex?: number) => {
    const index = accountIndex ?? accountManager.getActiveAccountIndex();
    return authorityStore.listContacts(index);
  });

  ipcMain.handle("wallet:remove-contact", async (_, accountIndex: number | undefined, name: string) => {
    const index = accountIndex ?? accountManager.getActiveAccountIndex();
    if (!name?.trim() || authorityStore.removeContactsByName(index, name) === 0) {
      throw new Error("Contact not found");
    }
  });
}

app.whenReady().then(async () => {
  await keyManager.initialize();
  await securityMonitor.initialize();
  signingEngine.setDataDir(dataDir);
  await signingEngine.loadAllowance();
  const wl = signingEngine.getAllowance().addressWhitelist;
  if (wl.length > 0) {
    authorityStore.mergeLegacyAllowanceWhitelist(wl, 0);
    await signingEngine.setAllowance({ addressWhitelist: [] });
  }

  messageRouter = new MessageRouter();
  messageRouter.setAccountInfoResolver(async (idx) => {
    const addr = keyManager.getAddressForAccountIndex(idx) ?? "";
    let nickname = `Account ${idx}`;
    try {
      const acc = accountManager.getAccount(idx);
      if (acc) nickname = acc.nickname;
    } catch {
      /* ignore */
    }
    return { nickname, address: addr };
  });
  messageRouter.on("sign-request", (payload) => {
    console.log("[desktop] Showing tx approval modal for", (payload as { requestId?: string }).requestId);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    sendToRenderer("wallet:tx-request", payload);
  });
  messageRouter.on("contact-request", (payload) => {
    console.log("[desktop] Contact add request", (payload as { requestId?: string }).requestId);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    sendToRenderer("wallet:contact-add-request", payload);
  });
  messageRouter.on("security-alert", (payload) => {
    securityMonitor.registerPendingAlert(payload as { alertId: string; type: string; timestamp: number });
    sendToRenderer("wallet:security-alert", payload);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  registerIpcHandlers();

  // Sync pending txs for every known account (not only active); default was [0] without this.
  txSyncService.setActiveAccountIndexes(() => {
    try {
      const accounts = accountManager.listAccounts();
      if (accounts.length === 0) return [0];
      return accounts.map((a) => a.index);
    } catch {
      return [0];
    }
  });
  txSyncService.startPeriodicSync(30000); // Every 30 seconds

  // Start RPC health monitoring
  rpcProviderManager.startHealthChecks();
  console.log('[Desktop] RPC health monitoring started');

  createWindow();
  if (!process.env.E2E_SKIP_TRAY) {
    createTray();
  }

  relayBridge = new RelayBridge({
    dataDir,
    keyManager,
    accountManager,
    signingEngine,
    securityMonitor,
    priceService,
    authorityStore,
    signingHistory,
    txSyncService,
    messageRouter,
    relayUrl: config.relayUrl,
    reconnectBaseMs: config.relay.reconnectBaseMs,
    reconnectMaxMs: config.relay.reconnectMaxMs,
    ipChangePolicy: config.ipChangePolicy,
    getMultiAccountTxContext: () => {
      const mnemonic = keyManager.getMnemonicIfUnlocked();
      const activeAccountIndex = accountManager.getActiveAccountIndex();
      const signingAccountIndex = activeAccountIndex;
      const activeAddress = keyManager.getAddress() ?? "";
      let signingNickname = `Account ${signingAccountIndex}`;
      if (mnemonic) {
        try {
          const acc = accountManager.getAccount(signingAccountIndex);
          if (acc) signingNickname = acc.nickname;
        } catch {
          /* ignore */
        }
      }
      return {
        activeAccountIndex,
        signingAccountIndex,
        signingAddress: activeAddress,
        activeAddress,
        signingNickname,
      };
    },
    onConnectionStatus: (status) => {
      sendToRenderer("wallet:connection-status", status);
    },
    onAgentStatus: (status) => {
      sendToRenderer("wallet:agent-status", status);
    },
  });

  syncMessageRouterActiveAccount();

  lockManager.onLock(() => {
    sendToRenderer("wallet:lock-state", true);
  });
});

app.on("activate", () => {
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  rpcProviderManager.stopHealthChecks();
  txSyncService.stopPeriodicSync();
  relayBridge?.shutdown();
  lockManager.lock();
});
