import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { E2EEKeyPair } from "../shared/e2ee-crypto.js";
import { KeyManager } from "./key-manager.js";
import { SigningEngine } from "./signing-engine.js";
import { SecurityMonitor } from "./security-monitor.js";
import type { PriceService } from "./price-service.js";
import type { WalletAuthorityStore } from "./wallet-authority-store.js";
import type { SigningHistory } from "./signing-history.js";
import type { TxSyncService } from "./tx-sync-service.js";
import type { AccountManager } from "./account-manager.js";
import { MessageRouter, MessageType } from "./message-router.js";
import {
  RelayAccountChannel,
  loadOrCreateCommKeyPair,
  type PairedDevice,
  type RelayAccountChannelOptions,
} from "./relay-account-channel.js";

export type {
  TransactionRequestInfo,
  ContactAddRequestInfo,
  ConnectionStatusInfo,
  SecurityAlertInfo,
} from "./relay-account-channel.js";

export interface RelayBridgeOptions {
  dataDir: string;
  keyManager: KeyManager;
  accountManager: AccountManager;
  signingEngine: SigningEngine;
  securityMonitor: SecurityMonitor;
  priceService: PriceService;
  authorityStore: WalletAuthorityStore;
  signingHistory: SigningHistory;
  txSyncService: TxSyncService;
  relayUrl: string;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  ipChangePolicy?: "block" | "warn" | "allow";
  getMultiAccountTxContext?: () => {
    activeAccountIndex: number;
    signingAccountIndex: number;
    signingAddress: string;
    activeAddress: string;
    signingNickname: string;
  };
  /** Unified UI routing for tx / contact / security alerts from all account channels. */
  messageRouter: MessageRouter;
  onConnectionStatus?: (status: import("./relay-account-channel.js").ConnectionStatusInfo) => void;
}

interface AccountPairingState {
  walletAddress: string;
  devices: PairedDevice[];
  pendingPairCode: string | null;
  pendingPairExpiresAt?: number | null;
}

interface StoredPairingsV2 {
  version: 2;
  accounts: Record<string, AccountPairingState>;
}

/** Legacy single-list pairings (pre multi-account WebSocket). */
interface StoredPairingsV1 {
  devices: PairedDevice[];
}

const MAX_ACCOUNTS = 10;

export class RelayBridge {
  private options: RelayBridgeOptions;
  private pairingsPath: string;
  private dataDir: string;
  private pairings: StoredPairingsV2 = { version: 2, accounts: {} };
  private keyPair!: E2EEKeyPair;
  private channels = new Map<number, RelayAccountChannel>();
  private destroyed = false;
  private readonly initPromise: Promise<void>;
  private relayUrl: string;
  private ipChangePolicy: "block" | "warn" | "allow";
  private reconnectBaseMs: number;
  private reconnectMaxMs: number;

  constructor(options: RelayBridgeOptions) {
    this.options = options;
    this.dataDir = options.dataDir;
    this.pairingsPath = join(options.dataDir, "pairings.enc.json");
    this.relayUrl = options.relayUrl;
    this.ipChangePolicy = options.ipChangePolicy ?? "warn";
    this.reconnectBaseMs = options.reconnectBaseMs ?? 1000;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30000;
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    this.keyPair = await loadOrCreateCommKeyPair(this.dataDir);
    await this.loadPairingsFromDisk();
    await this.syncChannels(false);
  }

  /** Call after unlock / account list changes so every sub-account gets a dedicated WS when paired. */
  async refreshChannels(): Promise<void> {
    if (this.destroyed) return;
    await this.initPromise;
    await this.syncChannels(true);
  }

  private getOrCreateAccountState(index: number): AccountPairingState {
    const key = String(index);
    if (!this.pairings.accounts[key]) {
      this.pairings.accounts[key] = {
        walletAddress: "",
        devices: [],
        pendingPairCode: null,
        pendingPairExpiresAt: null,
      };
    }
    return this.pairings.accounts[key];
  }

