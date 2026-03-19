import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { hostname, networkInterfaces } from "node:os";
import WebSocket from "ws";
import {
  generateKeyPair,
  deriveSharedKey,
  createSession,
  encryptJSON,
  decryptJSON,
  destroySession,
  type E2EEKeyPair,
  type E2EESession,
} from "../../shared/e2ee-crypto.js";
import { KeyManager } from "./key-manager.js";
import { SigningEngine } from "./signing-engine.js";
import { SecurityMonitor } from "./security-monitor.js";

export interface RelayBridgeOptions {
  dataDir: string;
  keyManager: KeyManager;
  signingEngine: SigningEngine;
  securityMonitor: SecurityMonitor;
  relayUrl?: string;
  onTransactionRequest?: (req: TransactionRequestInfo) => void;
  onConnectionStatus?: (status: ConnectionStatusInfo) => void;
  onSecurityAlert?: (alert: SecurityAlertInfo) => void;
}

export interface TransactionRequestInfo {
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

export interface ConnectionStatusInfo {
  connected: boolean;
  relayUrl: string;
  connectedDevices: number;
}

export interface SecurityAlertInfo {
  alertId: string;
  type: "ip_change" | "fingerprint_change" | "same_machine";
  message: string;
  details: Record<string, string>;
  timestamp: number;
}

interface PairedDevice {
  deviceId: string;
  pairId: string;
  machineId: string;
  agentPublicKey: string;
  lastIP: string;
  pairedAt: string;
  lastSeen: string;
}

interface StoredPairings {
  devices: PairedDevice[];
}

const DEFAULT_RELAY_URL = "ws://localhost:8765";
const PAIR_CODE_ENDPOINT = "/pair/create";

export class RelayBridge {
  private options: RelayBridgeOptions;
  private keyPair: E2EEKeyPair;
  private sessions = new Map<string, E2EESession>();
  private ws: WebSocket | null = null;
  private pairings: StoredPairings = { devices: [] };
  private pairingsPath: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private relayUrl: string;
  private pendingPairCode: string | null = null;

  constructor(options: RelayBridgeOptions) {
    this.options = options;
    this.keyPair = generateKeyPair();
    this.pairingsPath = join(options.dataDir, "pairings.enc.json");
    this.relayUrl = options.relayUrl ?? DEFAULT_RELAY_URL;

    this.initialize();
  }

  private async initialize(): Promise<void> {
    await mkdir(this.options.dataDir, { recursive: true });
    await this.loadPairings();
    if (this.pairings.devices.length > 0) {
      this.connect();
    }
  }

  async generatePairCode(): Promise<{ code: string; expiresAt: number }> {
    const address = this.options.keyManager.getAddress();
    if (!address) throw new Error("No wallet found");

    const httpUrl = this.relayUrl.replace(/^ws/, "http");
    const response = await fetch(`${httpUrl}${PAIR_CODE_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddr: address,
        commPubKey: Buffer.from(this.keyPair.publicKey).toString("hex"),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create pairing code (HTTP ${response.status})`);
    }

    const data = await response.json() as { shortCode: string; expiresIn: number };
    this.pendingPairCode = data.shortCode;
    const expiresAt = Date.now() + data.expiresIn * 1000;

    if (!this.ws) {
      this.connect();
    }

    return { code: data.shortCode, expiresAt };
  }

