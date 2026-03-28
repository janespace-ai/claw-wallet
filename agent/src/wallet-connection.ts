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
import { agentConfig } from "./config.js";
import { logger } from "./logger.js";

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timeout (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const SIGN_METHODS = new Set(["sign_transaction", "sign_message"]);

export class WalletConnection {
  private relayUrl: string;
  private dataDir: string;
  private pairing: PairingData | null = null;
  private loaded = false;
  private healthOk = false;
  private healthCheckedAt = 0;

  constructor(options: WalletConnectionOptions) {
    let url = options.relayUrl.replace(/\/+$/, "");
    url = url.replace(/^ws(s?):\/\//, "http$1://");
    this.relayUrl = url;
    this.dataDir = options.dataDir;
    logger.log("WalletConnection", "Initialized", { relayUrl: this.relayUrl, dataDir: this.dataDir });
  }

  async initialize(): Promise<void> {
    logger.log("WalletConnection", "Initializing...");
    await mkdir(this.dataDir, { recursive: true });
    await this.loadPairing();
    logger.log("WalletConnection", "Initialized", { hasPairing: this.hasPairing(), address: this.getAddress() });
  }

  hasPairing(): boolean {
    return this.pairing !== null;
  }

  getAddress(): string | null {
    return this.pairing?.walletAddress ?? null;
  }

  async pair(shortCode: string): Promise<{ address: string; paired: boolean; pairId: string }> {
    logger.log("WalletConnection", "Starting pair", { shortCode });
    
    const pairUrl = `${this.relayUrl}/pair/${encodeURIComponent(shortCode)}`;
    logger.debug("WalletConnection", "Fetching pairing info", { url: pairUrl });
    
    const response = await fetchWithTimeout(
      pairUrl,
      {},
      agentConfig.pairTimeoutMs,
    );
    
    if (!response.ok) {
      logger.error("WalletConnection", "Pairing failed", { status: response.status, shortCode });
      throw new Error(`Pairing code invalid or expired (HTTP ${response.status})`);
    }

    const pairInfo = (await response.json()) as { walletAddr: string; commPubKey: string };
    logger.log("WalletConnection", "Received pairing info", { walletAddr: pairInfo.walletAddr });

    // Always generate a new key pair for each pairing session.
    // Reusing the old key pair would cause pairId mismatch when Desktop re-pairs
    // with a new short code, because pairId is derived from walletAddr + agentPubKey.
    const keyPair = generateKeyPair();
    logger.debug("WalletConnection", "Generated new key pair for pairing");

    const agentPubHex = Buffer.from(keyPair.publicKey).toString("hex");
    const pairId = derivePairId(pairInfo.walletAddr, agentPubHex);
    logger.log("WalletConnection", "Computed pairId", { pairId });

    this.pairing = {
      pairId,
      peerPublicKey: pairInfo.commPubKey,
      walletAddress: pairInfo.walletAddr,
      peerMachineId: "",
      pairedAt: new Date().toISOString(),
      commKeyPair: serializeKeyPair(keyPair),
    };

    await this.savePairing();
    logger.log("WalletConnection", "Saved pairing data");

    const pendingPairId = `pending-${shortCode.toUpperCase()}`;
    const pairCompleteRequestId = `pair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const relayUrl = `${this.relayUrl}/relay/${encodeURIComponent(pendingPairId)}`;
    
    logger.log("WalletConnection", "Sending pair_complete", { 
      pendingPairId, 
      requestId: pairCompleteRequestId,
      relayUrl 
    });
    
    try {
      await fetchWithTimeout(
        relayUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: pairCompleteRequestId,
            timeout: 15,
            data: {
              type: "pair_complete",
              machineId: getMachineId(),
              agentPublicKey: agentPubHex,
            },
          }),
        },
        15_000,
      );
      logger.log("WalletConnection", "pair_complete sent successfully");
    } catch (err) {
      logger.warn("WalletConnection", "pair_complete delivery failed (non-fatal)", { error: (err as Error).message });
    }

    keyPair.privateKey.fill(0);

    logger.log("WalletConnection", "Pairing complete", { address: pairInfo.walletAddr, pairId });
    return { address: pairInfo.walletAddr, paired: true, pairId };
  }

  async sendToWallet(method: string, params?: Record<string, unknown>): Promise<unknown> {
    logger.log("WalletConnection", "sendToWallet called", { method, params });
    
    if (!this.pairing) {
      logger.error("WalletConnection", "No wallet paired");
      throw new Error("No wallet paired. Use wallet_pair to connect a Desktop Wallet.");
    }

    await this.checkHealth();

    const timeoutMs = SIGN_METHODS.has(method)
      ? agentConfig.signTimeoutMs
      : agentConfig.relayTimeoutMs;

    const keyPair = deserializeKeyPair(this.pairing.commKeyPair);
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.log("WalletConnection", "Sending request to wallet", { 
      method, 
      requestId, 
      pairId: this.pairing.pairId,
      timeoutMs 
    });

    const result = await this.sendToWalletRaw(
      this.pairing.pairId,
      keyPair,
      this.pairing.peerPublicKey,
      { requestId, method, params },
      timeoutMs,
    );

    keyPair.privateKey.fill(0);

    const response = result as Record<string, unknown>;
    if (response.error) {
      logger.error("WalletConnection", "Wallet returned error", { error: response.error });
      throw new Error(response.error as string);
    }
    
    logger.log("WalletConnection", "Received response from wallet", { requestId, hasResult: !!response.result });
    const payload = response.result;
    if (payload !== undefined && typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      return { ...(payload as Record<string, unknown>), requestId };
    }
    return payload;
  }

  private async checkHealth(): Promise<void> {
    const now = Date.now();
    if (this.healthOk && now - this.healthCheckedAt < 30_000) {
      logger.debug("WalletConnection", "Health check cached OK");
      return;
    }

    logger.debug("WalletConnection", "Checking relay health", { url: `${this.relayUrl}/health` });
    try {
      const resp = await fetchWithTimeout(`${this.relayUrl}/health`, {}, 5_000);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.healthOk = true;
      this.healthCheckedAt = now;
      logger.log("WalletConnection", "Relay health OK");
    } catch (err) {
      this.healthOk = false;
      logger.error("WalletConnection", "Relay Server unreachable", { error: (err as Error).message });
      throw new Error("Relay Server unreachable");
    }
  }

  private async sendToWalletRaw(
    pairId: string,
    keyPair: E2EEKeyPair,
    peerPubHex: string,
    data: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    logger.debug("WalletConnection", "sendToWalletRaw START", { pairId, timeoutMs });
    
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

    const timeoutSec = Math.ceil(timeoutMs / 1000);
    const relayUrl = `${this.relayUrl}/relay/${encodeURIComponent(pairId)}`;

    logger.log("WalletConnection", "Sending encrypted request to relay", { 
      url: relayUrl,
      requestId, 
      timeoutSec 
    });

    const response = await fetchWithTimeout(
      relayUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, timeout: timeoutSec, data: message }),
      },
      timeoutMs,
    );

    logger.debug("WalletConnection", "Received response from relay", { 
      status: response.status,
      ok: response.ok 
    });

    destroySession(session);

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as Record<string, string>;
      logger.error("WalletConnection", "Relay request failed", { status: response.status, error: err.error });
      throw new Error(err.error ?? `Relay request failed (HTTP ${response.status})`);
    }

    const respBody = (await response.json()) as Record<string, unknown>;
    logger.debug("WalletConnection", "Parsing response", { type: respBody.type });

    if (respBody.type === "encrypted" && typeof respBody.payload === "string") {
      const respKeyPair = deserializeKeyPair(this.pairing!.commKeyPair);
      const respShared = deriveSharedKey(respKeyPair.privateKey, peerPub);
      const respSession = createSession(respShared, pairId);
      respShared.fill(0);
      respKeyPair.privateKey.fill(0);

      const respBytes = Buffer.from(respBody.payload as string, "base64");
      const decrypted = decryptJSON(respSession, respBytes);
      destroySession(respSession);
      
      logger.log("WalletConnection", "Successfully decrypted response");
      return decrypted;
    }

    logger.log("WalletConnection", "Returning unencrypted response");
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
