import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  generateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  deriveSharedKey,
  createSession,
  encryptJSON,
  decryptJSON,
  destroySession,
  derivePairId,
  type E2EEKeyPair,
} from "./e2ee/crypto.js";
import { getMachineId } from "./e2ee/machine-id.js";

interface PairingData {
  pairId: string;
  peerPublicKey: string;
  walletAddress: string;
  peerMachineId: string;
  pairedAt: string;
  commKeyPair: { publicKey: string; privateKey: string };
}

export interface WalletConnectionOptions {
  relayUrl: string;
  dataDir: string;
}

export class WalletConnection {
  private relayUrl: string;
  private dataDir: string;
  private pairing: PairingData | null = null;
  private loaded = false;

  constructor(options: WalletConnectionOptions) {
    let url = options.relayUrl.replace(/\/+$/, "");
    url = url.replace(/^ws(s?):\/\//, "http$1://");
    this.relayUrl = url;
    this.dataDir = options.dataDir;
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadPairing();
  }

  hasPairing(): boolean {
    return this.pairing !== null;
  }

  getAddress(): string | null {
    return this.pairing?.walletAddress ?? null;
  }

  async pair(shortCode: string): Promise<{ address: string; paired: boolean; pairId: string }> {
    const response = await fetch(`${this.relayUrl}/pair/${encodeURIComponent(shortCode)}`);
    if (!response.ok) {
      throw new Error(`Pairing code invalid or expired (HTTP ${response.status})`);
    }

    const pairInfo = (await response.json()) as { walletAddr: string; commPubKey: string };

    let keyPair: E2EEKeyPair;
    if (this.pairing?.commKeyPair) {
      keyPair = deserializeKeyPair(this.pairing.commKeyPair);
    } else {
      keyPair = generateKeyPair();
    }

    const agentPubHex = Buffer.from(keyPair.publicKey).toString("hex");
    const pairId = derivePairId(pairInfo.walletAddr, agentPubHex);

    this.pairing = {
      pairId,
      peerPublicKey: pairInfo.commPubKey,
      walletAddress: pairInfo.walletAddr,
      peerMachineId: "",
      pairedAt: new Date().toISOString(),
      commKeyPair: serializeKeyPair(keyPair),
    };

    await this.savePairing();

    try {
      await this.sendToWalletRaw(pairId, keyPair, pairInfo.commPubKey, {
        type: "pair_complete",
        machineId: getMachineId(),
        agentPublicKey: agentPubHex,
      });
    } catch {
      // Wallet may not be online yet during pairing; that's ok
    }

    keyPair.privateKey.fill(0);

    return { address: pairInfo.walletAddr, paired: true, pairId };
  }

  async sendToWallet(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.pairing) {
      throw new Error("No wallet paired. Use wallet_pair to connect a Desktop Wallet.");
    }

    const keyPair = deserializeKeyPair(this.pairing.commKeyPair);
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await this.sendToWalletRaw(
      this.pairing.pairId,
      keyPair,
      this.pairing.peerPublicKey,
      { requestId, method, params },
    );

    keyPair.privateKey.fill(0);

    const response = result as Record<string, unknown>;
    if (response.error) {
      throw new Error(response.error as string);
    }
    return response.result;
  }

  private async sendToWalletRaw(
    pairId: string,
    keyPair: E2EEKeyPair,
    peerPubHex: string,
    data: unknown,
  ): Promise<unknown> {
    const peerPub = Buffer.from(peerPubHex, "hex");
    const sharedKey = deriveSharedKey(keyPair.privateKey, peerPub);
    const session = createSession(sharedKey, pairId);
    sharedKey.fill(0);

    const encrypted = encryptJSON(session, data);
    const payload = Buffer.from(encrypted).toString("base64");

    const requestId = (data as Record<string, unknown>).requestId as string ??
      `internal-${Date.now()}`;

    const message = {
      type: "encrypted",
      payload,
    };

    const response = await fetch(`${this.relayUrl}/relay/${encodeURIComponent(pairId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, data: message }),
    });

    destroySession(session);

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as Record<string, string>;
      throw new Error(err.error ?? `Relay request failed (HTTP ${response.status})`);
    }

    const respBody = (await response.json()) as Record<string, unknown>;

    if (respBody.type === "encrypted" && typeof respBody.payload === "string") {
      const respKeyPair = deserializeKeyPair(this.pairing!.commKeyPair);
      const respShared = deriveSharedKey(respKeyPair.privateKey, peerPub);
      const respSession = createSession(respShared, pairId);
      respShared.fill(0);
      respKeyPair.privateKey.fill(0);

      const respBytes = Buffer.from(respBody.payload as string, "base64");
      const decrypted = decryptJSON(respSession, respBytes);
      destroySession(respSession);
      return decrypted;
    }

    return respBody;
  }

  private async loadPairing(): Promise<void> {
    const filePath = join(this.dataDir, "pairing.json");
    try {
      const data = await readFile(filePath, "utf-8");
      this.pairing = JSON.parse(data);
      this.loaded = true;
    } catch {
      this.pairing = null;
      this.loaded = true;
    }
  }

  private async savePairing(): Promise<void> {
    const filePath = join(this.dataDir, "pairing.json");
    await writeFile(filePath, JSON.stringify(this.pairing, null, 2), { mode: 0o600 });
  }
}