  private connect(): void {
    if (this.destroyed || this.ws) return;

    const pairId = this.pairings.devices[0]?.pairId ?? `pending-${Date.now()}`;
    const url = `${this.relayUrl}/ws?pairId=${encodeURIComponent(pairId)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.reconnectAttempt = 0;
      this.emitConnectionStatus(true);
    });

    this.ws.on("message", (rawData: WebSocket.RawData) => {
      try {
        this.handleMessage(JSON.parse(rawData.toString()));
      } catch {}
    });

    this.ws.on("close", () => {
      this.ws = null;
      this.emitConnectionStatus(false);
      if (!this.destroyed) this.scheduleReconnect();
    });

    this.ws.on("error", () => {
      this.ws?.close();
    });
  }

  private handleMessage(envelope: { sourceIP?: string; data: unknown }): void {
    const sourceIP = envelope.sourceIP ?? "unknown";
    const msg = envelope.data as Record<string, unknown>;
    if (!msg) return;

    if (msg.type === "handshake" && typeof msg.publicKey === "string") {
      this.handleHandshake(msg.publicKey, sourceIP);
      return;
    }

    if (msg.type === "encrypted" && typeof msg.payload === "string") {
      this.handleEncryptedMessage(msg.payload, sourceIP);
      return;
    }
  }

  private handleHandshake(agentPubKeyHex: string, sourceIP: string): void {
    const agentPubKey = Buffer.from(agentPubKeyHex, "hex");
    const sharedKey = deriveSharedKey(this.keyPair.privateKey, agentPubKey);

    const deviceId = createHash("sha256").update(agentPubKeyHex).digest("hex").slice(0, 16);
    const pairId = createHash("sha256")
      .update(`${deviceId}-${Date.now()}`)
      .digest("hex")
      .slice(0, 16);

    const session = createSession(sharedKey, pairId);
    this.sessions.set(deviceId, session);
    sharedKey.fill(0);

    this.sendRaw({
      type: "handshake",
      publicKey: Buffer.from(this.keyPair.publicKey).toString("hex"),
    });
  }

  private handleEncryptedMessage(payloadBase64: string, sourceIP: string): void {
    for (const [deviceId, session] of this.sessions) {
      try {
        const payloadBytes = Buffer.from(payloadBase64, "base64");
        const data = decryptJSON<Record<string, unknown>>(session, payloadBytes);

        if (data.type === "pair_complete") {
          this.completePairing(deviceId, data, sourceIP);
          return;
        }

        if (data.requestId && data.method) {
          this.handleSignRequest(deviceId, data, sourceIP);
          return;
        }

        return;
      } catch {
        continue;
      }
    }
  }

  private async completePairing(
    deviceId: string,
    data: Record<string, unknown>,
    sourceIP: string,
  ): Promise<void> {
    const agentMachineId = data.machineId as string;
    const localMachineId = getMachineId();

    if (agentMachineId === localMachineId) {
      const alert: SecurityAlertInfo = {
        alertId: `same-machine-${Date.now()}`,
        type: "same_machine",
        message: "WARNING: Agent and Wallet App are running on the same machine. This significantly reduces security!",
        details: { machineId: localMachineId },
        timestamp: Date.now(),
      };
      this.options.onSecurityAlert?.(alert);
      this.options.securityMonitor.recordSameMachine(agentMachineId);
    }

    const existingIdx = this.pairings.devices.findIndex(d => d.deviceId === deviceId);
    const device: PairedDevice = {
      deviceId,
      pairId: `pair-${deviceId}`,
      machineId: agentMachineId,
      agentPublicKey: data.agentPublicKey as string,
      lastIP: sourceIP,
      pairedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.pairings.devices[existingIdx] = device;
    } else {
      this.pairings.devices.push(device);
    }

    await this.savePairings();
  }

  private async handleSignRequest(
    deviceId: string,
    data: Record<string, unknown>,
    sourceIP: string,
  ): Promise<void> {
    const device = this.pairings.devices.find(d => d.deviceId === deviceId);
    const session = this.sessions.get(deviceId);
    if (!device || !session) return;

    if (device.lastIP && device.lastIP !== sourceIP && device.lastIP !== "unknown") {
      const alert: SecurityAlertInfo = {
        alertId: `ip-change-${Date.now()}`,
        type: "ip_change",
        message: `Agent IP changed from ${device.lastIP} to ${sourceIP}`,
        details: { oldIP: device.lastIP, newIP: sourceIP, deviceId },
        timestamp: Date.now(),
      };
      this.options.onSecurityAlert?.(alert);
      this.options.securityMonitor.recordIPChange(deviceId, device.lastIP, sourceIP);
    }

    device.lastIP = sourceIP;
    device.lastSeen = new Date().toISOString();

    const requestId = data.requestId as string;
    const method = data.method as string;
    const params = (data.params ?? {}) as Record<string, unknown>;

    try {
      const result = await this.options.signingEngine.handleSignRequest(
        requestId,
        method,
        params,
        0,
        (pendingReq) => {
          const txInfo: TransactionRequestInfo = {
            requestId: pendingReq.requestId,
            method: pendingReq.method,
            to: (params.to as string) ?? "",
            value: (params.value as string) ?? "0",
            token: (params.token as string) ?? "ETH",
            chain: (params.chain as string) ?? "base",
            fromDevice: deviceId,
            sourceIP,
            withinBudget: false,
          };
          this.options.onTransactionRequest?.(txInfo);
        },
      );

      this.sendEncrypted(session, {
        requestId,
        result,
      });
    } catch (err) {
      this.sendEncrypted(session, {
        requestId,
        error: (err as Error).message,
      });
    }
  }

  private sendEncrypted(session: E2EESession, data: unknown): void {
    const encrypted = encryptJSON(session, data);
    this.sendRaw({
      type: "encrypted",
      payload: Buffer.from(encrypted).toString("base64"),
    });
  }

  private sendRaw(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, delay);
  }

  private emitConnectionStatus(connected: boolean): void {
    this.options.onConnectionStatus?.({
      connected,
      relayUrl: this.relayUrl,
      connectedDevices: this.pairings.devices.length,
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connectedDeviceCount(): number {
    return this.pairings.devices.length;
  }

  getPairedDevices(): PairedDevice[] {
    return this.pairings.devices.map(d => ({ ...d }));
  }

  revokePairing(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (session) {
      destroySession(session);
      this.sessions.delete(deviceId);
    }
    this.pairings.devices = this.pairings.devices.filter(d => d.deviceId !== deviceId);
    this.savePairings();
  }

  shutdown(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    for (const [, session] of this.sessions) {
      destroySession(session);
    }
    this.sessions.clear();
    this.ws?.close();
    this.ws = null;
    this.keyPair.privateKey.fill(0);
  }

  private async loadPairings(): Promise<void> {
    try {
      const raw = await readFile(this.pairingsPath, "utf-8");
      this.pairings = JSON.parse(raw);
    } catch {
      this.pairings = { devices: [] };
    }
  }

  private async savePairings(): Promise<void> {
    await writeFile(this.pairingsPath, JSON.stringify(this.pairings, null, 2), { mode: 0o600 });
  }
}

function getMachineId(): string {
  const host = hostname();
  const ifaces = networkInterfaces();
  let mac = "";
  for (const name in ifaces) {
    for (const iface of ifaces[name] ?? []) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        mac = iface.mac;
        break;
      }
    }
    if (mac) break;
  }
  return createHash("sha256").update(`${host}:${mac}`).digest("hex").slice(0, 16);
}
