import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { IpcServer, type RequestHandler } from "./ipc-server.js";
import {
  createSuccess,
  createError,
  RpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./ipc-protocol.js";
import { RelayTransport } from "../e2ee/transport.js";
import { getMachineId } from "../e2ee/machine-id.js";
import {
  generateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  derivePairId,
  type E2EEKeyPair,
} from "../e2ee/crypto.js";

export interface RelaySignerOptions {
  dataDir: string;
  socketPath: string;
  relayUrl: string;
}

interface PairingConfig {
  pairId: string;
  peerPublicKey: string;
  walletAddress: string;
  peerMachineId: string;
  pairedAt: string;
  commKeyPair?: { publicKey: string; privateKey: string };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const SIGN_TIMEOUT_MS = 120_000;

export class RelaySigner {
  private ipcServer: IpcServer;
  private transport: RelayTransport | null = null;
  private options: RelaySignerOptions;
  private pairing: PairingConfig | null = null;
  private commKeyPair: E2EEKeyPair | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;

  constructor(options: RelaySignerOptions) {
    this.options = options;
    const handler: RequestHandler = (req) => this.handleRequest(req);
    this.ipcServer = new IpcServer(options.socketPath, handler);
  }

  async start(): Promise<void> {
    await mkdir(this.options.dataDir, { recursive: true });
    await this.loadPairing();
    this.loadCommKeyPair();

    if (this.pairing) {
      this.connectRelay();
    }

    await this.ipcServer.start();
  }

  async shutdown(): Promise<void> {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Signer shutting down"));
    }
    this.pendingRequests.clear();

    this.transport?.disconnect();
    await this.ipcServer.stop();
  }

  private connectRelay(): void {
    if (!this.pairing) return;

    let pairId = this.pairing.pairId;
    if (this.commKeyPair && this.pairing.walletAddress) {
      const agentPubHex = Buffer.from(this.commKeyPair.publicKey).toString("hex");
      pairId = derivePairId(this.pairing.walletAddress, agentPubHex);
    }

    const isReconnect = !!this.pairing.pairedAt;

    this.transport = new RelayTransport({
      relayUrl: this.options.relayUrl,
      pairId,
      keyPair: this.commKeyPair ?? undefined,
      machineId: getMachineId(),
      reconnect: isReconnect,
      onMessage: (data, sourceIP) => this.handleRelayMessage(data, sourceIP),
      onConnect: () => {
        if (this.pairing?.peerPublicKey) {
          this.transport!.setPeerPublicKey(this.pairing.peerPublicKey);
          this.transport!.sendHandshake();
        }
      },
      onPeerDisconnect: () => {
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error("Wallet app disconnected"));
          this.pendingRequests.delete(id);
        }
      },
    });

    this.transport.connect();
  }

  private handleRelayMessage(data: unknown, _sourceIP: string): void {
    const msg = data as Record<string, unknown>;
    if (!msg || typeof msg.requestId !== "string") return;

    const pending = this.pendingRequests.get(msg.requestId as string);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(msg.requestId as string);

    if (msg.error) {
      pending.reject(new Error(msg.error as string));
    } else {
      pending.resolve(msg.result);
    }
  }

  private sendToWallet(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.transport?.isConnected() || !this.transport.hasSession()) {
        reject(new Error("Wallet app is offline. Please ensure the Electron Wallet App is running and connected."));
        return;
      }

      const requestId = `req-${++this.requestCounter}-${Date.now()}`;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Wallet app did not respond within timeout"));
      }, SIGN_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      try {
        this.transport.sendEncrypted({ requestId, method, params });
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  private async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      switch (req.method) {
        case "wallet_pair":
          return createSuccess(req.id, await this.handlePair(req.params));
        case "wallet_repair":
          return createSuccess(req.id, await this.handleRepair());
        case "get_address":
          return createSuccess(req.id, await this.handleGetAddress());
        case "sign_transaction":
          return createSuccess(req.id, await this.handleSignTransaction(req.params));
        case "create_wallet":
          return createSuccess(req.id, {
            message: "Please create your wallet in the Electron Wallet App, then use wallet_pair to connect.",
          });
        case "import_wallet":
          return createSuccess(req.id, {
            message: "Please import your wallet in the Electron Wallet App, then use wallet_pair to connect.",
          });
        default:
          return createError(req.id, RpcErrorCode.METHOD_NOT_FOUND, `Unknown method: ${req.method}`);
      }
    } catch (err) {
      return createError(req.id, RpcErrorCode.INTERNAL_ERROR, (err as Error).message);
    }
  }

  private async handlePair(params: Record<string, unknown> | undefined): Promise<unknown> {
    const shortCode = params?.shortCode as string;
    if (!shortCode) {
      throw new Error("Missing shortCode parameter. Generate a pairing code in the Electron Wallet App first.");
    }

    const response = await fetch(`${this.options.relayUrl}/pair/${encodeURIComponent(shortCode)}`);
    if (!response.ok) {
      throw new Error(`Pairing code invalid or expired (HTTP ${response.status})`);
    }

    const pairInfo = await response.json() as { walletAddr: string; commPubKey: string };

    if (!this.commKeyPair) {
      this.commKeyPair = generateKeyPair();
    }
    const agentPubHex = Buffer.from(this.commKeyPair.publicKey).toString("hex");
    const pairId = derivePairId(pairInfo.walletAddr, agentPubHex);

    this.transport?.disconnect();

    this.pairing = {
      pairId,
      peerPublicKey: pairInfo.commPubKey,
      walletAddress: pairInfo.walletAddr,
      peerMachineId: "",
      pairedAt: new Date().toISOString(),
    };

    this.connectRelay();

    if (this.transport) {
      this.transport.sendHandshake();

      const machineId = getMachineId();
      this.transport.sendEncrypted({
        type: "pair_complete",
        machineId,
        agentPublicKey: this.transport.getPublicKeyHex(),
      });
    }

    await this.savePairing();

    return {
      address: pairInfo.walletAddr,
      paired: true,
      pairId,
    };
  }

  private async handleRepair(): Promise<unknown> {
    this.transport?.disconnect();
    this.transport = null;
    this.pairing = null;
    this.commKeyPair = null;
    const filePath = join(this.options.dataDir, "pairing.json");
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(filePath);
    } catch {}
    return {
      message: "Pairing data cleared. Generate a new pairing code in the Electron Wallet App and call wallet_pair with the new code.",
      repaired: true,
    };
  }

  private async handleGetAddress(): Promise<unknown> {
    if (!this.pairing) {
      throw new Error("No wallet paired. Use wallet_pair to connect an Electron Wallet App.");
    }
    return { address: this.pairing.walletAddress };
  }

  private async handleSignTransaction(params: Record<string, unknown> | undefined): Promise<unknown> {
    if (!this.pairing) {
      throw new Error("No wallet paired. Use wallet_pair to connect an Electron Wallet App.");
    }

    const result = await this.sendToWallet("sign_transaction", params);
    return result;
  }

  private async loadPairing(): Promise<void> {
    const filePath = join(this.options.dataDir, "pairing.json");
    try {
      const data = await readFile(filePath, "utf-8");
      this.pairing = JSON.parse(data);
    } catch {
      this.pairing = null;
    }
  }

  private async savePairing(): Promise<void> {
    const filePath = join(this.options.dataDir, "pairing.json");
    const data = {
      ...this.pairing,
      commKeyPair: this.commKeyPair ? serializeKeyPair(this.commKeyPair) : undefined,
    };
    await writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  private loadCommKeyPair(): void {
    if (this.pairing?.commKeyPair) {
      this.commKeyPair = deserializeKeyPair(this.pairing.commKeyPair);
    }
    if (!this.commKeyPair) {
      this.commKeyPair = generateKeyPair();
    }
  }
}