  private async loadPairingsFromDisk(): Promise<void> {
    try {
      const raw = await readFile(this.pairingsPath, "utf-8");
      const j = JSON.parse(raw) as StoredPairingsV2 | StoredPairingsV1;
      if ("version" in j && j.version === 2 && j.accounts) {
        this.pairings = j;
        return;
      }
      const v1 = j as StoredPairingsV1;
      const addr = this.options.keyManager.getAddress() ?? "";
      this.pairings = {
        version: 2,
        accounts: {
          "0": {
            walletAddress: addr,
            devices: Array.isArray(v1.devices) ? v1.devices : [],
            pendingPairCode: null,
            pendingPairExpiresAt: null,
          },
        },
      };
      await this.savePairingsToDisk();
      console.log("[relay-bridge] migrated pairings.enc.json to v2 (per-account WebSockets)");
    } catch {
      this.pairings = { version: 2, accounts: {} };
    }
  }

  private async savePairingsToDisk(): Promise<void> {
    await writeFile(this.pairingsPath, JSON.stringify(this.pairings, null, 2), { mode: 0o600 });
  }

  private async persistAccount(payload: {
    accountIndex: number;
    devices: PairedDevice[];
    pendingPairCode: string | null;
    pendingPairExpiresAt: number | null;
    walletAddress: string;
  }): Promise<void> {
    const st = this.getOrCreateAccountState(payload.accountIndex);
    st.devices = payload.devices;
    st.pendingPairCode = payload.pendingPairCode;
    st.pendingPairExpiresAt = payload.pendingPairExpiresAt;
    if (payload.walletAddress) {
      st.walletAddress = payload.walletAddress;
    }
    await this.savePairingsToDisk();
  }

  private buildChannelOptions(accountIndex: number): RelayAccountChannelOptions {
    return {
      accountIndex,
      keyManager: this.options.keyManager,
      signingEngine: this.options.signingEngine,
      securityMonitor: this.options.securityMonitor,
      priceService: this.options.priceService,
      authorityStore: this.options.authorityStore,
      signingHistory: this.options.signingHistory,
      txSyncService: this.options.txSyncService,
      relayUrl: this.relayUrl,
      reconnectBaseMs: this.reconnectBaseMs,
      reconnectMaxMs: this.reconnectMaxMs,
      ipChangePolicy: this.ipChangePolicy,
      getMultiAccountTxContext: this.options.getMultiAccountTxContext,
      getAccountNickname: (idx) => {
        try {
          const acc = this.options.accountManager.getAccount(idx);
          return acc?.nickname ?? `Account ${idx}`;
        } catch {
          return `Account ${idx}`;
        }
      },
      onTransactionRequest: (req) => {
        void this.options.messageRouter.routeDecrypted({
          type: MessageType.SIGN_REQUEST,
          fromAccount: accountIndex,
          data: req,
        });
      },
      onContactAddRequest: (req) => {
        void this.options.messageRouter.routeDecrypted({
          type: MessageType.CONTACT_ADD_REQUEST,
          fromAccount: accountIndex,
          data: req,
        });
      },
      onConnectionStatus: () => {
        this.emitAggregatedConnectionStatus();
      },
      onSecurityAlert: (alert) => {
        void this.options.messageRouter.routeDecrypted({
          type: MessageType.SECURITY_ALERT,
          fromAccount: accountIndex,
          data: alert,
        });
      },
      onPersistState: (p) => this.persistAccount(p),
    };
  }

  private emitAggregatedConnectionStatus(): void {
    let any = false;
    let devices = 0;
    for (const ch of this.channels.values()) {
      if (ch.isConnected()) any = true;
      devices += ch.connectedDeviceCount();
    }
    this.options.onConnectionStatus?.({
      connected: any,
      relayUrl: this.relayUrl,
      connectedDevices: devices,
    });
  }

  private async ensureChannel(accountIndex: number): Promise<RelayAccountChannel> {
    let ch = this.channels.get(accountIndex);
    if (ch) return ch;
    ch = new RelayAccountChannel(this.dataDir, this.keyPair, this.buildChannelOptions(accountIndex));
    this.channels.set(accountIndex, ch);
    return ch;
  }

