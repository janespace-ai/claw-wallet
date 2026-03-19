import WebSocket from "ws";
import {
  generateKeyPair,
  deriveSharedKey,
  createSession,
  encryptJSON,
  decryptJSON,
  destroySession,
  type E2EESession,
  type E2EEKeyPair,
} from "./crypto.js";

export interface RelayTransportOptions {
  relayUrl: string;
  pairId: string;
  keyPair?: E2EEKeyPair;
  onMessage?: (data: unknown, sourceIP: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onPeerDisconnect?: () => void;
}

interface RelayEnvelope {
  sourceIP: string;
  data: unknown;
}

export class RelayTransport {
  private ws: WebSocket | null = null;
  private session: E2EESession | null = null;
  private keyPair: E2EEKeyPair;
  private peerPublicKey: Uint8Array | null = null;
  private options: RelayTransportOptions;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(options: RelayTransportOptions) {
    this.options = options;
    this.keyPair = options.keyPair ?? generateKeyPair();
  }

  getPublicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  getPublicKeyHex(): string {
    return Buffer.from(this.keyPair.publicKey).toString("hex");
  }

  setPeerPublicKey(peerPubHex: string): void {
    this.peerPublicKey = Buffer.from(peerPubHex, "hex");
    this.establishSession();
  }

  private establishSession(): void {
    if (!this.peerPublicKey) return;

    if (this.session) {
      destroySession(this.session);
    }

    const sharedKey = deriveSharedKey(this.keyPair.privateKey, this.peerPublicKey);
    this.session = createSession(sharedKey, this.options.pairId);
    sharedKey.fill(0);
  }

  connect(): void {
    if (this.destroyed) return;

    const url = `${this.options.relayUrl}/ws?pairId=${encodeURIComponent(this.options.pairId)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.reconnectAttempt = 0;
      this.options.onConnect?.();
    });

    this.ws.on("message", (rawData: WebSocket.RawData) => {
      try {
        const envelope: RelayEnvelope = JSON.parse(rawData.toString());
        const sourceIP = envelope.sourceIP || "unknown";

        if (typeof envelope.data === "object" && envelope.data !== null) {
          const msg = envelope.data as Record<string, unknown>;

          if (msg.type === "peer_disconnected") {
            this.options.onPeerDisconnect?.();
            return;
          }

          if (msg.type === "handshake" && typeof msg.publicKey === "string") {
            this.setPeerPublicKey(msg.publicKey);
            return;
          }

          if (msg.type === "encrypted" && typeof msg.payload === "string") {
            if (!this.session) return;
            const payloadBytes = Buffer.from(msg.payload, "base64");
            const decrypted = decryptJSON(this.session, payloadBytes);
            this.options.onMessage?.(decrypted, sourceIP);
            return;
          }
        }

        this.options.onMessage?.(envelope.data, sourceIP);
      } catch {
        // malformed message, ignore
      }
    });

    this.ws.on("close", () => {
      this.options.onDisconnect?.();
      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", () => {
      this.ws?.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.establishSession();
        this.connect();
      }
    }, delay);
  }

  sendHandshake(): void {
    this.sendRaw({
      type: "handshake",
      publicKey: this.getPublicKeyHex(),
    });
  }

  sendEncrypted(data: unknown): void {
    if (!this.session) {
      throw new Error("E2EE session not established");
    }
    const encrypted = encryptJSON(this.session, data);
    this.sendRaw({
      type: "encrypted",
      payload: Buffer.from(encrypted).toString("base64"),
    });
  }

  private sendRaw(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(data));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  hasSession(): boolean {
    return this.session !== null;
  }

  disconnect(): void {
    this.destroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.session) {
      destroySession(this.session);
      this.session = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.keyPair.privateKey.fill(0);
  }
}
