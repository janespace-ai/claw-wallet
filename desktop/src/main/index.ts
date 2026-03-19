import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import { join } from "node:path";
import { KeyManager } from "./key-manager.js";
import { SigningEngine } from "./signing-engine.js";
import { RelayBridge } from "./relay-bridge.js";
import { SecurityMonitor } from "./security-monitor.js";
import { LockManager } from "./lock-manager.js";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const dataDir = join(app.getPath("userData"), "wallet-data");
const keyManager = new KeyManager(dataDir);
const signingEngine = new SigningEngine(keyManager);
const securityMonitor = new SecurityMonitor(dataDir);
const lockManager = new LockManager(keyManager);
let relayBridge: RelayBridge | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: "hiddenInset",
    show: false,
  });

  mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (e) => {
    if (tray) {
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
  ipcMain.handle("wallet:create", async (_, password: string) => {
    const result = await keyManager.createWallet(password);
    return { address: result.address };
  });

  ipcMain.handle("wallet:import", async (_, mnemonic: string, password: string) => {
    const result = await keyManager.importWallet(mnemonic, password);
    return { address: result.address };
  });

  ipcMain.handle("wallet:unlock", async (_, password: string) => {
    await keyManager.unlock(password);
    lockManager.onUnlock();
    mainWindow?.webContents.send("wallet:lock-state", false);
  });

  ipcMain.handle("wallet:unlock-biometric", async () => {
    await keyManager.unlockBiometric();
    lockManager.onUnlock();
    mainWindow?.webContents.send("wallet:lock-state", false);
  });

  ipcMain.handle("wallet:lock", async () => {
    lockManager.lock();
    mainWindow?.webContents.send("wallet:lock-state", true);
  });

  ipcMain.handle("wallet:status", async () => {
    return {
      hasWallet: keyManager.hasWallet(),
      isUnlocked: keyManager.isUnlocked(),
      address: keyManager.getAddress(),
      connectedAgents: relayBridge?.connectedDeviceCount() ?? 0,
      lockMode: lockManager.getMode(),
      sameMachineWarning: securityMonitor.hasSameMachineWarning(),
    };
  });

  ipcMain.handle("wallet:pair-code", async () => {
    if (!relayBridge) throw new Error("Relay not initialized");
    return relayBridge.generatePairCode();
  });

  ipcMain.handle("wallet:revoke-pairing", async (_, deviceId: string) => {
    if (!relayBridge) throw new Error("Relay not initialized");
    relayBridge.revokePairing(deviceId);
  });

  ipcMain.handle("wallet:paired-devices", async () => {
    if (!relayBridge) return [];
    return relayBridge.getPairedDevices();
  });

  ipcMain.handle("wallet:approve-tx", async (_, requestId: string) => {
    if (!relayBridge) throw new Error("Relay not initialized");
    await signingEngine.approve(requestId);
  });

  ipcMain.handle("wallet:reject-tx", async (_, requestId: string) => {
    if (!relayBridge) throw new Error("Relay not initialized");
    signingEngine.reject(requestId);
  });

  ipcMain.handle("wallet:set-allowance", async (_, config) => {
    await signingEngine.setAllowance(config);
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

  ipcMain.handle("wallet:set-biometric", async (_, enabled: boolean) => {
    await keyManager.setBiometricEnabled(enabled);
  });

  ipcMain.handle("wallet:biometric-available", async () => {
    return keyManager.isBiometricAvailable();
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
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  createWindow();
  createTray();

  await keyManager.initialize();
  await securityMonitor.initialize();

  relayBridge = new RelayBridge({
    dataDir,
    keyManager,
    signingEngine,
    securityMonitor,
    onTransactionRequest: (req) => {
      mainWindow?.webContents.send("wallet:tx-request", req);
    },
    onConnectionStatus: (status) => {
      mainWindow?.webContents.send("wallet:connection-status", status);
    },
    onSecurityAlert: (alert) => {
      mainWindow?.webContents.send("wallet:security-alert", alert);
      mainWindow?.show();
    },
  });

  lockManager.onLock(() => {
    mainWindow?.webContents.send("wallet:lock-state", true);
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  relayBridge?.shutdown();
  lockManager.lock();
});