  /**
   * Create/update channels for every account index that has pairing data or exists in AccountManager.
   */
  private async syncChannels(shouldConnect: boolean): Promise<void> {
    const indices = new Set<number>();
    for (const k of Object.keys(this.pairings.accounts)) {
      const n = parseInt(k, 10);
      if (!Number.isNaN(n) && n >= 0 && n < MAX_ACCOUNTS) indices.add(n);
    }
    if (this.options.keyManager.isUnlocked()) {
      try {
        for (const a of this.options.accountManager.listAccounts()) {
          if (a.index >= 0 && a.index < MAX_ACCOUNTS) indices.add(a.index);
        }
      } catch {
        /* ignore */
      }
    }
    for (const idx of indices) {
      const st = this.getOrCreateAccountState(idx);
      const unlockedAddr = this.options.keyManager.getAddressForAccountIndex(idx);
      const walletAddress = unlockedAddr ?? st.walletAddress ?? "";
      if (unlockedAddr) {
        st.walletAddress = unlockedAddr;
      }
      const ch = await this.ensureChannel(idx);
      await ch.hydrateFromStorage(
        st.devices,
        st.pendingPairCode,
        st.pendingPairExpiresAt ?? null,
        walletAddress,
        shouldConnect,
      );
    }
    this.emitAggregatedConnectionStatus();
  }

  async generatePairCode(): Promise<{ code: string; expiresAt: number }> {
    await this.initPromise;
    const idx = this.options.getMultiAccountTxContext?.()?.activeAccountIndex ?? 0;
    const addr = this.options.keyManager.getAddressForAccountIndex(idx);
    if (!addr) throw new Error("Wallet locked or invalid account");
    const st = this.getOrCreateAccountState(idx);
    st.walletAddress = addr;
    await this.savePairingsToDisk();
    await this.syncChannels(true);
    const ch = await this.ensureChannel(idx);
    return ch.generatePairCode();
  }

  /** Current account’s in-memory / persisted pending pair code (for UI after account switch). */
  async getPendingPairingForActiveAccount(): Promise<{ code: string | null; expiresAt: number | null }> {
    await this.initPromise;
    const idx = this.options.getMultiAccountTxContext?.()?.activeAccountIndex ?? 0;
    const ch = this.channels.get(idx);
    if (ch) {
      return ch.getPendingPairingDisplay();
    }
    const st = this.pairings.accounts[String(idx)];
    return {
      code: st?.pendingPairCode ?? null,
      expiresAt: st?.pendingPairExpiresAt ?? null,
    };
  }

  isConnected(): boolean {
    for (const ch of this.channels.values()) {
      if (ch.isConnected()) return true;
    }
    return false;
  }

  connectedDeviceCount(): number {
    let n = 0;
    for (const ch of this.channels.values()) {
      n += ch.connectedDeviceCount();
    }
    return n;
  }

  getPairedDevices(): Array<PairedDevice & { accountIndex: number }> {
    const out: Array<PairedDevice & { accountIndex: number }> = [];
    for (const [idx, ch] of this.channels) {
      for (const d of ch.getPairedDevices()) {
        out.push({ ...d, accountIndex: idx });
      }
    }
    return out;
  }

  revokePairing(deviceId: string): void {
    for (const ch of this.channels.values()) {
      if (ch.getPairedDevices().some((d) => d.deviceId === deviceId)) {
        ch.revokePairing(deviceId);
        return;
      }
    }
  }

  resolveContactAddRequest(requestId: string, choice: "normal" | "trusted" | "reject"): void {
    for (const ch of this.channels.values()) {
      ch.resolveContactAddRequest(requestId, choice);
    }
  }

  getIpChangePolicy(): "block" | "warn" | "allow" {
    return this.ipChangePolicy;
  }

  setIpChangePolicy(policy: "block" | "warn" | "allow"): void {
    this.ipChangePolicy = policy;
    for (const ch of this.channels.values()) {
      ch.setIpChangePolicy(policy);
    }
  }

  async repairDevice(deviceId: string): Promise<{ code: string; expiresAt: number }> {
    await this.initPromise;
    for (const ch of this.channels.values()) {
      if (ch.getPairedDevices().some((d) => d.deviceId === deviceId)) {
        return ch.repairDevice(deviceId);
      }
    }
    return this.generatePairCode();
  }

  shutdown(): void {
    this.destroyed = true;
    for (const ch of this.channels.values()) {
      ch.shutdown();
    }
    this.channels.clear();
    this.keyPair.privateKey.fill(0);
  }
}
